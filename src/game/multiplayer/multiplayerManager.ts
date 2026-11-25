import type {
  Language,
  MapMarker,
  MultiplayerHudState,
  MultiplayerSessionSummary,
  NetworkQualityMode,
  PlayerSkinId,
  ServerRegionId,
  VehicleClassId,
  WeaponId,
} from '../types';
import type { WorldVehicle } from '../vehicles/vehiclePhysics';
import { NetworkClient } from './networkClient';
import { NetworkPlayerSystem } from './networkPlayer';
import { P2PNetworkTransport } from './p2pNetwork';
import { computeSeatWorldPose, PassengerSystem, type NearbySharedVehicleCandidate } from './passengerSystem';
import { INTEREST_FULL_RATE_RADIUS, quantize } from './protocol';
import type { ClientMessage, RemoteAnimState, ServerMessage, SharedVehicleState } from './protocol';
import { SessionManager, type SessionFetchReason } from './sessionManager';
import { VehicleNetworkSystem, type RemoteVehicleVisual } from './vehicleNetwork';
import type * as THREE from 'three';

export interface MultiplayerCallbacks {
  getLanguage: () => Language;
  getPlayerSkin: () => PlayerSkinId;
  getPlayerWeapon: () => WeaponId;
  getPlayerPose: () => {
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    heading: number;
    onGround: boolean;
    isSwimming: boolean;
    isSprinting: boolean;
    inInterior: boolean;
  };
  applyServerTeleport: (x: number, y: number, z: number, heading?: number) => void;
  onRemoteFireEffect: (
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    playAudio: boolean
  ) => void;
  onRemoteExplosionEffect: (x: number, y: number, z: number, playAudio: boolean) => void;
  onRemoteHornEffect: (x: number, y: number, z: number, playAudio: boolean) => void;
  onBanner: (title: string, subtitle: string, kind: 'success' | 'fail' | 'info') => void;
  onHudChanged: () => void;
  onForceExitVehicle: () => void;
  onSessionJoined?: (isP2pHost: boolean) => void;
}

export class MultiplayerManager {
  public readonly sessions = new SessionManager();
  public readonly players: NetworkPlayerSystem;
  public readonly vehicles: VehicleNetworkSystem;
  public readonly passenger = new PassengerSystem();

  private client: NetworkClient;
  private p2p: P2PNetworkTransport;
  private transportMode: 'none' | 'ws' | 'p2p' = 'none';
  private cb: MultiplayerCallbacks;
  private active = false;
  private sendAccum = 0;
  private farTickToggle = false;
  private activeDrivenVehicleId: string | null = null;
  private pendingSeatResolve: ((ok: boolean, reason?: string) => void) | null = null;

  constructor(scene: THREE.Scene, callbacks: MultiplayerCallbacks) {
    this.cb = callbacks;
    this.players = new NetworkPlayerSystem(scene);
    this.vehicles = new VehicleNetworkSystem(scene);
    this.client = new NetworkClient({
      onMessage: (msg) => this.handleServerMessage(msg),
      onClose: () => {
        if (this.transportMode === 'ws') this.handleDisconnected();
      },
      onError: () => {
        if (this.transportMode === 'ws') this.handleConnectionError();
      },
      onPingUpdate: () => this.cb.onHudChanged(),
    });
    this.p2p = new P2PNetworkTransport({
      onServerMessage: (msg) => this.handleServerMessage(msg),
      onPingUpdate: () => this.cb.onHudChanged(),
      onDisconnected: () => {
        if (this.transportMode === 'p2p') this.handleDisconnected();
      },
      onUiUpdate: () => this.cb.onHudChanged(),
    });
  }

  public isActive(): boolean {
    return this.active && this.sessions.status === 'connected';
  }

  private sendNet(msg: ClientMessage): boolean {
    if (this.transportMode === 'p2p') {
      return this.p2p.send(msg);
    }
    return this.client.send(msg);
  }

  private isNetConnected(): boolean {
    if (this.transportMode === 'p2p') return this.p2p.isConnected();
    return this.client.isConnected();
  }

