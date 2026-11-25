import type { ClientMessage, ServerMessage } from './protocol';

const SERVER_URL_STORAGE_KEY = 'cityworld_mp_server_url_v1';

export type NetworkClientEvents = {
  onOpen?: () => void;
  onMessage?: (msg: ServerMessage) => void;
  onClose?: (reason: string) => void;
  onError?: (reason: string) => void;
  onPingUpdate?: (pingMs: number) => void;
};

function normalizeServerOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^ws/i, 'http');
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export class NetworkClient {
  private ws: WebSocket | null = null;
  private events: NetworkClientEvents;
  private pingTimer: number | null = null;
  private connectTimeout: number | null = null;
  private intentionallyClosed = false;
  public pingMs = 0;

  constructor(events: NetworkClientEvents) {
    this.events = events;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public static isDeviceOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  public static isStandaloneFileOrApk(): boolean {
    if (typeof window === 'undefined') return false;
    const proto = window.location.protocol;
    const host = window.location.hostname;
    return (
      proto === 'file:' ||
      proto === 'content:' ||
      proto === 'capacitor:' ||
      proto === 'ionic:' ||
      host === 'appassets.androidplatform.net'
    );
  }

  public static getCustomServerUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(SERVER_URL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  public static setCustomServerUrl(url: string): string {
    const clean = normalizeServerOrigin(url);
    try {
      if (clean) {
        window.localStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
      } else {
        window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return clean;
  }

  public static getHttpBaseUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const custom = NetworkClient.getCustomServerUrl();
    if (custom) return custom;
    if (NetworkClient.isStandaloneFileOrApk()) return null;
    return window.location.origin;
  }

  public static getWsUrl(): string | null {
    const httpBase = NetworkClient.getHttpBaseUrl();
    if (!httpBase) return null;
    const wsBase = httpBase.replace(/^http/i, 'ws');
    return `${wsBase}/ws/multiplayer`;
  }

  public static canAttemptOnlineConnection(): boolean {
    if (typeof window === 'undefined') return false;
    if (NetworkClient.isDeviceOffline()) return false;
    return typeof WebSocket !== 'undefined';
  }

  public connect(): Promise<void> {
    this.disconnect('reconnect');
    this.intentionallyClosed = false;

    if (!NetworkClient.canAttemptOnlineConnection()) {
      const msg = 'offline';
      this.events.onError?.(msg);
      return Promise.reject(new Error(msg));
    }

    const wsUrl = NetworkClient.getWsUrl();
    if (!wsUrl) {
      const msg = 'standalone_no_server';
      this.events.onError?.(msg);
      return Promise.reject(new Error(msg));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        this.connectTimeout = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            this.disconnect('timeout');
            this.events.onError?.('timeout');
            reject(new Error('timeout'));
          }
        }, 6500);

        ws.onopen = () => {
          if (this.connectTimeout !== null) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          if (!settled) {
            settled = true;
            this.startPingLoop();
            this.events.onOpen?.();
            resolve();
          }
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(String(evt.data)) as ServerMessage;
            if (msg.type === 'pong') {
              const rtt = Math.max(1, Math.round(performance.now() - msg.clientTime));
              this.pingMs = rtt;
              this.events.onPingUpdate?.(rtt);
              return;
            }
            this.events.onMessage?.(msg);
          } catch {
            // Ignore malformed frame
          }
        };

        ws.onerror = () => {
          if (this.connectTimeout !== null) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          if (!settled) {
            settled = true;
            this.events.onError?.('connection_failed');
            reject(new Error('connection_failed'));
          }
        };

        ws.onclose = () => {
          this.stopPingLoop();
          if (this.connectTimeout !== null) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          if (!settled) {
            settled = true;
            this.events.onError?.('closed');
            reject(new Error('closed'));
          } else if (!this.intentionallyClosed) {
            this.events.onClose?.('disconnected');
          }
        };
      } catch {
        if (!settled) {
          settled = true;
          this.events.onError?.('connection_failed');
          reject(new Error('connection_failed'));
        }
      }
    });
  }

  public send(msg: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.send({ type: 'ping', clientTime: performance.now() });
    this.pingTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping', clientTime: performance.now() });
      }
    }, 2500);
  }

  private stopPingLoop(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public disconnect(_reason = 'manual'): void {
    this.intentionallyClosed = true;
    this.stopPingLoop();
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}
