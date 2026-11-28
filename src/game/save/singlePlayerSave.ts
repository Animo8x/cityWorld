import { WEAPON_CATALOG } from '../combat/weaponSystem';
import { MISSION_REGISTRY } from '../missions/missionSystem';
import { PLAYER_SKINS } from '../player/skinCatalog';
import {
  PlayerSkinId,
  QualityMode,
  VehicleClassId,
  WeaponId,
  WeatherType,
} from '../types';
import { VEHICLE_CATALOG } from '../vehicles/vehicleCatalog';
import {
  groundHeightAt,
  INTERIOR_PORTALS,
  RICH_COUNTRY_BOUNDS,
  WORLD_HALF_SIZE,
} from '../world/worldLayout';

export const SINGLE_PLAYER_SAVE_KEY = 'cityworld_sp_save_v1';

export interface SinglePlayerSaveData {
  version: 1;
  savedAt: number;
  money: number;
  devCodeActivated: boolean;
  player: {
    x: number;
    y: number;
    z: number;
    heading: number;
    health: number;
    armor: number;
    stamina: number;
    activeSkin: PlayerSkinId;
  };
  weapons: {
    currentWeapon: WeaponId;
    ownedWeapons: WeaponId[];
    ammoByWeapon: Record<WeaponId, number>;
  };
  ownedVehicles: VehicleClassId[];
  ownedSkins: PlayerSkinId[];
  ownedHouses: string[];
  completedMissionIds: string[];
  environment: {
    timeHours: number;
    weather: WeatherType;
    qualityMode: QualityMode;
    muted: boolean;
  };
}

const VALID_WEATHERS: WeatherType[] = ['clear', 'cloudy', 'rain', 'fog', 'snow'];
const VALID_QUALITIES: QualityMode[] = ['very_low', 'low', 'medium', 'high', 'ultra'];
const VALID_MISSION_IDS = new Set(MISSION_REGISTRY.map((m) => m.id));
const VALID_HOUSE_IDS = new Set(INTERIOR_PORTALS.filter((p) => p.kind === 'house').map((p) => p.id));