  public getHudState(): MultiplayerHudState {
    const s = this.sessions.currentSession;
    return {
      active: this.isActive(),
      status: this.sessions.status,
      errorMessage: this.sessions.errorMessage,
      localPlayerId: this.sessions.localPlayerId,
      playerName: this.sessions.assignedPlayerName,
      customName: this.sessions.customName,
      sessionId: s?.id ?? null,
      sessionCode: s?.code ?? null,
      sessionName: s?.name ?? null,
      playerCount: s?.playerCount ?? 0,
      maxPlayers: s?.maxPlayers ?? 8,
      pingMs: this.transportMode === 'p2p' ? this.p2p.pingMs : this.client.pingMs,
      region: this.sessions.region,
      networkQuality: this.sessions.networkQuality,
      mpAudioEnabled: this.sessions.mpAudioEnabled,
      inVehicleRole: this.passenger.role,
      passengerSeatIndex: this.passenger.seatIndex,
      driverName: this.passenger.driverName,
      serverUrl: this.sessions.serverUrl,
      isStandaloneMode: NetworkClient.isStandaloneFileOrApk(),
      p2p: this.p2p.getUiSnapshot(),
    };
  }

  public getSessionList(): MultiplayerSessionSummary[] {
    return this.sessions.sessions;
  }

  public async refreshSessions(): Promise<boolean> {
    this.sessions.errorMessage = null;
    const res = await this.sessions.fetchSessions();
    if (!res.ok) {
      this.applyFetchError(res.reason);
    }
    this.cb.onHudChanged();
    return res.ok;
  }

  public async setServerUrl(url: string): Promise<boolean> {
    this.sessions.setServerUrl(url);
    return this.refreshSessions();
  }

  public async createSession(sessionName: string, maxPlayers: number): Promise<boolean> {
    if (NetworkClient.isDeviceOffline()) {
      this.setOfflineError('offline_device');
      return false;
    }
    if (!NetworkClient.getWsUrl()) {
      this.setOfflineError('standalone_no_server');
      return false;
    }
    this.p2p.disconnect();
    this.transportMode = 'ws';
    this.sessions.status = 'connecting';
    this.sessions.errorMessage = null;
    this.cb.onHudChanged();

    try {
      await this.client.connect();
      this.client.send({
        type: 'create_session',
        sessionName,
        maxPlayers,
        region: this.sessions.region,
        customName: this.sessions.customName || undefined,
        skinId: this.cb.getPlayerSkin(),
        weaponId: this.cb.getPlayerWeapon(),
      });
      this.client.send({ type: 'set_net_quality', quality: this.sessions.networkQuality });
      return true;
    } catch {
      this.setOfflineError('server_unreachable');
      return false;
    }
  }

  public async joinSession(options: { sessionId?: string; sessionCode?: string }): Promise<boolean> {
    if (NetworkClient.isDeviceOffline()) {
      this.setOfflineError('offline_device');
      return false;
    }
    if (!NetworkClient.getWsUrl()) {
      this.setOfflineError('standalone_no_server');
      return false;
    }
    this.p2p.disconnect();
    this.transportMode = 'ws';
    this.sessions.status = 'connecting';
    this.sessions.errorMessage = null;
    this.cb.onHudChanged();

    try {
      await this.client.connect();
      this.client.send({
        type: 'join_session',
        sessionId: options.sessionId,
        sessionCode: options.sessionCode,
        customName: this.sessions.customName || undefined,
        skinId: this.cb.getPlayerSkin(),
        weaponId: this.cb.getPlayerWeapon(),
      });
      this.client.send({ type: 'set_net_quality', quality: this.sessions.networkQuality });
      return true;
    } catch {
      this.setOfflineError('server_unreachable');
      return false;
    }
  }

  public async startP2PHost(sessionName: string, maxPlayers: number): Promise<{ ok: boolean; inviteCode: string }> {
    this.client.disconnect('switch_to_p2p');
    this.transportMode = 'p2p';
    this.sessions.errorMessage = null;
    this.sessions.status = 'connecting';
    this.cb.onHudChanged();

    const res = await this.p2p.startHostRoom({
      sessionName,
      maxPlayers,
      customName: this.sessions.customName || undefined,
      skinId: this.cb.getPlayerSkin(),
      weaponId: this.cb.getPlayerWeapon(),
    });
    if (!res.ok) {
      this.transportMode = 'none';
      this.sessions.status = 'error';
      this.sessions.errorMessage = res.error ?? 'Failed to start P2P room.';
      this.cb.onHudChanged();
    }
    return { ok: res.ok, inviteCode: res.inviteCode };
  }

