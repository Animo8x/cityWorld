export type GamePhase =
  | 'title'
  | 'playing'
  | 'paused'
  | 'map'
  | 'wasted'
  | 'interior_shop'
  | 'phone'
  | 'backpack'
  | 'multiplayer_lobby';

export type Language = 'en' | 'ar';

export type PlayerSkinId =
  | 'classic'
  | 'crimson_racer'
  | 'tactical_stealth'
  | 'emerald_vip'
  | 'royal_cyber'
  | 'pure_gold'
  | 'meme_banana_suit'
  | 'meme_frog_suit'
  | 'meme_duck_suit'
  | 'meme_derp_suit'
  | 'meme_chicken_suit'
  | 'meme_shark_suit'
  | 'meme_toast_suit'
  | 'meme_alien_suit';

export interface PlayerSkinDef {
  id: PlayerSkinId;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  jacketColor: number;
  shirtColor: number;
  pantsColor: number;
  shoeColor: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
  swatchHex: string;
  isMeme?: boolean;
}

export interface GpsPoint {
  x: number;
  z: number;
}

export type DistrictId =
  | 'downtown'
  | 'residential'
  | 'industrial'
  | 'rich'
  | 'poor'
  | 'beach'
  | 'airport'
  | 'port'
  | 'countryside'
  | 'highway'
  | 'island'
  | 'rich_country';

export interface DistrictInfo {
  id: DistrictId;
  name: string;
  nameAr: string;
  subtitle: string;
  subtitleAr: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  center: { x: number; z: number };
  mapColor: string;
}

export type VehicleClassId =
  | 'compact'
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'sports'
  | 'supercar'
  | 'hyper_viper'
  | 'track_phantom'
  | 'nova_x'
  | 'muscle'
  | 'convertible'
  | 'coupe'
  | 'luxury'
  | 'pickup'
  | 'taxi'
  | 'ambulance'
  | 'truck'
  | 'van'
  | 'bus'
  | 'motorcycle'
  | 'bicycle'
  | 'speed_bicycle'
  | 'police'
  | 'airplane'
  | 'gold_wing_coupe'
  | 'gold_wing_hyper'
  | 'gold_wing_sovereign'
  | 'meme_banana'
  | 'meme_head'
  | 'meme_toilet'
  | 'meme_duck'
  | 'meme_burger'
  | 'meme_shoe'
  | 'meme_shark'
  | 'meme_cat'
  | 'meme_hotdog'
  | 'meme_toast'
  | 'mech_titan'
  | 'mech_viper'
  | 'mech_striker'
  | 'mech_phantom'
  | 'mech_omega';

export interface VehicleSpec {
  id: VehicleClassId;
  name: string;
  nameAr: string;
  category: string;
  mass: number;
  maxSpeed: number; // m/s
  reverseSpeed: number;
  acceleration: number;
  braking: number;
  steeringSpeed: number;
  driftGrip: number;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
  colors: number[];
  price: number;
  canFly?: boolean;
  canTransformRobot?: boolean;
}

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'fog';

export type TimePhase = 'Dawn' | 'Morning' | 'Noon' | 'Afternoon' | 'Sunset' | 'Night';

export interface MissionStep {
  id: string;
  description: string;
  descriptionAr: string;
  type: 'goto' | 'deliver_vehicle' | 'pickup_npc' | 'evade_police' | 'collect_all' | 'timed_checkpoint';
  targetPos?: { x: number; z: number };
  radius?: number;
  timeLimit?: number;
  requiredVehicleClass?: VehicleClassId;
  collectPoints?: Array<{ x: number; z: number }>;
  wantedTarget?: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  titleAr: string;
  giver: string;
  giverAr: string;
  district: DistrictId;
  description: string;
  descriptionAr: string;
  rewardMoney: number;
  startPos: { x: number; z: number };
  steps: MissionStep[];
}

export interface InteriorPortalDef {
  id: string;
  name: string;
  nameAr: string;
  subtitle: string;
  subtitleAr: string;
  kind?: 'garage' | 'bank' | 'safehouse' | 'supermarket' | 'gunshop' | 'dealership' | 'skins' | 'house';
  houseSizeTier?: 1 | 2 | 3 | 4;
  housePrice?: number;
  exteriorPos: { x: number; y: number; z: number };
  interiorCenter: { x: number; y: number; z: number };
  accentColor: number;
  shopActions: Array<{
    id: string;
    label: string;
    labelAr: string;
    cost: number;
    description: string;
    descriptionAr: string;
  }>;
}

