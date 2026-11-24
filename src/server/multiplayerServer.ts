import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  MultiplayerSessionSummary,
  NetworkQualityMode,
  PlayerSkinId,
  ServerRegionId,
  WeaponId,
} from '../game/types.ts';
import {
  DEFAULT_MAX_PLAYERS,
  getVehicleSeatCount,
  INTEREST_MAX_RADIUS,
  isValidWorldPosition,
  MAX_ALLOWED_PLAYERS,
  quantize,
  SAFE_MULTIPLAYER_SPAWNS,
  sanitizePlayerName,
  sanitizeSessionCode,
  sanitizeSessionName,
} from '../game/multiplayer/protocol.ts';
import type {
  ClientMessage,
  RemotePlayerState,
  ServerMessage,
  SharedVehicleState,
} from '../game/multiplayer/protocol.ts';

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  sessionId: string | null;
  playerNumber: number;
  quality: NetworkQualityMode;
  lastPacketAt: number;
  packetsInWindow: number;
  windowStart: number;
}

interface ServerSession {
  id: string;
  code: string;
  name: string;
  region: ServerRegionId;
  maxPlayers: number;
  nextPlayerSeq: number;
  players: Map<string, RemotePlayerState>;
  vehicles: Map<string, SharedVehicleState>;
  clients: Map<string, ConnectedClient>;
  createdAt: number;
}

const MAX_SPEED_MPS_BY_ANIM = 135; // covers hypercars & airplanes smoothly
const ALLOWED_REGIONS: ServerRegionId[] = ['auto', 'me_eu', 'us_east', 'asia'];