  public async createP2PExtraInvite(): Promise<string> {
    return this.p2p.createNewInviteSlot();
  }

  public async acceptP2PReply(replyCode: string): Promise<{ ok: boolean; error?: string }> {
    return this.p2p.acceptGuestReply(replyCode);
  }

  public async joinP2PWithInvite(inviteCode: string): Promise<{ ok: boolean; replyCode: string; error?: string }> {
    this.client.disconnect('switch_to_p2p');
    this.transportMode = 'p2p';
    this.sessions.errorMessage = null;
    this.sessions.status = 'connecting';
    this.cb.onHudChanged();

    const res = await this.p2p.joinWithInvite({
      inviteCode,
      customName: this.sessions.customName || undefined,
      skinId: this.cb.getPlayerSkin(),
      weaponId: this.cb.getPlayerWeapon(),
      quality: this.sessions.networkQuality,
    });
    if (!res.ok) {
      this.transportMode = 'none';
      this.sessions.status = 'error';
      this.sessions.errorMessage = res.error ?? 'Invalid invite code.';
      this.cb.onHudChanged();
    }
    return res;
  }

  public leaveSession(): void {
    if (this.transportMode === 'ws' && this.client.isConnected()) {
      this.client.send({ type: 'leave_session' });
    } else if (this.transportMode === 'p2p' && this.p2p.isConnected()) {
      this.p2p.send({ type: 'leave_session' });
    }
    this.cleanupSessionEntities();
    this.client.disconnect('leave');
    this.p2p.disconnect();
    this.transportMode = 'none';
    this.sessions.clearSession();
    this.sessions.errorMessage = null;
    this.active = false;
    this.cb.onHudChanged();
  }

  public changeName(newName: string): void {
    const saved = this.sessions.setCustomName(newName);
    if (this.isActive()) {
      this.sendNet({ type: 'name_change', name: saved });
    } else if (saved) {
      this.sessions.assignedPlayerName = saved;
    }
    this.cb.onHudChanged();
  }

  public updateSettings(patch: {
    networkQuality?: NetworkQualityMode;
    region?: ServerRegionId;
    mpAudioEnabled?: boolean;
  }): void {
    this.sessions.updateSettings(patch);
    if (patch.networkQuality && this.isActive()) {
      this.sendNet({ type: 'set_net_quality', quality: patch.networkQuality });
    }
    this.cb.onHudChanged();
  }

  public notifyVehicleEntered(v: WorldVehicle, colorHex: number): void {
    if (!this.isActive()) return;
    if (!v.id.startsWith('mp_')) {
      v.id = `mp_${this.sessions.localPlayerId ?? 'p'}_${v.id}`;
    }
    this.activeDrivenVehicleId = v.id;
    this.passenger.setSeated('driver', v.id, 0, this.sessions.assignedPlayerName);
    this.sendNet({
      type: 'vehicle_enter',
      vehicleId: v.id,
      classId: v.classId,
      colorHex,
      x: v.x,
      y: v.y,
      z: v.z,
      heading: v.heading,
      hp: v.hp,
    });
  }

  public requestBoardRemoteVehicle(candidate: NearbySharedVehicleCandidate): void {
    if (!this.isActive()) return;
    if (!candidate.hasOpenSeat) {
      const lang = this.cb.getLanguage();
      this.cb.onBanner(
        lang === 'ar' ? 'السيارة ممتلئة' : 'Vehicle Full',
        lang === 'ar' ? 'لا توجد مقاعد فارغة في هذه السيارة.' : 'No open passenger seats available.',
        'fail'
      );
      return;
    }

    const v = candidate.vehicle.state;
    const driverName = v.driverId ? this.players.getPlayerName(v.driverId) : null;
    this.passenger.setSeated('passenger', v.id, candidate.openSeatIndex, driverName);
    this.sendNet({
      type: 'vehicle_enter',
      vehicleId: v.id,
      classId: v.classId,
      colorHex: v.colorHex,
      x: v.x,
      y: v.y,
      z: v.z,
      heading: v.heading,
      hp: v.hp,
    });
    this.cb.onHudChanged();
  }

