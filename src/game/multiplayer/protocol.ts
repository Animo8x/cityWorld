import type {
  MultiplayerSessionSummary,
  NetworkQualityMode,
  PlayerSkinId,
  ServerRegionId,
  VehicleClassId,
  WeaponId,
} from '../types.ts';

export const DEFAULT_MAX_PLAYERS = 8;
export const MAX_ALLOWED_PLAYERS = 24;
export const INTEREST_FULL_RATE_RADIUS = 320;
export const INTEREST_MAX_RADIUS = 1600;

// Covers Mainland CityWorld, Palm Cove Island, and Auroria Rich Country
export const MP_WORLD_MIN_X = -750;
export const MP_WORLD_MAX_X = 1350;
export const MP_WORLD_MIN_Z = -700;
export const MP_WORLD_MAX_Z = 1400;
export const MP_WORLD_MIN_Y = -20;
export const MP_WORLD_MAX_Y = 380;

export type RemoteAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'swim'
  | 'drive'
  | 'passenger'
  | 'bike';

export interface SeatLocalOffset {
  x: number;
  y: number;
  z: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  isCustomName: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  skinId: PlayerSkinId;
  weaponId: WeaponId;
  animState: RemoteAnimState;
  vehicleId: string | null;
  seatIndex: number;
  updatedAt: number;
}

export interface SharedVehicleState {
  id: string;
  classId: VehicleClassId;
  colorHex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  pitch: number;
  roll: number;
  steerAngle: number;
  forwardSpeed: number;
  hp: number;
  headlightsOn: boolean;
  turnSignal: -1 | 0 | 1;
  wingsDeployed: boolean;
  wingProgress: number;
  driverId: string | null;
  seats: Array<string | null>;
  updatedAt: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  heading: number;
  label: string;
}

// Open sidewalk / plaza coordinates verified clear of building colliders and deep water
export const SAFE_MULTIPLAYER_SPAWNS: SpawnPoint[] = [
  { x: 0, y: 0.05, z: -22, heading: Math.PI, label: 'Downtown Plaza' },
  { x: -18, y: 0.05, z: -22, heading: Math.PI, label: 'Downtown West' },
  { x: 22, y: 0.05, z: -22, heading: Math.PI, label: 'Downtown East' },
  { x: 0, y: 0.05, z: 24, heading: 0, label: 'Central Boulevard' },
  { x: -115, y: 0.05, z: 15, heading: Math.PI * 0.5, label: 'Shopping Promenade' },
  { x: 115, y: 0.05, z: -18, heading: -Math.PI * 0.5, label: 'Midtown Cross' },
  { x: 0, y: 0.05, z: -145, heading: 0, label: 'Civic Park South' },
  { x: -135, y: 0.05, z: 145, heading: Math.PI * 0.25, label: 'Harbor Boardwalk' },
  { x: 280, y: 0.05, z: -195, heading: Math.PI, label: 'Skyline Terminal' },
  { x: 805, y: 0.05, z: -120, heading: -Math.PI * 0.5, label: 'Auroria Golden Plaza' },
];

const SEAT_LAYOUT_1: SeatLocalOffset[] = [{ x: 0, y: 0.65, z: -0.08 }];
const SEAT_LAYOUT_2_BIKE: SeatLocalOffset[] = [
  { x: 0, y: 0.72, z: -0.05 },
  { x: 0, y: 0.76, z: -0.62 },
];
const SEAT_LAYOUT_2_COUPE: SeatLocalOffset[] = [
  { x: -0.42, y: 0.45, z: 0.05 },
  { x: 0.42, y: 0.45, z: 0.05 },
];
const SEAT_LAYOUT_2_AIRPLANE: SeatLocalOffset[] = [
  { x: -0.35, y: 0.72, z: 0.45 },
  { x: 0.35, y: 0.72, z: 0.45 },
];
const SEAT_LAYOUT_4_SEDAN: SeatLocalOffset[] = [
  { x: -0.44, y: 0.48, z: 0.16 },
  { x: 0.44, y: 0.48, z: 0.16 },
  { x: -0.44, y: 0.48, z: -0.78 },
  { x: 0.44, y: 0.48, z: -0.78 },
];
const SEAT_LAYOUT_4_SUV: SeatLocalOffset[] = [
  { x: -0.48, y: 0.62, z: 0.25 },
  { x: 0.48, y: 0.62, z: 0.25 },
  { x: -0.48, y: 0.62, z: -0.82 },
  { x: 0.48, y: 0.62, z: -0.82 },
];
const SEAT_LAYOUT_6_BUS: SeatLocalOffset[] = [
  { x: -0.62, y: 0.9, z: 2.3 },
  { x: 0.62, y: 0.9, z: 2.3 },
  { x: -0.62, y: 0.9, z: 0.4 },
  { x: 0.62, y: 0.9, z: 0.4 },
  { x: -0.62, y: 0.9, z: -1.6 },
  { x: 0.62, y: 0.9, z: -1.6 },
];