export class CityWorldMultiplayerServer {
  private sessions = new Map<string, ServerSession>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private wss: WebSocketServer;
  private broadcastTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
    this.setupWebSocketHandlers();
    // Pre-create one default public lobby room so players can jump right in or create their own
    this.createSessionInternal('CityWorld Public #1', DEFAULT_MAX_PLAYERS, 'auto', 'CW1001');
    this.broadcastTimer = setInterval(() => this.broadcastSnapshots(), 66); // ~15Hz authoritative world tick
  }

  public attachToHttpServer(httpServer: HttpServer): void {
    httpServer.on('upgrade', (req, socket, head) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname !== '/ws/multiplayer') {
          return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      } catch {
        socket.destroy();
      }
    });
  }

  public registerRoutes(app: Express): void {
    app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        ok: true,
        service: 'CityWorld Online Server',
        sessions: this.sessions.size,
        players: this.countOnlinePlayers(),
        serverTime: Date.now(),
      });
    });

    app.get('/api/multiplayer/sessions', (_req: Request, res: Response) => {
      res.json({
        ok: true,
        sessions: this.listSessionSummaries(),
        serverTime: Date.now(),
      });
    });
  }

  public dispose(): void {
    clearInterval(this.broadcastTimer);
    this.wss.close();
  }

  private countOnlinePlayers(): number {
    let total = 0;
    for (const s of this.sessions.values()) total += s.players.size;
    return total;
  }

  private listSessionSummaries(): MultiplayerSessionSummary[] {
    const list: MultiplayerSessionSummary[] = [];
    for (const s of this.sessions.values()) {
      list.push({
        id: s.id,
        code: s.code,
        name: s.name,
        region: s.region,
        playerCount: s.players.size,
        maxPlayers: s.maxPlayers,
      });
    }
    list.sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name));
    return list;
  }

  private generateSessionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!this.findSessionByCode(code)) return code;
    }
    return `CW${Math.floor(1000 + Math.random() * 8999)}`;
  }

  private findSessionByCode(code: string): ServerSession | undefined {
    const clean = sanitizeSessionCode(code);
    for (const s of this.sessions.values()) {
      if (s.code === clean) return s;
    }
    return undefined;
  }

  private createSessionInternal(
    nameRaw: unknown,
    maxPlayersRaw: unknown,
    regionRaw: unknown,
    fixedCode?: string
  ): ServerSession {
    const name = sanitizeSessionName(nameRaw);
    const maxParsed = Number(maxPlayersRaw);
    const maxPlayers = Number.isFinite(maxParsed)
      ? Math.max(2, Math.min(MAX_ALLOWED_PLAYERS, Math.round(maxParsed)))
      : DEFAULT_MAX_PLAYERS;
    const region: ServerRegionId = ALLOWED_REGIONS.includes(regionRaw as ServerRegionId)
      ? (regionRaw as ServerRegionId)
      : 'auto';
    const id = `sess_${randomUUID().slice(0, 8)}`;
    const code = fixedCode ?? this.generateSessionCode();

    const session: ServerSession = {
      id,
      code,
      name,
      region,
      maxPlayers,
      nextPlayerSeq: 1,
      players: new Map(),
      vehicles: new Map(),
      clients: new Map(),
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const client: ConnectedClient = {
        ws,
        playerId: `p_${randomUUID().slice(0, 10)}`,
        sessionId: null,
        playerNumber: 0,
        quality: 'medium',
        lastPacketAt: Date.now(),
        packetsInWindow: 0,
        windowStart: Date.now(),
      };
      this.clients.set(ws, client);

      ws.on('message', (data) => {
        const now = Date.now();
        if (now - client.windowStart > 1000) {
          client.windowStart = now;
          client.packetsInWindow = 0;
        }
        client.packetsInWindow++;
        if (client.packetsInWindow > 75) {
          return; // gentle rate limit without disconnecting normal play
        }

        let msg: ClientMessage;
        try {
          msg = JSON.parse(String(data)) as ClientMessage;
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
        this.handleClientMessage(client, msg, now);
      });

      ws.on('close', () => {
        this.removeClientFromSession(client);
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.removeClientFromSession(client);
        this.clients.delete(ws);
      });
    });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastToSession(session: ServerSession, msg: ServerMessage, excludePlayerId?: string): void {
    const raw = JSON.stringify(msg);
    for (const c of session.clients.values()) {
      if (excludePlayerId && c.playerId === excludePlayerId) continue;
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
  }

  private isNameTakenInSession(session: ServerSession, candidate: string, excludePlayerId?: string): boolean {
    const lower = candidate.toLowerCase();
    for (const p of session.players.values()) {
      if (excludePlayerId && p.id === excludePlayerId) continue;
      if (p.name.toLowerCase() === lower) return true;
    }
    return false;
  }

  private assignNextSequentialName(session: ServerSession): { name: string; seq: number } {
    while (true) {
      const seq = session.nextPlayerSeq++;
      const candidate = `Player ${seq}`;
      if (!this.isNameTakenInSession(session, candidate)) {
        return { name: candidate, seq };
      }
    }
  }

  private pickSafeSpawn(session: ServerSession): (typeof SAFE_MULTIPLAYER_SPAWNS)[number] {
    let best = SAFE_MULTIPLAYER_SPAWNS[0];
    let bestMinDist = -1;
    for (const sp of SAFE_MULTIPLAYER_SPAWNS) {
      let nearest = Infinity;
      for (const p of session.players.values()) {
        const d = Math.hypot(p.x - sp.x, p.z - sp.z);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestMinDist) {
        bestMinDist = nearest;
        best = sp;
      }
    }
    // Small anti-overlap jitter if many players share plaza
    const jitterAngle = (session.players.size * 2.399) % (Math.PI * 2);
    const jitterR = session.players.size === 0 ? 0 : 2.2;
    return {
      ...best,
      x: quantize(best.x + Math.cos(jitterAngle) * jitterR, 2),
      z: quantize(best.z + Math.sin(jitterAngle) * jitterR, 2),
    };
  }

  private handleClientMessage(client: ConnectedClient, msg: ClientMessage, now: number): void {
    switch (msg.type) {
      case 'ping': {
        this.send(client.ws, {
          type: 'pong',
          clientTime: Number(msg.clientTime) || now,
          serverTime: now,
        });
        return;
      }

      case 'create_session': {
        this.removeClientFromSession(client);
        const session = this.createSessionInternal(msg.sessionName, msg.maxPlayers, msg.region);
        this.admitClientToSession(client, session, msg.customName, msg.skinId, msg.weaponId);
        return;
      }

      case 'join_session': {
        this.removeClientFromSession(client);
        let session: ServerSession | undefined;
        if (msg.sessionId && typeof msg.sessionId === 'string') {
          session = this.sessions.get(msg.sessionId);
        } else if (msg.sessionCode && typeof msg.sessionCode === 'string') {
          session = this.findSessionByCode(msg.sessionCode);
        } else {
          // Pick first non-full session
          for (const s of this.sessions.values()) {
            if (s.players.size < s.maxPlayers) {
              session = s;
              break;
            }
          }
          if (!session) {
            session = this.createSessionInternal('CityWorld Public', DEFAULT_MAX_PLAYERS, 'auto');
          }
        }

        if (!session) {
          this.send(client.ws, {
            type: 'error_notice',
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found or expired.',
          });
          return;
        }
        if (session.players.size >= session.maxPlayers) {
          this.send(client.ws, {
            type: 'error_notice',
            code: 'SESSION_FULL',
            message: 'Session is full.',
          });
          return;
        }
        this.admitClientToSession(client, session, msg.customName, msg.skinId, msg.weaponId);
        return;
      }

      case 'leave_session': {
        this.removeClientFromSession(client);
        this.send(client.ws, { type: 'session_left' });
        return;
      }

      case 'set_net_quality': {
        if (msg.quality === 'low' || msg.quality === 'medium' || msg.quality === 'high') {
          client.quality = msg.quality;
        }
        return;
      }

      default:
        break;
    }

    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    if (!session) return;
    const player = session.players.get(client.playerId);
    if (!player) return;

    if (msg.type === 'name_change') {
      const cleaned = sanitizePlayerName(msg.name);
      if (!cleaned) {
        const autoName = `Player ${client.playerNumber}`;
        player.name = this.isNameTakenInSession(session, autoName, player.id)
          ? this.assignNextSequentialName(session).name
          : autoName;
        player.isCustomName = false;
      } else {
        let finalName = cleaned;
        if (this.isNameTakenInSession(session, finalName, player.id)) {
          finalName = `${cleaned.slice(0, 14)}#${client.playerNumber}`;
        }
        player.name = finalName;
        player.isCustomName = true;
      }
      this.broadcastToSession(session, {
        type: 'player_renamed',
        playerId: player.id,
        name: player.name,
        isCustomName: player.isCustomName,
      });
      return;
    }

    if (msg.type === 'player_state') {
      if (!isValidWorldPosition(msg.x, msg.y, msg.z)) {
        this.send(client.ws, {
          type: 'player_correction',
          x: player.x,
          y: player.y,
          z: player.z,
          reason: 'out_of_bounds',
        });
        return;
      }

      const elapsed = Math.max(0.03, (now - player.updatedAt) / 1000);
      const dist = Math.hypot(msg.x - player.x, msg.z - player.z);
      const impliedSpeed = dist / elapsed;
      // Allow reasonable burst / legitimate house teleport only if <= max aircraft speed + tolerance
      if (impliedSpeed > MAX_SPEED_MPS_BY_ANIM && dist > 18) {
        // Check if player just teleported? Reject impossible micro-warps > 240 m/s
        if (impliedSpeed > 260 && dist < 380) {
          this.send(client.ws, {
            type: 'player_correction',
            x: player.x,
            y: player.y,
            z: player.z,
            reason: 'speed_limit',
          });
          return;
        }
      }

      player.x = quantize(msg.x, 2);
      player.y = quantize(msg.y, 2);
      player.z = quantize(msg.z, 2);
      player.vx = quantize(Number.isFinite(msg.vx) ? msg.vx : 0, 2);
      player.vz = quantize(Number.isFinite(msg.vz) ? msg.vz : 0, 2);
      player.heading = quantize(Number.isFinite(msg.heading) ? msg.heading : 0, 3);
      player.skinId = msg.skinId || player.skinId;
      player.weaponId = msg.weaponId || 'fists';
      player.animState = msg.animState || 'idle';
      player.updatedAt = now;
      return;
    }

    if (msg.type === 'vehicle_enter') {
      this.handleVehicleEnter(session, player, msg, client.ws, now);
      return;
    }

    if (msg.type === 'vehicle_exit') {
      this.handleVehicleExit(session, player, msg, now);
      return;
    }

    if (msg.type === 'vehicle_state') {
      const veh = session.vehicles.get(msg.vehicleId);
      if (!veh) return;
      // Server-authoritative check: ONLY the assigned driver (seat 0) may move the vehicle!
      if (veh.driverId !== player.id || veh.seats[0] !== player.id) {
        return;
      }
      if (!isValidWorldPosition(msg.x, msg.y, msg.z)) return;

      veh.x = quantize(msg.x, 2);
      veh.y = quantize(msg.y, 2);
      veh.z = quantize(msg.z, 2);
      veh.vx = quantize(msg.vx, 2);
      veh.vz = quantize(msg.vz, 2);
      veh.heading = quantize(msg.heading, 3);
      veh.pitch = quantize(msg.pitch, 3);
      veh.roll = quantize(msg.roll, 3);
      veh.steerAngle = quantize(msg.steerAngle, 3);
      veh.forwardSpeed = quantize(msg.forwardSpeed, 2);
      veh.hp = Math.max(0, Math.min(100, Math.round(msg.hp)));
      veh.headlightsOn = Boolean(msg.headlightsOn);
      veh.turnSignal = msg.turnSignal === -1 || msg.turnSignal === 1 ? msg.turnSignal : 0;
      veh.wingsDeployed = Boolean(msg.wingsDeployed);
      veh.wingProgress = quantize(Math.max(0, Math.min(1, msg.wingProgress)), 2);
      veh.updatedAt = now;

      // Also keep passenger coordinates anchored near vehicle server-side
      for (const occupantId of veh.seats) {
        if (!occupantId) continue;
        const occ = session.players.get(occupantId);
        if (occ) {
          occ.x = veh.x;
          occ.y = veh.y;
          occ.z = veh.z;
          occ.heading = veh.heading;
          occ.updatedAt = now;
        }
      }
      return;
    }

    if (msg.type === 'world_event') {
      if (!isValidWorldPosition(msg.x, msg.y, msg.z)) return;
      this.broadcastToSession(
        session,
        {
          type: 'world_event',
          playerId: player.id,
          event: msg.event,
          x: quantize(msg.x, 2),
          y: quantize(msg.y, 2),
          z: quantize(msg.z, 2),
          dirX: msg.dirX !== undefined ? quantize(msg.dirX, 3) : undefined,
          dirY: msg.dirY !== undefined ? quantize(msg.dirY, 3) : undefined,
          dirZ: msg.dirZ !== undefined ? quantize(msg.dirZ, 3) : undefined,
          weaponId: msg.weaponId,
        },
        player.id
      );
    }
  }

  private admitClientToSession(
    client: ConnectedClient,
    session: ServerSession,
    customNameRaw?: string,
    skinId?: PlayerSkinId,
    weaponId?: WeaponId
  ): void {
    const seqAssign = this.assignNextSequentialName(session);
    client.sessionId = session.id;
    client.playerNumber = seqAssign.seq;

    const cleanedCustom = sanitizePlayerName(customNameRaw);
    let finalName = seqAssign.name;
    let isCustomName = false;
    if (cleanedCustom) {
      finalName = this.isNameTakenInSession(session, cleanedCustom)
        ? `${cleanedCustom.slice(0, 14)}#${seqAssign.seq}`
        : cleanedCustom;
      isCustomName = true;
    }

    const spawn = this.pickSafeSpawn(session);
    const now = Date.now();
    const playerState: RemotePlayerState = {
      id: client.playerId,
      name: finalName,
      isCustomName,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vz: 0,
      heading: spawn.heading,
      skinId: skinId ?? 'classic',
      weaponId: weaponId ?? 'fists',
      animState: 'idle',
      vehicleId: null,
      seatIndex: -1,
      updatedAt: now,
    };

    session.players.set(client.playerId, playerState);
    session.clients.set(client.playerId, client);

    const summary: MultiplayerSessionSummary = {
      id: session.id,
      code: session.code,
      name: session.name,
      region: session.region,
      playerCount: session.players.size,
      maxPlayers: session.maxPlayers,
    };

    this.send(client.ws, {
      type: 'session_joined',
      playerId: playerState.id,
      playerName: playerState.name,
      isCustomName: playerState.isCustomName,
      spawn,
      session: summary,
      players: Array.from(session.players.values()),
      vehicles: Array.from(session.vehicles.values()),
      serverTime: now,
    });

    this.broadcastToSession(
      session,
      {
        type: 'player_joined',
        player: playerState,
        playerCount: session.players.size,
      },
      playerState.id
    );
  }

  private handleVehicleEnter(
    session: ServerSession,
    player: RemotePlayerState,
    msg: Extract<ClientMessage, { type: 'vehicle_enter' }>,
    ws: WebSocket,
    now: number
  ): void {
    // Clean any old seat first
    if (player.vehicleId) {
      this.vacateSeat(session, player, now);
    }

    if (!msg.vehicleId || !isValidWorldPosition(msg.x, msg.y, msg.z)) {
      this.send(ws, {
        type: 'vehicle_seat_result',
        ok: false,
        vehicleId: String(msg.vehicleId || ''),
        seatIndex: -1,
        role: 'none',
        reason: 'invalid_vehicle',
      });
      return;
    }

    let veh = session.vehicles.get(msg.vehicleId);
    if (!veh) {
      const seatCount = getVehicleSeatCount(msg.classId);
      const seats: Array<string | null> = new Array(seatCount).fill(null);
      seats[0] = player.id;
      veh = {
        id: msg.vehicleId,
        classId: msg.classId,
        colorHex: Number.isFinite(msg.colorHex) ? msg.colorHex : 0x3b82f6,
        x: quantize(msg.x, 2),
        y: quantize(msg.y, 2),
        z: quantize(msg.z, 2),
        vx: 0,
        vz: 0,
        heading: quantize(msg.heading, 3),
        pitch: 0,
        roll: 0,
        steerAngle: 0,
        forwardSpeed: 0,
        hp: Math.max(10, Math.min(100, Math.round(msg.hp || 100))),
        headlightsOn: false,
        turnSignal: 0,
        wingsDeployed: false,
        wingProgress: 0,
        driverId: player.id,
        seats,
        updatedAt: now,
      };
      session.vehicles.set(veh.id, veh);
      player.vehicleId = veh.id;
      player.seatIndex = 0;
      player.animState =
        veh.classId === 'bicycle' || veh.classId === 'speed_bicycle' || veh.classId === 'motorcycle'
          ? 'bike'
          : 'drive';

      this.send(ws, {
        type: 'vehicle_seat_result',
        ok: true,
        vehicleId: veh.id,
        seatIndex: 0,
        role: 'driver',
        vehicle: veh,
      });
      return;
    }

    // Assign driver seat 0 if vacant, else next open passenger seat 1..N
    let assignedSeat = -1;
    for (let i = 0; i < veh.seats.length; i++) {
      if (!veh.seats[i] || !session.players.has(veh.seats[i] as string)) {
        assignedSeat = i;
        break;
      }
    }

    if (assignedSeat === -1) {
      this.send(ws, {
        type: 'vehicle_seat_result',
        ok: false,
        vehicleId: veh.id,
        seatIndex: -1,
        role: 'none',
        reason: 'full',
        vehicle: veh,
      });
      return;
    }

    veh.seats[assignedSeat] = player.id;
    if (assignedSeat === 0) {
      veh.driverId = player.id;
    }
    veh.updatedAt = now;
    player.vehicleId = veh.id;
    player.seatIndex = assignedSeat;
    player.animState =
      assignedSeat === 0
        ? veh.classId === 'bicycle' || veh.classId === 'speed_bicycle' || veh.classId === 'motorcycle'
          ? 'bike'
          : 'drive'
        : 'passenger';

    this.send(ws, {
      type: 'vehicle_seat_result',
      ok: true,
      vehicleId: veh.id,
      seatIndex: assignedSeat,
      role: assignedSeat === 0 ? 'driver' : 'passenger',
      vehicle: veh,
    });
  }

  private handleVehicleExit(
    session: ServerSession,
    player: RemotePlayerState,
    msg: Extract<ClientMessage, { type: 'vehicle_exit' }>,
    now: number
  ): void {
    this.vacateSeat(session, player, now);
    if (isValidWorldPosition(msg.x, msg.y, msg.z)) {
      player.x = quantize(msg.x, 2);
      player.y = quantize(msg.y, 2);
      player.z = quantize(msg.z, 2);
    }
    player.animState = 'idle';
    player.updatedAt = now;
  }

  private vacateSeat(session: ServerSession, player: RemotePlayerState, now: number): void {
    if (!player.vehicleId) return;
    const veh = session.vehicles.get(player.vehicleId);
    if (veh) {
      for (let i = 0; i < veh.seats.length; i++) {
        if (veh.seats[i] === player.id) {
          veh.seats[i] = null;
        }
      }
      if (veh.driverId === player.id) {
        veh.driverId = null;
        veh.vx = 0;
        veh.vz = 0;
        veh.forwardSpeed = 0;
      }
      veh.updatedAt = now;
      const anyLeft = veh.seats.some((id) => Boolean(id && session.players.has(id)));
      if (!anyLeft && veh.id.startsWith('mp_')) {
        session.vehicles.delete(veh.id);
        this.broadcastToSession(session, { type: 'vehicle_removed', vehicleId: veh.id });
      }
    }
    player.vehicleId = null;
    player.seatIndex = -1;
  }

  private removeClientFromSession(client: ConnectedClient): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    client.sessionId = null;
    if (!session) return;

    const player = session.players.get(client.playerId);
    if (player) {
      this.vacateSeat(session, player, Date.now());
      session.players.delete(client.playerId);
    }
    session.clients.delete(client.playerId);

    this.broadcastToSession(session, {
      type: 'player_left',
      playerId: client.playerId,
      playerCount: session.players.size,
    });

    // Keep public default room CW1001 alive; remove empty private custom rooms
    if (session.players.size === 0 && session.code !== 'CW1001') {
      this.sessions.delete(session.id);
    }
  }

  private broadcastSnapshots(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.clients.size === 0) continue;

      const allPlayers = Array.from(session.players.values());
      const allVehicles = Array.from(session.vehicles.values());

      for (const client of session.clients.values()) {
        if (client.ws.readyState !== WebSocket.OPEN) continue;
        const self = session.players.get(client.playerId);
        if (!self) continue;

        // Low network quality sends snapshots every 2nd tick (~7.5-10Hz), medium/high every tick (~15Hz)
        if (client.quality === 'low' && Math.floor(now / 66) % 2 === 1) continue;

        const visiblePlayers = allPlayers.filter((p) => {
          if (p.id === self.id) return false;
          const d = Math.hypot(p.x - self.x, p.z - self.z);
          return d <= INTEREST_MAX_RADIUS;
        });

        const msg: ServerMessage = {
          type: 'world_snapshot',
          serverTime: now,
          sessionPlayerCount: session.players.size,
          players: visiblePlayers,
          vehicles: allVehicles,
        };
        client.ws.send(JSON.stringify(msg));
      }
    }
  }
}