  public exitPassengerVehicle(): { x: number; y: number; z: number } | null {
    if (this.passenger.role !== 'passenger' || !this.passenger.vehicleId) return null;
    const v = this.vehicles.getVehicle(this.passenger.vehicleId);
    let exitX = this.cb.getPlayerPose().x;
    let exitY = this.cb.getPlayerPose().y;
    let exitZ = this.cb.getPlayerPose().z;
    if (v) {
      const sideSign = this.passenger.seatIndex % 2 === 0 ? -1 : 1;
      const offset = v.rig.spec.width * 0.8 + 0.8;
      exitX = v.x + Math.cos(v.heading) * offset * sideSign;
      exitZ = v.z - Math.sin(v.heading) * offset * sideSign;
      exitY = v.y;
    }
    if (this.isActive()) {
      this.sendNet({
        type: 'vehicle_exit',
        vehicleId: this.passenger.vehicleId,
        x: exitX,
        y: exitY,
        z: exitZ,
      });
    }
    this.passenger.reset();
    this.cb.onHudChanged();
    return { x: exitX, y: exitY, z: exitZ };
  }

  public notifyVehicleExited(vehicleId: string, x: number, y: number, z: number): void {
    if (this.activeDrivenVehicleId === vehicleId) {
      this.activeDrivenVehicleId = null;
    }
    if (this.passenger.role === 'driver' && this.passenger.vehicleId === vehicleId) {
      this.passenger.reset();
    }
    if (!this.isActive()) return;
    this.sendNet({
      type: 'vehicle_exit',
      vehicleId,
      x,
      y,
      z,
    });
  }

  public notifyWeaponFired(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    weaponId: WeaponId
  ): void {
    if (!this.isActive()) return;
    this.sendNet({
      type: 'world_event',
      event: 'fire',
      x: ox,
      y: oy,
      z: oz,
      dirX: dx,
      dirY: dy,
      dirZ: dz,
      weaponId,
    });
  }

  public notifyExplosion(x: number, y: number, z: number): void {
    if (!this.isActive()) return;
    this.sendNet({ type: 'world_event', event: 'explosion', x, y, z });
  }

  public notifyHorn(x: number, y: number, z: number): void {
    if (!this.isActive()) return;
    this.sendNet({ type: 'world_event', event: 'horn', x, y, z });
  }

  public findNearbyRemoteVehicle(px: number, py: number, pz: number): NearbySharedVehicleCandidate | null {
    if (!this.isActive()) return null;
    return this.passenger.findNearestJoinableVehicle(
      px,
      py,
      pz,
      this.vehicles.getAllVehicles(),
      this.sessions.localPlayerId,
      this.cb.getLanguage()
    );
  }

  public getRemoteVehicle(id: string): RemoteVehicleVisual | undefined {
    return this.vehicles.getVehicle(id);
  }

  public getPassengerWorldPose(): { x: number; y: number; z: number; heading: number } | null {
    if (this.passenger.role !== 'passenger' || !this.passenger.vehicleId) return null;
    const v = this.vehicles.getVehicle(this.passenger.vehicleId);
    if (!v) return null;
    return computeSeatWorldPose(v, v.state.classId, this.passenger.seatIndex);
  }

  public getMapMarkers(): MapMarker[] {
    if (!this.isActive()) return [];
    const list: MapMarker[] = [];
    for (const p of this.players.getRemotePlayers()) {
      list.push({
        id: `rp_${p.id}`,
        type: 'remote_player',
        x: p.x,
        z: p.z,
        heading: p.heading,
        label: p.name,
      });
    }
    return list;
  }

