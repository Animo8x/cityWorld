import type {
  MultiplayerSessionSummary,
  NetworkQualityMode,
  PlayerSkinId,
  WeaponId,
} from '../types';
import {
  DEFAULT_MAX_PLAYERS,
  getVehicleSeatCount,
  isValidWorldPosition,
  MAX_ALLOWED_PLAYERS,
  quantize,
  SAFE_MULTIPLAYER_SPAWNS,
  sanitizePlayerName,
  sanitizeSessionName,
} from './protocol';
import type {
  ClientMessage,
  RemotePlayerState,
  ServerMessage,
  SharedVehicleState,
} from './protocol';

export interface P2PUiSnapshot {
  active: boolean;
  role: 'none' | 'host' | 'guest';
  inviteCode: string;
  replyCode: string;
  connectedPeers: number;
  gathering: boolean;
  error: string | null;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encodeSignal(prefix: 'CW1' | 'CW2', payload: unknown): Promise<string> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      await writer.write(jsonBytes);
      await writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return `${prefix}:${bytesToBase64Url(new Uint8Array(buf))}`;
    } catch {
      // Fallback to raw base64url
    }
  }
  return `${prefix}R:${bytesToBase64Url(jsonBytes)}`;
}

async function decodeSignal<T>(raw: string, expectedPrefix: 'CW1' | 'CW2'): Promise<T> {
  const trimmed = raw.trim();
  const isRaw = trimmed.startsWith(`${expectedPrefix}R:`);
  const isGz = trimmed.startsWith(`${expectedPrefix}:`);
  if (!isRaw && !isGz) {
    throw new Error(`Invalid code prefix (expected ${expectedPrefix})`);
  }
  const body = trimmed.slice(isRaw ? 5 : 4);
  const bytes = base64UrlToBytes(body);
  if (isGz && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    await writer.write(bytes as BufferSource);
    await writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(buf)) as T;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 1800): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onState);
      pc.removeEventListener('icecandidate', onCand);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const onCand = (ev: RTCPeerConnectionIceEvent) => {
      if (!ev.candidate) finish();
    };
    pc.addEventListener('icegatheringstatechange', onState);
    pc.addEventListener('icecandidate', onCand);
    window.setTimeout(finish, timeoutMs);
  });
}

interface HostPeerSlot {
  slotId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  playerId: string;
  playerNumber: number;
  quality: NetworkQualityMode;
  connected: boolean;
}

export interface P2PTransportEvents {
  onServerMessage: (msg: ServerMessage) => void;
  onPingUpdate: (pingMs: number) => void;
  onDisconnected: () => void;
  onUiUpdate: () => void;
}

export class P2PNetworkTransport {
  private events: P2PTransportEvents;
  private role: 'none' | 'host' | 'guest' = 'none';
  private inviteCode = '';
  private replyCode = '';
  private gathering = false;
  private lastError: string | null = null;

  // Host state
  private sessionSummary: MultiplayerSessionSummary | null = null;
  private hostPlayerId = 'p_host';
  private nextSeq = 1;
  private players = new Map<string, RemotePlayerState>();
  private vehicles = new Map<string, SharedVehicleState>();
  private peerSlots = new Map<string, HostPeerSlot>();
  private pendingOfferSlot: HostPeerSlot | null = null;
  private snapshotTimer: number | null = null;

  // Guest state
  private guestPc: RTCPeerConnection | null = null;
  private guestDc: RTCDataChannel | null = null;
  private guestPingTimer: number | null = null;
  private pendingGuestJoinInfo: {
    customName?: string;
    skinId: PlayerSkinId;
    weaponId: WeaponId;
    quality: NetworkQualityMode;
  } | null = null;

  public pingMs = 0;

