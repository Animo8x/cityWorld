import type {
  MultiplayerConnectionStatus,
  MultiplayerSessionSummary,
  NetworkQualityMode,
  ServerRegionId,
} from '../types';
import { NetworkClient } from './networkClient';
import {
  loadSavedCustomName,
  loadStoredMpSettings,
  saveCustomName,
  saveStoredMpSettings,
} from './playerNameSystem';

export type SessionFetchReason = 'ok' | 'offline_device' | 'standalone_no_server' | 'server_unreachable';

export class SessionManager {
  public status: MultiplayerConnectionStatus = 'offline';
  public errorMessage: string | null = null;
  public sessions: MultiplayerSessionSummary[] = [];
  public loadingSessions = false;

  public currentSession: MultiplayerSessionSummary | null = null;
  public localPlayerId: string | null = null;
  public assignedPlayerName = 'Player 1';
  public customName = loadSavedCustomName();
  public networkQuality: NetworkQualityMode;
  public region: ServerRegionId;
  public mpAudioEnabled: boolean;
  public serverUrl: string = NetworkClient.getCustomServerUrl();

  constructor() {
    const stored = loadStoredMpSettings();
    this.networkQuality = stored.networkQuality;
    this.region = stored.region;
    this.mpAudioEnabled = stored.mpAudioEnabled;
  }

  public setServerUrl(url: string): string {
    this.serverUrl = NetworkClient.setCustomServerUrl(url);
    return this.serverUrl;
  }

  public setCustomName(rawName: string): string {
    this.customName = saveCustomName(rawName);
    return this.customName;
  }

  public updateSettings(patch: {
    networkQuality?: NetworkQualityMode;
    region?: ServerRegionId;
    mpAudioEnabled?: boolean;
  }): void {
    if (patch.networkQuality) this.networkQuality = patch.networkQuality;
    if (patch.region) this.region = patch.region;
    if (patch.mpAudioEnabled !== undefined) this.mpAudioEnabled = patch.mpAudioEnabled;
    saveStoredMpSettings({
      networkQuality: this.networkQuality,
      region: this.region,
      mpAudioEnabled: this.mpAudioEnabled,
    });
  }

  public getSendIntervalSec(): number {
    if (this.networkQuality === 'low') return 0.1; // 10 Hz
    if (this.networkQuality === 'high') return 0.05; // 20 Hz
    return 0.066; // 15 Hz balanced
  }

  public async fetchSessions(): Promise<{
    ok: boolean;
    reason: SessionFetchReason;
    sessions: MultiplayerSessionSummary[];
  }> {
    if (NetworkClient.isDeviceOffline()) {
      this.sessions = [];
      return { ok: false, reason: 'offline_device', sessions: [] };
    }

    const httpBase = NetworkClient.getHttpBaseUrl();
    if (!httpBase) {
      this.sessions = [];
      return { ok: false, reason: 'standalone_no_server', sessions: [] };
    }

    this.loadingSessions = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(`${httpBase}/api/multiplayer/sessions`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        this.loadingSessions = false;
        return { ok: false, reason: 'server_unreachable', sessions: [] };
      }
      const data = (await res.json()) as { ok?: boolean; sessions?: MultiplayerSessionSummary[] };
      this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      this.loadingSessions = false;
      return { ok: true, reason: 'ok', sessions: this.sessions };
    } catch {
      clearTimeout(timer);
      this.loadingSessions = false;
      return { ok: false, reason: 'server_unreachable', sessions: [] };
    }
  }

  public clearSession(): void {
    this.status = 'offline';
    this.currentSession = null;
    this.localPlayerId = null;
  }
}