export function getVehicleSeatOffsets(classId: VehicleClassId): SeatLocalOffset[] {
  if (classId === 'bicycle' || classId === 'speed_bicycle') return SEAT_LAYOUT_1;
  if (classId === 'motorcycle') return SEAT_LAYOUT_2_BIKE;
  if (classId === 'airplane') return SEAT_LAYOUT_2_AIRPLANE;
  if (classId === 'bus') return SEAT_LAYOUT_6_BUS;
  if (
    classId === 'suv' ||
    classId === 'pickup' ||
    classId === 'van' ||
    classId === 'truck' ||
    classId === 'ambulance' ||
    classId === 'sedan' ||
    classId === 'taxi' ||
    classId === 'police'
  ) {
    return classId === 'sedan' || classId === 'taxi' || classId === 'police'
      ? SEAT_LAYOUT_4_SEDAN
      : SEAT_LAYOUT_4_SUV;
  }
  return SEAT_LAYOUT_2_COUPE;
}

export function getVehicleSeatCount(classId: VehicleClassId): number {
  return getVehicleSeatOffsets(classId).length;
}

export function quantize(val: number, decimals = 2): number {
  if (!Number.isFinite(val)) return 0;
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

export function isValidWorldPosition(x: number, y: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(z) &&
    x >= MP_WORLD_MIN_X &&
    x <= MP_WORLD_MAX_X &&
    z >= MP_WORLD_MIN_Z &&
    z <= MP_WORLD_MAX_Z &&
    y >= MP_WORLD_MIN_Y &&
    y <= MP_WORLD_MAX_Y
  );
}

export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[\u0000-\u001F\u007F<>`]/g, '').trim().slice(0, 18);
  return cleaned;
}

export function sanitizeSessionName(raw: unknown): string {
  if (typeof raw !== 'string') return 'CityWorld Room';
  const cleaned = raw.replace(/[\u0000-\u001F\u007F<>`]/g, '').trim().slice(0, 28);
  return cleaned || 'CityWorld Room';
}

export function sanitizeSessionCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

// Client -> Server Messages
export type ClientMessage =
  | {
      type: 'create_session';
      sessionName?: string;
      maxPlayers?: number;
      region?: ServerRegionId;
      customName?: string;
      skinId?: PlayerSkinId;
      weaponId?: WeaponId;
    }
  | {
      type: 'join_session';
      sessionId?: string;
      sessionCode?: string;
      customName?: string;
      skinId?: PlayerSkinId;
      weaponId?: WeaponId;
    }
  | { type: 'leave_session' }
  | {
      type: 'name_change';
      name: string;
    }
  | {
      type: 'player_state';
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      heading: number;
      skinId: PlayerSkinId;
      weaponId: WeaponId;
      animState: RemoteAnimState;
    }
  | {
      type: 'vehicle_enter';
      vehicleId: string;
      classId: VehicleClassId;
      colorHex: number;
      x: number;
      y: number;
      z: number;
      heading: number;
      hp: number;
    }
  | {
      type: 'vehicle_exit';
      vehicleId: string;
      x: number;
      y: number;
      z: number;
    }
  | {
      type: 'vehicle_state';
      vehicleId: string;
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      heading: number;
      pitch: number;
      roll: number;
      steerAngle: number;
      forwardSpeed: number;
      hp: number;
      headlightsOn: boolean;
      turnSignal: -1 | 0 | 1;
      wingsDeployed: boolean;
      wingProgress: number;
    }
  | {
      type: 'world_event';
      event: 'fire' | 'horn' | 'explosion';
      x: number;
      y: number;
      z: number;
      dirX?: number;
      dirY?: number;
      dirZ?: number;
      weaponId?: WeaponId;
    }
  | {
      type: 'set_net_quality';
      quality: NetworkQualityMode;
    }
  | {
      type: 'ping';
      clientTime: number;
    };

// Server -> Client Messages
export type ServerMessage =
  | {
      type: 'session_joined';
      playerId: string;
      playerName: string;
      isCustomName: boolean;
      spawn: SpawnPoint;
      session: MultiplayerSessionSummary;
      players: RemotePlayerState[];
      vehicles: SharedVehicleState[];
      serverTime: number;
    }
  | {
      type: 'session_left';
      reason?: string;
    }
  | {
      type: 'player_joined';
      player: RemotePlayerState;
      playerCount: number;
    }
  | {
      type: 'player_left';
      playerId: string;
      playerCount: number;
    }
  | {
      type: 'player_renamed';
      playerId: string;
      name: string;
      isCustomName: boolean;
    }
  | {
      type: 'player_correction';
      x: number;
      y: number;
      z: number;
      reason: string;
    }
  | {
      type: 'vehicle_seat_result';
      ok: boolean;
      vehicleId: string;
      seatIndex: number;
      role: 'driver' | 'passenger' | 'none';
      reason?: string;
      vehicle?: SharedVehicleState;
    }
  | {
      type: 'vehicle_removed';
      vehicleId: string;
    }
  | {
      type: 'world_snapshot';
      serverTime: number;
      sessionPlayerCount: number;
      players: RemotePlayerState[];
      vehicles: SharedVehicleState[];
    }
  | {
      type: 'world_event';
      playerId: string;
      event: 'fire' | 'horn' | 'explosion';
      x: number;
      y: number;
      z: number;
      dirX?: number;
      dirY?: number;
      dirZ?: number;
      weaponId?: WeaponId;
    }
  | {
      type: 'pong';
      clientTime: number;
      serverTime: number;
    }
  | {
      type: 'error_notice';
      code: string;
      message: string;
    };