function clampFinite(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function loadSinglePlayerSave(): SinglePlayerSaveData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SINGLE_PLAYER_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SinglePlayerSaveData>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;

    const pRaw = (parsed.player ?? {}) as Partial<SinglePlayerSaveData['player']>;
    let px = clampFinite(pRaw.x, -WORLD_HALF_SIZE + 15, RICH_COUNTRY_BOUNDS.maxX - 10, 0);
    let pz = clampFinite(pRaw.z, -WORLD_HALF_SIZE + 15, 960, -20);
    let py = groundHeightAt(px, pz);

    // Ensure saved spawn point is solid ground (never ocean water or mid-air)
    if (py < -0.25) {
      px = 0;
      pz = -20;
      py = groundHeightAt(0, -20);
    }

    const activeSkin: PlayerSkinId =
      typeof pRaw.activeSkin === 'string' && pRaw.activeSkin in PLAYER_SKINS
        ? (pRaw.activeSkin as PlayerSkinId)
        : 'classic';

    const ownedSkinsSet = new Set<PlayerSkinId>(['classic']);
    if (Array.isArray(parsed.ownedSkins)) {
      for (const s of parsed.ownedSkins) {
        if (typeof s === 'string' && s in PLAYER_SKINS) {
          ownedSkinsSet.add(s as PlayerSkinId);
        }
      }
    }
    ownedSkinsSet.add(activeSkin);

    const ownedVehiclesSet = new Set<VehicleClassId>();
    if (Array.isArray(parsed.ownedVehicles)) {
      for (const v of parsed.ownedVehicles) {
        if (typeof v === 'string' && v in VEHICLE_CATALOG) {
          ownedVehiclesSet.add(v as VehicleClassId);
        }
      }
    }

    const ownedHousesSet = new Set<string>();
    if (Array.isArray(parsed.ownedHouses)) {
      for (const h of parsed.ownedHouses) {
        if (typeof h === 'string' && VALID_HOUSE_IDS.has(h)) {
          ownedHousesSet.add(h);
        }
      }
    }

    const completedSet = new Set<string>();
    if (Array.isArray(parsed.completedMissionIds)) {
      for (const id of parsed.completedMissionIds) {
        if (typeof id === 'string' && VALID_MISSION_IDS.has(id)) {
          completedSet.add(id);
        }
      }
    }

    const wRaw = (parsed.weapons ?? {}) as Partial<SinglePlayerSaveData['weapons']>;
    const ownedWeaponsSet = new Set<WeaponId>(['fists', 'pistol']);
    if (Array.isArray(wRaw.ownedWeapons)) {
      for (const w of wRaw.ownedWeapons) {
        if (typeof w === 'string' && w in WEAPON_CATALOG) {
          ownedWeaponsSet.add(w as WeaponId);
        }
      }
    }

    const currentWeapon: WeaponId =
      typeof wRaw.currentWeapon === 'string' &&
      wRaw.currentWeapon in WEAPON_CATALOG &&
      ownedWeaponsSet.has(wRaw.currentWeapon as WeaponId)
        ? (wRaw.currentWeapon as WeaponId)
        : 'pistol';

    const ammoRaw = (wRaw.ammoByWeapon ?? {}) as Partial<Record<WeaponId, number>>;
    const ammoByWeapon: Record<WeaponId, number> = {
      fists: 999,
      pistol: Math.round(clampFinite(ammoRaw.pistol, 0, 9999, 90)),
      smg: Math.round(clampFinite(ammoRaw.smg, 0, 9999, 0)),
      shotgun: Math.round(clampFinite(ammoRaw.shotgun, 0, 9999, 0)),
      rifle: Math.round(clampFinite(ammoRaw.rifle, 0, 9999, 0)),
      rpg: Math.round(clampFinite(ammoRaw.rpg, 0, 999, 0)),
    };

    const envRaw = (parsed.environment ?? {}) as Partial<SinglePlayerSaveData['environment']>;
    const weather: WeatherType = VALID_WEATHERS.includes(envRaw.weather as WeatherType)
      ? (envRaw.weather as WeatherType)
      : 'clear';
    const qualityMode: QualityMode = VALID_QUALITIES.includes(envRaw.qualityMode as QualityMode)
      ? (envRaw.qualityMode as QualityMode)
      : 'medium';

    return {
      version: 1,
      savedAt: clampFinite(parsed.savedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
      money: Math.round(clampFinite(parsed.money, 0, 999_999_999, 1500)),
      devCodeActivated: Boolean(parsed.devCodeActivated),
      player: {
        x: px,
        y: py,
        z: pz,
        heading: clampFinite(pRaw.heading, -Math.PI * 4, Math.PI * 4, Math.PI),
        health: Math.round(clampFinite(pRaw.health, 20, 100, 100)),
        armor: Math.round(clampFinite(pRaw.armor, 0, 100, 50)),
        stamina: Math.round(clampFinite(pRaw.stamina, 20, 100, 100)),
        activeSkin,
      },
      weapons: {
        currentWeapon,
        ownedWeapons: Array.from(ownedWeaponsSet),
        ammoByWeapon,
      },
      ownedVehicles: Array.from(ownedVehiclesSet),
      ownedSkins: Array.from(ownedSkinsSet),
      ownedHouses: Array.from(ownedHousesSet),
      completedMissionIds: Array.from(completedSet),
      environment: {
        timeHours: clampFinite(envRaw.timeHours, 0, 23.99, 10.5),
        weather,
        qualityMode,
        muted: Boolean(envRaw.muted),
      },
    };
  } catch {
    return null;
  }
}

export function saveSinglePlayerGame(data: SinglePlayerSaveData): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(SINGLE_PLAYER_SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSinglePlayerSave(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SINGLE_PLAYER_SAVE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }
}