  public update(dt: number, isNight: boolean, activeVehicle: WorldVehicle | null): void {
    if (!this.isActive() || !this.isNetConnected()) return;
    const nowMs = performance.now();

    // Update remote vehicle visuals and interpolated positions
    this.vehicles.update(dt, nowMs, isNight);

    // Update remote player meshes + seat anchoring + billboard nameplates
    this.players.update(dt, nowMs, (vehicleId, seatIndex) => {
      if (activeVehicle && activeVehicle.id === vehicleId) {
        return computeSeatWorldPose(activeVehicle, activeVehicle.classId, seatIndex);
      }
      const rv = this.vehicles.getVehicle(vehicleId);
      if (rv) {
        return computeSeatWorldPose(rv, rv.state.classId, seatIndex);
      }
      return null;
    });

    // If local passenger's vehicle vanished or exploded remotely, auto-exit safely
    if (this.passenger.role === 'passenger' && this.passenger.vehicleId) {
      const rv = this.vehicles.getVehicle(this.passenger.vehicleId);
      if (!rv) {
        this.passenger.reset();
        this.cb.onHudChanged();
      } else {
        this.passenger.driverName = rv.state.driverId
          ? this.players.getPlayerName(rv.state.driverId)
          : null;
      }
    }

    // Throttled local state broadcast (10 / 15 / 20 Hz configurable)
    this.sendAccum += dt;
    const interval = this.sessions.getSendIntervalSec();
    if (this.sendAccum >= interval) {
      this.sendAccum = 0;
      const pose = this.cb.getPlayerPose();

      // Interest management: if nearest remote player > 320m, halve local state send cadence
      const remotes = this.players.getRemotePlayers();
      let minDist = Infinity;
      for (const r of remotes) {
        const d = Math.hypot(r.x - pose.x, r.z - pose.z);
        if (d < minDist) minDist = d;
      }
      if (minDist > INTEREST_FULL_RATE_RADIUS) {
        this.farTickToggle = !this.farTickToggle;
        if (this.farTickToggle) return;
      }

      const animState: RemoteAnimState =
        this.passenger.role === 'passenger'
          ? 'passenger'
          : activeVehicle
            ? activeVehicle.classId === 'bicycle' ||
              activeVehicle.classId === 'speed_bicycle' ||
              activeVehicle.classId === 'motorcycle'
              ? 'bike'
              : 'drive'
            : pose.isSwimming
              ? 'swim'
              : !pose.onGround
                ? 'jump'
                : Math.hypot(pose.vx, pose.vz) > 0.65
                  ? pose.isSprinting
                    ? 'run'
                    : 'walk'
                  : 'idle';

      this.sendNet({
        type: 'player_state',
        x: quantize(pose.x, 2),
        y: quantize(pose.y, 2),
        z: quantize(pose.z, 2),
        vx: quantize(pose.vx, 2),
        vz: quantize(pose.vz, 2),
        heading: quantize(pose.heading, 3),
        skinId: this.cb.getPlayerSkin(),
        weaponId: pose.inInterior ? 'fists' : this.cb.getPlayerWeapon(),
        animState,
      });

      if (activeVehicle && this.passenger.role === 'driver' && activeVehicle.id === this.activeDrivenVehicleId) {
        this.sendNet({
          type: 'vehicle_state',
          vehicleId: activeVehicle.id,
          x: quantize(activeVehicle.x, 2),
          y: quantize(activeVehicle.y, 2),
          z: quantize(activeVehicle.z, 2),
          vx: quantize(activeVehicle.vx, 2),
          vz: quantize(activeVehicle.vz, 2),
          heading: quantize(activeVehicle.heading, 3),
          pitch: quantize(activeVehicle.pitch, 3),
          roll: quantize(activeVehicle.roll, 3),
          steerAngle: quantize(activeVehicle.steerAngle, 3),
          forwardSpeed: quantize(activeVehicle.forwardSpeed, 2),
          hp: Math.round(activeVehicle.hp),
          headlightsOn: activeVehicle.headlightsOn,
          turnSignal: activeVehicle.turnSignal,
          wingsDeployed: activeVehicle.classId.startsWith('mech_')
            ? activeVehicle.robotTransformed
            : activeVehicle.wingsDeployed,
          wingProgress: quantize(
            activeVehicle.classId.startsWith('mech_')
              ? activeVehicle.robotProgress
              : activeVehicle.wingProgress,
            2
          ),
        });
      }
    }
  }

