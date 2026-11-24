import type { ClientMessage, ServerMessage } from './protocol';

export type NetworkClientEvents = {
  onOpen?: () => void;
  onMessage?: (msg: ServerMessage) => void;
  onClose?: (reason: string) => void;
  onError?: (reason: string) => void;
  onPingUpdate?: (pingMs: number) => void;
};

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

  public static canAttemptOnlineConnection(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
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

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/multiplayer`;

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