  constructor(events: P2PTransportEvents) {
    this.events = events;
  }

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined';
  }

  public isConnected(): boolean {
    if (this.role === 'host') return this.sessionSummary !== null;
    if (this.role === 'guest') return this.guestDc !== null && this.guestDc.readyState === 'open';
    return false;
  }

  public getUiSnapshot(): P2PUiSnapshot {
    let connectedPeers = 0;
    for (const s of this.peerSlots.values()) {
      if (s.connected) connectedPeers++;
    }
    if (this.role === 'guest' && this.guestDc?.readyState === 'open') {
      connectedPeers = 1;
    }
    return {
      active: this.role !== 'none',
      role: this.role,
      inviteCode: this.inviteCode,
      replyCode: this.replyCode,
      connectedPeers,
      gathering: this.gathering,
      error: this.lastError,
    };
  }

  public async startHostRoom(options: {
    sessionName: string;
    maxPlayers: number;
    customName?: string;
    skinId: PlayerSkinId;
    weaponId: WeaponId;
  }): Promise<{ ok: boolean; inviteCode: string; error?: string }> {
    if (!P2PNetworkTransport.isSupported()) {
      const err = 'WebRTC P2P is not supported in this browser/viewer.';
      this.lastError = err;
      this.events.onUiUpdate();
      return { ok: false, inviteCode: '', error: err };
    }

    this.disconnect();
    this.role = 'host';
    this.lastError = null;
    this.nextSeq = 1;
    this.players.clear();
    this.vehicles.clear();

    const maxP = Math.max(2, Math.min(MAX_ALLOWED_PLAYERS, Math.round(options.maxPlayers || DEFAULT_MAX_PLAYERS)));
    const code = 'P2P' + Math.random().toString(36).slice(2, 5).toUpperCase();
    this.sessionSummary = {
      id: `p2p_${Date.now().toString(36)}`,
      code,
      name: sanitizeSessionName(options.sessionName),
      region: 'auto',
      playerCount: 1,
      maxPlayers: maxP,
    };

    const hostNum = this.nextSeq++;
    const cleanedCustom = sanitizePlayerName(options.customName);
    const hostName = cleanedCustom || `Player ${hostNum}`;
    const spawn = SAFE_MULTIPLAYER_SPAWNS[0];
    const hostPlayer: RemotePlayerState = {
      id: this.hostPlayerId,
      name: hostName,
      isCustomName: Boolean(cleanedCustom),
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vz: 0,
      heading: spawn.heading,
      skinId: options.skinId,
      weaponId: options.weaponId,
      animState: 'idle',
      vehicleId: null,
      seatIndex: -1,
      updatedAt: Date.now(),
    };
    this.players.set(this.hostPlayerId, hostPlayer);

    this.snapshotTimer = window.setInterval(() => this.broadcastSnapshots(), 66);

    // Emit session_joined immediately so Host enters CityWorld Online right away
    this.events.onServerMessage({
      type: 'session_joined',
      playerId: this.hostPlayerId,
      playerName: hostName,
      isCustomName: hostPlayer.isCustomName,
      spawn,
      session: { ...this.sessionSummary },
      players: [hostPlayer],
      vehicles: [],
      serverTime: Date.now(),
    });

    const inv = await this.createNewInviteSlot();
    return { ok: true, inviteCode: inv };
  }

  public async createNewInviteSlot(): Promise<string> {
    if (this.role !== 'host') return '';
    if (this.pendingOfferSlot && !this.pendingOfferSlot.connected) {
      try {
        this.pendingOfferSlot.dc.close();
        this.pendingOfferSlot.pc.close();
      } catch {
        // ignore
      }
      this.peerSlots.delete(this.pendingOfferSlot.slotId);
      this.pendingOfferSlot = null;
    }

    this.gathering = true;
    this.lastError = null;
    this.events.onUiUpdate();

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const dc = pc.createDataChannel('cityworld', { ordered: false, maxRetransmits: 2 });
      const slotId = `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const slot: HostPeerSlot = {
        slotId,
        pc,
        dc,
        playerId: `p_${Math.random().toString(36).slice(2, 10)}`,
        playerNumber: 0,
        quality: 'medium',
        connected: false,
      };
      this.peerSlots.set(slotId, slot);
      this.pendingOfferSlot = slot;
      this.wireHostSlot(slot);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc, 1800);

      const code = await encodeSignal('CW1', { sdp: pc.localDescription });
      this.inviteCode = code;
      this.gathering = false;
      this.events.onUiUpdate();
      return code;
    } catch (err) {
      this.gathering = false;
      this.lastError = err instanceof Error ? err.message : 'Failed to create P2P invite';
      this.events.onUiUpdate();
      return '';
    }
  }

  public async acceptGuestReply(rawReply: string): Promise<{ ok: boolean; error?: string }> {
    if (this.role !== 'host' || !this.pendingOfferSlot) {
      return { ok: false, error: 'No pending invite slot. Generate a new invite code first.' };
    }
    try {
      const payload = await decodeSignal<{ sdp: RTCSessionDescriptionInit }>(rawReply, 'CW2');
      await this.pendingOfferSlot.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      this.lastError = null;
      this.events.onUiUpdate();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid reply code';
      this.lastError = msg;
      this.events.onUiUpdate();
      return { ok: false, error: msg };
    }
  }

  public async joinWithInvite(options: {
    inviteCode: string;
    customName?: string;
    skinId: PlayerSkinId;
    weaponId: WeaponId;
    quality: NetworkQualityMode;
  }): Promise<{ ok: boolean; replyCode: string; error?: string }> {
    if (!P2PNetworkTransport.isSupported()) {
      const err = 'WebRTC P2P is not supported in this browser/viewer.';
      this.lastError = err;
      this.events.onUiUpdate();
      return { ok: false, replyCode: '', error: err };
    }

    this.disconnect();
    this.role = 'guest';
    this.gathering = true;
    this.lastError = null;
    this.pendingGuestJoinInfo = {
      customName: options.customName,
      skinId: options.skinId,
      weaponId: options.weaponId,
      quality: options.quality,
    };
    this.events.onUiUpdate();

    try {
      const payload = await decodeSignal<{ sdp: RTCSessionDescriptionInit }>(options.inviteCode, 'CW1');
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.guestPc = pc;

      pc.ondatachannel = (ev) => {
        this.wireGuestChannel(ev.channel);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.handleGuestDisconnected();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc, 1800);

      const code = await encodeSignal('CW2', { sdp: pc.localDescription });
      this.replyCode = code;
      this.gathering = false;
      this.events.onUiUpdate();
      return { ok: true, replyCode: code };
    } catch (err) {
      this.disconnect();
      const msg = err instanceof Error ? err.message : 'Invalid invite code';
      this.lastError = msg;
      this.events.onUiUpdate();
      return { ok: false, replyCode: '', error: msg };
    }
  }

  public send(msg: ClientMessage): boolean {
    if (this.role === 'host') {
      this.handleHostMessage(this.hostPlayerId, null, msg);
      return true;
    }
    if (this.role === 'guest' && this.guestDc && this.guestDc.readyState === 'open') {
      this.guestDc.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  public disconnect(): void {
    if (this.snapshotTimer !== null) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.guestPingTimer !== null) {
      clearInterval(this.guestPingTimer);
      this.guestPingTimer = null;
    }
    for (const s of this.peerSlots.values()) {
      try {
        s.dc.close();
        s.pc.close();
      } catch {
        // ignore
      }
    }
    this.peerSlots.clear();
    this.pendingOfferSlot = null;

    if (this.guestDc) {
      try {
        this.guestDc.close();
      } catch {
        // ignore
      }
      this.guestDc = null;
    }
    if (this.guestPc) {
      try {
        this.guestPc.close();
      } catch {
        // ignore
      }
      this.guestPc = null;
    }

    this.role = 'none';
    this.sessionSummary = null;
    this.players.clear();
    this.vehicles.clear();
    this.inviteCode = '';
    this.replyCode = '';
    this.gathering = false;
    this.pingMs = 0;
  }

  private wireGuestChannel(dc: RTCDataChannel): void {
    this.guestDc = dc;
    dc.onopen = () => {
      const info = this.pendingGuestJoinInfo;
      if (info) {
        this.send({
          type: 'join_session',
          customName: info.customName || undefined,
          skinId: info.skinId,
          weaponId: info.weaponId,
        });
        this.send({ type: 'set_net_quality', quality: info.quality });
      }
      this.guestPingTimer = window.setInterval(() => {
        if (this.guestDc?.readyState === 'open') {
          this.send({ type: 'ping', clientTime: performance.now() });
        }
      }, 2500);
      this.events.onUiUpdate();
    };
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.type === 'pong') {
          const rtt = Math.max(1, Math.round(performance.now() - msg.clientTime));
          this.pingMs = rtt;
          this.events.onPingUpdate(rtt);
          return;
        }
        this.events.onServerMessage(msg);
      } catch {
        // ignore
      }
    };
    dc.onclose = () => this.handleGuestDisconnected();
    dc.onerror = () => this.handleGuestDisconnected();
  }

  private handleGuestDisconnected(): void {
    if (this.role !== 'guest') return;
    this.disconnect();
    this.events.onDisconnected();
  }

  private wireHostSlot(slot: HostPeerSlot): void {
    slot.dc.onopen = () => {
      slot.connected = true;
      if (this.pendingOfferSlot?.slotId === slot.slotId) {
        this.pendingOfferSlot = null;
        this.inviteCode = '';
      }
      this.events.onUiUpdate();
    };
    slot.dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ClientMessage;
        this.handleHostMessage(slot.playerId, slot, msg);
      } catch {
        // ignore
      }
    };
    const cleanup = () => {
      const wasConnected = slot.connected;
      slot.connected = false;
      this.peerSlots.delete(slot.slotId);
      if (this.pendingOfferSlot?.slotId === slot.slotId) {
        this.pendingOfferSlot = null;
      }
      if (wasConnected) {
        this.removeHostPlayer(slot.playerId);
      }
      this.events.onUiUpdate();
    };
    slot.dc.onclose = cleanup;
    slot.pc.onconnectionstatechange = () => {
      if (slot.pc.connectionState === 'failed' || slot.pc.connectionState === 'closed') {
        cleanup();
      }
    };
  }

  private sendToTarget(slot: HostPeerSlot | null, msg: ServerMessage): void {
    if (!slot) {
      if (msg.type === 'pong') {
        this.pingMs = 1;
        this.events.onPingUpdate(1);
        return;
      }
      this.events.onServerMessage(msg);
      return;
    }
    if (slot.dc.readyState === 'open') {
      slot.dc.send(JSON.stringify(msg));
    }
  }

  private broadcastAll(msg: ServerMessage, excludePlayerId?: string): void {
    const raw = JSON.stringify(msg);
    if (excludePlayerId !== this.hostPlayerId) {
      this.events.onServerMessage(msg);
    }
    for (const s of this.peerSlots.values()) {
      if (!s.connected || s.dc.readyState !== 'open') continue;
      if (excludePlayerId && s.playerId === excludePlayerId) continue;
      s.dc.send(raw);
    }
  }

  private isNameTaken(candidate: string, excludePlayerId?: string): boolean {
    const lower = candidate.toLowerCase();
    for (const p of this.players.values()) {
      if (excludePlayerId && p.id === excludePlayerId) continue;
      if (p.name.toLowerCase() === lower) return true;
    }
    return false;
  }

  private nextSequentialName(): { name: string; seq: number } {
    while (true) {
      const seq = this.nextSeq++;
      const candidate = `Player ${seq}`;
      if (!this.isNameTaken(candidate)) return { name: candidate, seq };
    }
  }

  private pickSpawn(): (typeof SAFE_MULTIPLAYER_SPAWNS)[number] {
    let best = SAFE_MULTIPLAYER_SPAWNS[0];
    let bestDist = -1;
    for (const sp of SAFE_MULTIPLAYER_SPAWNS) {
      let nearest = Infinity;
      for (const p of this.players.values()) {
        const d = Math.hypot(p.x - sp.x, p.z - sp.z);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = sp;
      }
    }
    return {
      ...best,
      x: quantize(best.x + (Math.random() - 0.5) * 3, 2),
      z: quantize(best.z + (Math.random() - 0.5) * 3, 2),
    };
  }

  private removeHostPlayer(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (p.vehicleId) {
      this.vacateSeat(p);
    }
    this.players.delete(playerId);
    if (this.sessionSummary) {
      this.sessionSummary.playerCount = this.players.size;
    }
    this.broadcastAll({
      type: 'player_left',
      playerId,
      playerCount: this.players.size,
    });
  }

  private vacateSeat(player: RemotePlayerState): void {
    if (!player.vehicleId) return;
    const veh = this.vehicles.get(player.vehicleId);
    if (veh) {
      for (let i = 0; i < veh.seats.length; i++) {
        if (veh.seats[i] === player.id) veh.seats[i] = null;
      }
      if (veh.driverId === player.id) {
        veh.driverId = null;
        veh.vx = 0;
        veh.vz = 0;
        veh.forwardSpeed = 0;
      }
      const anyLeft = veh.seats.some((id) => Boolean(id && this.players.has(id)));
      if (!anyLeft && veh.id.startsWith('mp_')) {
        this.vehicles.delete(veh.id);
        this.broadcastAll({ type: 'vehicle_removed', vehicleId: veh.id });
      }
    }
    player.vehicleId = null;
    player.seatIndex = -1;
  }

  private handleHostMessage(playerId: string, slot: HostPeerSlot | null, msg: ClientMessage): void {
    const now = Date.now();
    if (msg.type === 'ping') {
      this.sendToTarget(slot, { type: 'pong', clientTime: msg.clientTime, serverTime: now });
      return;
    }

    if (msg.type === 'join_session' && slot && this.sessionSummary) {
      if (this.players.size >= this.sessionSummary.maxPlayers) {
        this.sendToTarget(slot, { type: 'error_notice', code: 'SESSION_FULL', message: 'Room is full.' });
        return;
      }
      const seqAssign = this.nextSequentialName();
      slot.playerNumber = seqAssign.seq;
      const cleanedCustom = sanitizePlayerName(msg.customName);
      let finalName = seqAssign.name;
      let isCustom = false;
      if (cleanedCustom) {
        finalName = this.isNameTaken(cleanedCustom)
          ? `${cleanedCustom.slice(0, 14)}#${seqAssign.seq}`
          : cleanedCustom;
        isCustom = true;
      }
      const spawn = this.pickSpawn();
      const playerState: RemotePlayerState = {
        id: playerId,
        name: finalName,
        isCustomName: isCustom,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        vx: 0,
        vz: 0,
        heading: spawn.heading,
        skinId: msg.skinId ?? 'classic',
        weaponId: msg.weaponId ?? 'fists',
        animState: 'idle',
        vehicleId: null,
        seatIndex: -1,
        updatedAt: now,
      };
      this.players.set(playerId, playerState);
      this.sessionSummary.playerCount = this.players.size;

      this.sendToTarget(slot, {
        type: 'session_joined',
        playerId,
        playerName: playerState.name,
        isCustomName: playerState.isCustomName,
        spawn,
        session: { ...this.sessionSummary },
        players: Array.from(this.players.values()),
        vehicles: Array.from(this.vehicles.values()),
        serverTime: now,
      });

      this.broadcastAll(
        {
          type: 'player_joined',
          player: playerState,
          playerCount: this.players.size,
        },
        playerId
      );
      return;
    }

    if (msg.type === 'set_net_quality' && slot) {
      slot.quality = msg.quality;
      return;
    }

    if (msg.type === 'leave_session' && slot) {
      this.removeHostPlayer(playerId);
      this.sendToTarget(slot, { type: 'session_left' });
      return;
    }

    const player = this.players.get(playerId);
    if (!player) return;

    if (msg.type === 'name_change') {
      const cleaned = sanitizePlayerName(msg.name);
      if (!cleaned) {
        const num = slot ? slot.playerNumber : 1;
        player.name = `Player ${num}`;
        player.isCustomName = false;
      } else {
        player.name = this.isNameTaken(cleaned, playerId)
          ? `${cleaned.slice(0, 14)}#${slot?.playerNumber ?? 1}`
          : cleaned;
        player.isCustomName = true;
      }
      this.broadcastAll({
        type: 'player_renamed',
        playerId,
        name: player.name,
        isCustomName: player.isCustomName,
      });
      return;
    }

    if (msg.type === 'player_state') {
      if (!isValidWorldPosition(msg.x, msg.y, msg.z)) return;
      player.x = quantize(msg.x, 2);
      player.y = quantize(msg.y, 2);
      player.z = quantize(msg.z, 2);
      player.vx = quantize(msg.vx, 2);
      player.vz = quantize(msg.vz, 2);
      player.heading = quantize(msg.heading, 3);
      player.skinId = msg.skinId || player.skinId;
      player.weaponId = msg.weaponId || 'fists';
      player.animState = msg.animState || 'idle';
      player.updatedAt = now;
      return;
    }

    if (msg.type === 'vehicle_enter') {
      if (player.vehicleId) this.vacateSeat(player);
      if (!msg.vehicleId || !isValidWorldPosition(msg.x, msg.y, msg.z)) return;

      let veh = this.vehicles.get(msg.vehicleId);
      if (!veh) {
        const seats = new Array<string | null>(getVehicleSeatCount(msg.classId)).fill(null);
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
        this.vehicles.set(veh.id, veh);
        player.vehicleId = veh.id;
        player.seatIndex = 0;
        this.sendToTarget(slot, {
          type: 'vehicle_seat_result',
          ok: true,
          vehicleId: veh.id,
          seatIndex: 0,
          role: 'driver',
          vehicle: veh,
        });
        return;
      }

      let assigned = -1;
      for (let i = 0; i < veh.seats.length; i++) {
        if (!veh.seats[i] || !this.players.has(veh.seats[i] as string)) {
          assigned = i;
          break;
        }
      }
      if (assigned === -1) {
        this.sendToTarget(slot, {
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

      veh.seats[assigned] = player.id;
      if (assigned === 0) veh.driverId = player.id;
      player.vehicleId = veh.id;
      player.seatIndex = assigned;
      this.sendToTarget(slot, {
        type: 'vehicle_seat_result',
        ok: true,
        vehicleId: veh.id,
        seatIndex: assigned,
        role: assigned === 0 ? 'driver' : 'passenger',
        vehicle: veh,
      });
      return;
    }

    if (msg.type === 'vehicle_exit') {
      this.vacateSeat(player);
      if (isValidWorldPosition(msg.x, msg.y, msg.z)) {
        player.x = quantize(msg.x, 2);
        player.y = quantize(msg.y, 2);
        player.z = quantize(msg.z, 2);
      }
      player.animState = 'idle';
      player.updatedAt = now;
      return;
    }

    if (msg.type === 'vehicle_state') {
      const veh = this.vehicles.get(msg.vehicleId);
      if (!veh || veh.driverId !== player.id) return;
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
      return;
    }

    if (msg.type === 'world_event') {
      if (!isValidWorldPosition(msg.x, msg.y, msg.z)) return;
      this.broadcastAll(
        {
          type: 'world_event',
          playerId,
          event: msg.event,
          x: quantize(msg.x, 2),
          y: quantize(msg.y, 2),
          z: quantize(msg.z, 2),
          dirX: msg.dirX !== undefined ? quantize(msg.dirX, 3) : undefined,
          dirY: msg.dirY !== undefined ? quantize(msg.dirY, 3) : undefined,
          dirZ: msg.dirZ !== undefined ? quantize(msg.dirZ, 3) : undefined,
          weaponId: msg.weaponId,
        },
        playerId
      );
    }
  }

  private broadcastSnapshots(): void {
    if (this.role !== 'host' || !this.sessionSummary) return;
    const now = Date.now();
    const allPlayers = Array.from(this.players.values());
    const allVehicles = Array.from(this.vehicles.values());

    // Deliver snapshot to Host (exclude host player itself)
    this.events.onServerMessage({
      type: 'world_snapshot',
      serverTime: now,
      sessionPlayerCount: this.players.size,
      players: allPlayers.filter((p) => p.id !== this.hostPlayerId),
      vehicles: allVehicles,
    });

    // Deliver snapshot to each connected WebRTC peer
    for (const slot of this.peerSlots.values()) {
      if (!slot.connected || slot.dc.readyState !== 'open') continue;
      if (slot.quality === 'low' && Math.floor(now / 66) % 2 === 1) continue;
      slot.dc.send(
        JSON.stringify({
          type: 'world_snapshot',
          serverTime: now,
          sessionPlayerCount: this.players.size,
          players: allPlayers.filter((p) => p.id !== slot.playerId),
          vehicles: allVehicles,
        } satisfies ServerMessage)
      );
    }
  }
}