  private applyFetchError(reason: SessionFetchReason): void {
    const lang = this.cb.getLanguage();
    if (reason === 'offline_device') {
      this.sessions.errorMessage =
        lang === 'ar'
          ? 'جهازك غير متصل بالإنترنت حالياً.'
          : 'Your device appears to be offline.';
    } else if (reason === 'standalone_no_server') {
      this.sessions.errorMessage =
        lang === 'ar'
          ? 'أنت تفتح اللعبة من ملف HTML / تطبيق APK محلي (لا يحتوي على سيرفر مركزي). استخدم «اللعب المباشر P2P» بالأسفل للعب أونلاين مع أصدقائك بدون سيرفر، أو أضف رابط سيرفر.'
          : 'Running from standalone HTML / APK (no built-in central server). Use Direct P2P Online below to play with friends without a server, or enter a server URL.';
    } else {
      this.sessions.errorMessage =
        lang === 'ar'
          ? 'تعذر الوصول لسيرفر الغرف المركزي (قد يتطلب تسجيل دخول أو لم يُضف رابط سيرفر). يمكنك اللعب فوراً عبر «اللعب المباشر P2P» بالأسفل!'
          : 'Central server unreachable. You can still play online immediately using Direct P2P below!';
    }
  }

  private setOfflineError(reason: SessionFetchReason = 'server_unreachable'): void {
    this.active = false;
    this.sessions.status = 'error';
    this.applyFetchError(reason);
    this.cb.onHudChanged();
  }

  private handleConnectionError(): void {
    this.cleanupSessionEntities();
    this.setOfflineError('server_unreachable');
  }

  private handleDisconnected(): void {
    const wasActive = this.active;
    this.cleanupSessionEntities();
    this.sessions.clearSession();
    this.transportMode = 'none';
    this.active = false;
    if (wasActive) {
      const lang = this.cb.getLanguage();
      this.sessions.status = 'error';
      this.sessions.errorMessage =
        lang === 'ar'
          ? 'انقطع الاتصال بسيرفر اللاعب الجماعي.'
          : 'Disconnected from CityWorld Online session.';
      this.cb.onBanner(
        lang === 'ar' ? 'انقطع الاتصال' : 'Connection Lost',
        lang === 'ar' ? 'انقطع الاتصال بالجلسة.' : 'Multiplayer connection lost.',
        'fail'
      );
    }
    this.cb.onHudChanged();
  }

  private cleanupSessionEntities(): void {
    this.players.clearAll();
    this.vehicles.clearAll();
    this.passenger.reset();
    this.activeDrivenVehicleId = null;
  }