export interface MapMarker {
  id: string;
  type: 'player' | 'remote_player' | 'mission' | 'vehicle' | 'police' | 'interior' | 'waypoint' | 'objective';
  interiorKind?: InteriorPortalDef['kind'];
  x: number;
  z: number;
  label?: string;
  heading?: number;
}

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  minY?: number;
  tag?: string;
}

export type WeaponId = 'fists' | 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'rpg';

export type QualityMode = 'very_low' | 'low' | 'medium' | 'high' | 'ultra';

export type NetworkQualityMode = 'low' | 'medium' | 'high';
export type ServerRegionId = 'auto' | 'me_eu' | 'us_east' | 'asia';
export type MultiplayerConnectionStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface MultiplayerSessionSummary {
  id: string;
  code: string;
  name: string;
  region: ServerRegionId;
  playerCount: number;
  maxPlayers: number;
}

export interface MultiplayerHudState {
  active: boolean;
  status: MultiplayerConnectionStatus;
  errorMessage: string | null;
  localPlayerId: string | null;
  playerName: string;
  customName: string;
  sessionId: string | null;
  sessionCode: string | null;
  sessionName: string | null;
  playerCount: number;
  maxPlayers: number;
  pingMs: number;
  region: ServerRegionId;
  networkQuality: NetworkQualityMode;
  mpAudioEnabled: boolean;
  inVehicleRole: 'none' | 'driver' | 'passenger';
  passengerSeatIndex: number;
  driverName: string | null;
  serverUrl: string;
  isStandaloneMode: boolean;
  p2p: {
    active: boolean;
    role: 'none' | 'host' | 'guest';
    inviteCode: string;
    replyCode: string;
    connectedPeers: number;
    gathering: boolean;
    error: string | null;
  };
}

export interface HudSnapshot {
  phase: GamePhase;
  language: Language;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  maxStamina: number;
  money: number;
  wantedStars: number;
  wantedCooldownProgress: number; // 0..1
  wantedRemainingSec: number;
  isPoliceSearching: boolean;
  district: DistrictInfo;
  timeHours: number; // 0..24
  timeLabel: string;
  timePhase: TimePhase;
  weather: WeatherType;
  inVehicle: boolean;
  isAirplane: boolean;
  canDeployWings: boolean;
  wingsDeployed: boolean;
  canTransformRobot: boolean;
  isRobotTransformed: boolean;
  altitude: number;
  firstPerson: boolean;
  vehicleName: string;
  vehicleMaxKmh: number;
  vehicleHealth: number; // 0..100
  speedKmh: number;
  gear: string;
  headlightsOn: boolean;
  turnSignal: -1 | 0 | 1;
  isSwimming: boolean;
  isSprinting: boolean;
  nearPedestrian: boolean;
  weaponId: WeaponId;
  weaponName: string;
  ammo: number;
  ownedWeapons: WeaponId[];
  ownedVehicles: VehicleClassId[];
  ownedSkins: PlayerSkinId[];
  ownedHouses: string[];
  activeSkin: PlayerSkinId;
  interactionPrompt: string | null;
  activeMission: {
    id: string;
    title: string;
    stepDescription: string;
    timeRemaining: number | null;
    progressText: string | null;
    targetPos: { x: number; z: number } | null;
  } | null;
  missionBanner: {
    title: string;
    subtitle: string;
    kind: 'success' | 'fail' | 'info';
  } | null;
  activeInterior: InteriorPortalDef | null;
  playerPos: { x: number; y: number; z: number; heading: number };
  markers: MapMarker[];
  customWaypoint: { x: number; z: number } | null;
  gpsPath: GpsPoint[];
  gpsTargetPos: GpsPoint | null;
  muted: boolean;
  fps: number;
  qualityMode: QualityMode;
  devUnlocked: boolean;
  completedMissionIds: string[];
  hasSavedGame: boolean;
  lastSavedAt: number | null;
  multiplayer: MultiplayerHudState;
}