  private handleServerMessage(msg: ServerMessage): void {
    const nowMs = performance.now();
    const lang = this.cb.getLanguage();

    switch (msg.type) {
      case 'session_joined': {
        this.cleanupSessionEntities();
        this.active = true;
        this.sessions.status = 'connected';
        this.sessions.errorMessage = null;
        this.sessions.localPlayerId = msg.playerId;
        this.sessions.assignedPlayerName = msg.playerName;
        this.sessions.currentSession = msg.session;

        this.cb.onForceExitVehicle();
        this.cb.applyServerTeleport(msg.spawn.x, msg.spawn.y, msg.spawn.z, msg.spawn.heading);

        this.vehicles.syncAll(msg.vehicles, nowMs, this.activeDrivenVehicleId);
        this.players.syncAll(msg.players, nowMs, msg.playerId);

        this.cb.onBanner(
          `CityWorld Online · ${msg.playerName}`,
          lang === 'ar'
            ? `انضممت إلى ${msg.session.name} (الرمز: ${msg.session.code})`
            : `Joined ${msg.session.name} (Code: ${msg.session.code})`,
          'success'
        );
        this.cb.onSessionJoined?.(this.transportMode === 'p2p' && this.p2p.getUiSnapshot().role === 'host');
        this.cb.onHudChanged();
        return;
      }

      case 'session_left': {
        this.cleanupSessionEntities();
        this.sessions.clearSession();
        this.active = false;
        this.cb.onHudChanged();
        return;
      }

      case 'player_joined': {
        if (msg.player.id !== this.sessions.localPlayerId) {
          this.players.upsertPlayer(msg.player, nowMs);
        }
        if (this.sessions.currentSession) {
          this.sessions.currentSession.playerCount = msg.playerCount;
        }
        this.cb.onHudChanged();
        return;
      }

      case 'player_left': {
        this.players.removePlayer(msg.playerId);
        if (this.sessions.currentSession) {
          this.sessions.currentSession.playerCount = msg.playerCount;
        }
        this.cb.onHudChanged();
        return;
      }

      case 'player_renamed': {
        if (msg.playerId === this.sessions.localPlayerId) {
          this.sessions.assignedPlayerName = msg.name;
        } else {
          this.players.renamePlayer(msg.playerId, msg.name, msg.isCustomName);
        }
        this.cb.onHudChanged();
        return;
      }

      case 'player_correction': {
        this.cb.applyServerTeleport(msg.x, msg.y, msg.z);
        return;
      }

      case 'vehicle_seat_result': {
        if (!msg.ok) {
          if (this.passenger.role === 'passenger') {
            this.passenger.reset();
          }
          if (msg.reason === 'full') {
            this.cb.onBanner(
              lang === 'ar' ? 'السيارة ممتلئة' : 'Vehicle Full',
              lang === 'ar' ? 'لا توجد مقاعد فارغة في هذه السيارة.' : 'This vehicle has no open seats.',
              'fail'
            );
          }
          this.cb.onHudChanged();
          return;
        }
        if (msg.role === 'passenger' && msg.vehicle) {
          const dName = msg.vehicle.driverId ? this.players.getPlayerName(msg.vehicle.driverId) : null;
          this.passenger.setSeated('passenger', msg.vehicleId, msg.seatIndex, dName);
          this.cb.onHudChanged();
        } else if (msg.role === 'driver') {
          this.passenger.setSeated('driver', msg.vehicleId, 0, this.sessions.assignedPlayerName);
          this.cb.onHudChanged();
        }
        this.pendingSeatResolve?.(msg.ok, msg.reason);
        this.pendingSeatResolve = null;
        return;
      }

      case 'vehicle_removed': {
        if (this.passenger.vehicleId === msg.vehicleId) {
          this.passenger.reset();
        }
        this.vehicles.removeVehicle(msg.vehicleId);
        return;
      }

      case 'world_snapshot': {
        if (this.sessions.currentSession) {
          this.sessions.currentSession.playerCount = msg.sessionPlayerCount;
        }
        this.vehicles.syncAll(msg.vehicles, nowMs, this.activeDrivenVehicleId);
        this.players.syncAll(msg.players, nowMs, this.sessions.localPlayerId);
        return;
      }

      case 'world_event': {
        const audioOk = this.sessions.mpAudioEnabled;
        if (msg.event === 'fire') {
          this.players.triggerRemoteFire(msg.playerId);
          this.cb.onRemoteFireEffect(
            msg.x,
            msg.y,
            msg.z,
            msg.dirX ?? 0,
            msg.dirY ?? 0,
            msg.dirZ ?? 1,
            audioOk
          );
        } else if (msg.event === 'explosion') {
          this.cb.onRemoteExplosionEffect(msg.x, msg.y, msg.z, audioOk);
        } else if (msg.event === 'horn') {
          this.cb.onRemoteHornEffect(msg.x, msg.y, msg.z, audioOk);
        }
        return;
      }

      case 'error_notice': {
        this.sessions.errorMessage = msg.message;
        if (msg.code === 'SESSION_FULL' || msg.code === 'SESSION_NOT_FOUND') {
          this.sessions.status = 'error';
          this.cb.onBanner('CityWorld Online', msg.message, 'fail');
        }
        this.cb.onHudChanged();
        return;
      }
    }
  }

  public dispose(): void {
    this.client.disconnect('dispose');
    this.p2p.disconnect();
    this.players.dispose();
    this.vehicles.dispose();
  }
}
