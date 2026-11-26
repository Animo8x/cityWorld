import * as THREE from 'three';
import {
  ColliderBox,
  Language,
  MapMarker,
  StoryDialogueLine,
  StoryHudState,
  StoryStage,
} from '../types';
import { groundHeightAt } from '../world/worldLayout';
import { WorldVehicle } from '../vehicles/vehiclePhysics';

export const STORY_COMPLETED_STORAGE_KEY = 'cityworld_story_completed_v1';
export const STORY_REWARD_AMOUNT = 10000;

export const STORY_APARTMENT_CENTER = { x: 1800, y: -120, z: 0 };
export const STORY_APARTMENT_HALF_W = 5.4;
export const STORY_APARTMENT_HALF_D = 5.4;
export const STORY_APARTMENT_EXTERIOR = { x: -205, y: 0, z: 31 };

export const STORY_CAR_START_POS = { x: -252, z: 41.5 };
export const STORY_CAR_PARK_POS = { x: -206, z: 41.5 };
export const STORY_CAR_HEADING = Math.PI / 2;

export const STORY_BANK_CENTER = { x: 1920, y: -120, z: 0 };
export const STORY_BANK_HALF_W = 11;
export const STORY_BANK_HALF_D = 11;
export const STORY_BANK_BUILDING_POS = { x: 80, y: 0, z: -152 };
export const STORY_BANK_EXTERIOR = { x: 80, y: 0, z: -133 };
export const STORY_BANK_CAR_PARK_POS = { x: 74, z: -122 };
export const STORY_BANK_COLLIDER: ColliderBox = {
  minX: STORY_BANK_BUILDING_POS.x - 13,
  maxX: STORY_BANK_BUILDING_POS.x + 13,
  minZ: STORY_BANK_BUILDING_POS.z - 9,
  maxZ: STORY_BANK_BUILDING_POS.z + 9,
  maxY: 11.5,
  minY: 0,
};

export const STORY_GUARD_WORLD_POS = { x: 1920, y: -120, z: -2.8 };
export const STORY_CASH_WORLD_POS = { x: 1920, y: -120, z: -8.2 };

interface BilingualLine {
  speakerEn: string;
  speakerAr: string;
  textEn: string;
  textAr: string;
}

export function isStoryModeCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORY_COMPLETED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markStoryModeCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORY_COMPLETED_STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

export interface StoryCallbacks {
  playPhoneRing: () => void;
  playCashPickup: () => void;
  playDoorLatch: () => void;
  playCue: (kind: 'start' | 'step' | 'success' | 'fail') => void;
  spawnGetawayCar: (x: number, z: number, heading: number) => WorldVehicle;
  removeGetawayCar: (veh: WorldVehicle) => void;
  teleportPlayer: (opts: {
    x: number;
    y: number;
    z: number;
    heading: number;
    inInterior: boolean;
    interiorFloorY: number;
    halfW: number;
    halfD: number;
  }) => void;
  equipStoryPistol: () => void;
  setNightTime: () => void;
  triggerWantedStars: (stars: number) => void;
  clearWanted: () => void;
  onGuardFireAtPlayer: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, hit: boolean) => void;
  awardStoryReward: (amount: number) => void;
  onShowBanner: (title: string, subtitle: string, kind: 'success' | 'fail' | 'info') => void;
  onHudChanged: () => void;
}

function buildHumanNpcMesh(opts: {
  jacketColor: number;
  shirtColor: number;
  pantsColor: number;
  skinColor?: number;
  hasCap?: boolean;
  capColor?: number;
  hasGun?: boolean;
}): { root: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const jacketMat = new THREE.MeshStandardMaterial({ color: opts.jacketColor, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: opts.pantsColor, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skinColor ?? 0xd8a882, roughness: 0.65 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  disposables.push(jacketMat, shirtMat, pantsMat, skinMat, shoeMat);

  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.24);
  const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.34);
  const torsoGeo = new THREE.BoxGeometry(0.56, 0.72, 0.3);
  const armGeo = new THREE.BoxGeometry(0.18, 0.64, 0.18);
  const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  disposables.push(legGeo, shoeGeo, torsoGeo, armGeo, headGeo);

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.14, 0.45, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.14, 0.45, 0);

  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.14, 0.07, 0.04);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.14, 0.07, 0.04);

  const torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.position.set(0, 1.18, 0);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.32), shirtMat);
  chestStripe.position.set(0, 1.18, 0.01);

  const leftArm = new THREE.Mesh(armGeo, jacketMat);
  leftArm.position.set(-0.38, 1.14, 0);
  const rightArm = new THREE.Mesh(armGeo, jacketMat);
  rightArm.position.set(0.38, 1.14, opts.hasGun ? 0.18 : 0);
  if (opts.hasGun) rightArm.rotation.x = -Math.PI * 0.42;

  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.72, 0);

  root.add(leftLeg, rightLeg, leftShoe, rightShoe, torso, chestStripe, leftArm, rightArm, head);

  if (opts.hasCap) {
    const capMat = new THREE.MeshStandardMaterial({ color: opts.capColor ?? 0x0f172a, roughness: 0.55 });
    const capTopGeo = new THREE.BoxGeometry(0.35, 0.12, 0.36);
    const capVisorGeo = new THREE.BoxGeometry(0.34, 0.05, 0.18);
    disposables.push(capMat, capTopGeo, capVisorGeo);
    const capTop = new THREE.Mesh(capTopGeo, capMat);
    capTop.position.set(0, 1.9, 0);
    const capVisor = new THREE.Mesh(capVisorGeo, capMat);
    capVisor.position.set(0, 1.85, 0.22);
    root.add(capTop, capVisor);
  }

  if (opts.hasGun) {
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const gunGeo = new THREE.BoxGeometry(0.08, 0.12, 0.32);
    disposables.push(gunMat, gunGeo);
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.38, 1.32, 0.56);
    root.add(gun);
  }

  return { root, disposables };
}

export class StoryModeSystem {
  private scene: THREE.Scene;
  private disposables: Array<{ dispose: () => void }> = [];

  public active = false;
  public completed: boolean;
  public stage: StoryStage = 'idle';
  public justFinishedModal = false;

  // Story dialogue queue
  private dialogueQueue: BilingualLine[] = [];
  private dialogueIndex = 0;
  private onDialogueFinished: (() => void) | null = null;

  // Dynamic gameplay timers & entities
  private friendCar: WorldVehicle | null = null;
  private carArriving = false;
  private carArrivalTimer = 0;
  private guardHp = 70;
  private guardAlive = true;
  private guardFireCooldown = 2.0;
  private cashGrabbed = false;
  private alarmPhase = 0;

  // 3D Scene Groups
  private apartmentGroup: THREE.Group;
  private bankGroup: THREE.Group;
  private exteriorBankGroup: THREE.Group;
  private exteriorBankRing: THREE.Mesh;
  private friendNpcGroup: THREE.Group;
  private passengerFriendGroup: THREE.Group;
  private guardGroup: THREE.Group;
  private cashGroup: THREE.Group;
  private alarmLight: THREE.PointLight;
  private guardRingMesh: THREE.Mesh;
  private cashRingMesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.completed = isStoryModeCompleted();

    this.apartmentGroup = this.buildApartmentInterior();
    this.apartmentGroup.visible = false;
    this.scene.add(this.apartmentGroup);

    this.bankGroup = this.buildBankVaultInterior();
    this.bankGroup.visible = false;
    this.scene.add(this.bankGroup);

    const extBankBuilt = this.buildExteriorBankBuilding();
    this.exteriorBankGroup = extBankBuilt.root;
    this.exteriorBankRing = extBankBuilt.portalRing;
    this.exteriorBankGroup.visible = false;
    this.scene.add(this.exteriorBankGroup);

    const friendBuilt = buildHumanNpcMesh({
      jacketColor: 0x1d4ed8,
      shirtColor: 0xe2e8f0,
      pantsColor: 0x1e293b,
      hasCap: true,
      capColor: 0x0f172a,
    });
    this.disposables.push(...friendBuilt.disposables);
    this.friendNpcGroup = friendBuilt.root;
    this.friendNpcGroup.visible = false;
    this.scene.add(this.friendNpcGroup);

    // Compact seated passenger bust for Tariq inside getaway car
    this.passengerFriendGroup = this.buildSeatedPassengerMesh();

    // Bank Guard NPC
    const guardBuilt = buildHumanNpcMesh({
      jacketColor: 0x0f172a,
      shirtColor: 0x38bdf8,
      pantsColor: 0x09090b,
      hasCap: true,
      capColor: 0x1e3a8a,
      hasGun: true,
    });
    this.disposables.push(...guardBuilt.disposables);
    this.guardGroup = guardBuilt.root;
    this.guardGroup.position.set(0, 0, -2.8);

    const guardRingGeo = new THREE.TorusGeometry(0.95, 0.06, 8, 24);
    const guardRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.disposables.push(guardRingGeo, guardRingMat);
    this.guardRingMesh = new THREE.Mesh(guardRingGeo, guardRingMat);
    this.guardRingMesh.rotation.x = Math.PI / 2;
    this.guardRingMesh.position.set(0, 0.06, 0);
    this.guardGroup.add(this.guardRingMesh);
    this.bankGroup.add(this.guardGroup);

    // $10,000 Cash Stash inside vault
    this.cashGroup = this.buildCashStashMesh();
    this.cashGroup.position.set(0, 0, -8.2);
    const cashRingGeo = new THREE.TorusGeometry(1.15, 0.07, 8, 28);
    const cashRingMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    this.disposables.push(cashRingGeo, cashRingMat);
    this.cashRingMesh = new THREE.Mesh(cashRingGeo, cashRingMat);
    this.cashRingMesh.rotation.x = Math.PI / 2;
    this.cashRingMesh.position.set(0, 0.07, 0);
    this.cashGroup.add(this.cashRingMesh);
    this.bankGroup.add(this.cashGroup);

    this.alarmLight = new THREE.PointLight(0xef4444, 0, 26, 1.5);
    this.alarmLight.position.set(0, 5.2, -5.5);
    this.bankGroup.add(this.alarmLight);
  }

  private buildSeatedPassengerMesh(): THREE.Group {
    const g = new THREE.Group();
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a882, roughness: 0.65 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 });
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.48, 0.24);
    const headGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const capGeo = new THREE.BoxGeometry(0.29, 0.1, 0.29);
    this.disposables.push(jacketMat, skinMat, capMat, torsoGeo, headGeo, capGeo);

    const torso = new THREE.Mesh(torsoGeo, jacketMat);
    torso.position.set(0, 0.24, 0);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 0.63, 0);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 0.78, 0);
    g.add(torso, head, cap);
    return g;
  }

  private buildExteriorBankBuilding(): { root: THREE.Group; portalRing: THREE.Mesh } {
    const group = new THREE.Group();
    const bx = STORY_BANK_BUILDING_POS.x;
    const bz = STORY_BANK_BUILDING_POS.z;
    const by = groundHeightAt(bx, bz);
    group.position.set(bx, by, bz);

    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.25 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.45,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.25,
      metalness: 0.65,
      roughness: 0.35,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.0,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.push(marbleMat, slateMat, goldMat, glassMat, doorMat, ringMat, beamMat);

    // Marble Forecourt & Sidewalk Plaza reaching to the street edge
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(34, 0.24, 29), marbleMat);
    plaza.position.set(0, 0.12, 5.5);
    plaza.receiveShadow = true;

    // Main Bank Building Massing (26m x 10.2m x 18m)
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, 10.2, 18), marbleMat);
    body.position.set(0, 5.1, 0);
    body.castShadow = true;
    body.receiveShadow = true;

    // Dark Slate Foundation Plinth + Golden Cornice Roof Trim
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(26.6, 1.3, 18.6), slateMat);
    plinth.position.set(0, 0.65, 0);
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(27.2, 1.0, 19.2), slateMat);
    roofTrim.position.set(0, 10.5, 0);
    const goldBand = new THREE.Mesh(new THREE.BoxGeometry(27.4, 0.32, 19.4), goldMat);
    goldBand.position.set(0, 9.85, 0);

    // Illuminated Tall Windows
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(26.25, 3.6, 18.25), glassMat);
    winBand.position.set(0, 5.2, 0);

    // Grand Front Stairs (+Z side facing dt_ew_1)
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(12 - s * 1.0, 0.28, 1.4), marbleMat);
      step.position.set(0, 0.24 + s * 0.26, 10.6 - s * 0.8);
      group.add(step);
    }

    // 6 Classical Columns across front portico
    const colGeo = new THREE.CylinderGeometry(0.45, 0.55, 8.2, 12);
    this.disposables.push(colGeo);
    [-9.5, -5.8, -2.5, 2.5, 5.8, 9.5].forEach((cx) => {
      const col = new THREE.Mesh(colGeo, marbleMat);
      col.position.set(cx, 4.9, 10.2);
      col.castShadow = true;
      group.add(col);
    });

    // Portico Canopy
    const portico = new THREE.Mesh(new THREE.BoxGeometry(22, 1.1, 3.4), slateMat);
    portico.position.set(0, 9.1, 10.1);
    const porticoGold = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.28, 3.5), goldMat);
    porticoGold.position.set(0, 8.5, 10.1);

    // Grand Front Vault Doors
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.4, 0.45), goldMat);
    doorFrame.position.set(0, 2.9, 9.05);
    const doors = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.0, 0.52), doorMat);
    doors.position.set(0, 2.7, 9.12);

    // Bilingual BANK Signboard above Portico
    let signMat: THREE.MeshStandardMaterial;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 144;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 144);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, 500, 132);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 46px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CITYWORLD BANK', 256, 64);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.fillText('بنك المدينة المركزي', 256, 114);
      }
      const tex = new THREE.CanvasTexture(canvas);
      this.disposables.push(tex);
      signMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
        roughness: 0.3,
      });
    } else {
      signMat = goldMat;
    }
    this.disposables.push(signMat);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(13.5, 3.4, 0.45), signMat);
    signBoard.position.set(0, 11.4, 10.2);

    // Entrance Portal Ring & Sky Beacon at STORY_BANK_EXTERIOR (dz = +19 relative to -152 -> -133)
    const portalDz = STORY_BANK_EXTERIOR.z - bz;
    const portalRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 8, 24), ringMat);
    portalRing.rotation.x = Math.PI / 2;
    portalRing.position.set(0, 0.22, portalDz);
    const portalBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.15, 22, 12, 1, true), beamMat);
    portalBeam.position.set(0, 11.0, portalDz);

    // Exterior Spotlights illuminating front columns at night
    const bankLight = new THREE.PointLight(0xfef08a, 24, 34, 1.35);
    bankLight.position.set(0, 7.2, 13.5);

    group.add(
      plaza,
      body,
      plinth,
      roofTrim,
      goldBand,
      winBand,
      portico,
      porticoGold,
      doorFrame,
      doors,
      signBoard,
      portalRing,
      portalBeam,
      bankLight
    );

    return { root: group, portalRing };
  }

  private buildApartmentInterior(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(STORY_APARTMENT_CENTER.x, STORY_APARTMENT_CENTER.y, STORY_APARTMENT_CENTER.z);

    const roomW = 12;
    const roomD = 12;
    const wallH = 4.6;
    const halfW = roomW / 2;
    const halfD = roomD / 2;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x926239, roughness: 0.62 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.82 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.72 });
    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const exitMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.5,
    });
    this.disposables.push(floorMat, wallMat, sofaMat, woodMat, sheetMat, blanketMat, tvMat, exitMat);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.36, roomD), floorMat);
    floor.position.set(0, -0.18, 0);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.36, roomD), wallMat);
    ceiling.position.set(0, wallH, 0);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, 0.4), wallMat);
    backWall.position.set(0, wallH / 2, -halfD);
    const frontWall = backWall.clone();
    frontWall.position.z = halfD;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, roomD), wallMat);
    leftWall.position.set(-halfW, wallH / 2, 0);
    const rightWall = leftWall.clone();
    rightWall.position.x = halfW;

    // Small Sofa & Coffee Table + TV on Left/Back
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 1.05), sofaMat);
    sofa.position.set(-2.6, 0.42, -1.6);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.85), woodMat);
    table.position.set(-2.6, 0.22, -3.1);
    const tvStand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.55), woodMat);
    tvStand.position.set(-2.6, 0.3, -5.2);
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.1), tvMat);
    tvScreen.position.set(-2.6, 1.25, -5.2);

    // Compact Bed on Right Side
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 2.8), woodMat);
    bedFrame.position.set(3.4, 0.2, -3.2);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 2.65), sheetMat);
    mattress.position.set(3.4, 0.52, -3.2);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 1.65), blanketMat);
    blanket.position.set(3.4, 0.54, -2.7);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.48), sheetMat);
    pillow.position.set(3.4, 0.72, -4.1);

    // Kitchenette Counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.9), sheetMat);
    counter.position.set(3.6, 0.48, 2.0);

    // Glowing Apartment Exit Door at +Z
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.7, 0.22), exitMat);
    exitDoor.position.set(0, 1.35, halfD - 0.32);

    const lamp = new THREE.PointLight(0xffedd5, 22, 18, 1.4);
    lamp.position.set(0, wallH - 0.7, -0.5);

    group.add(
      floor,
      ceiling,
      backWall,
      frontWall,
      leftWall,
      rightWall,
      sofa,
      table,
      tvStand,
      tvScreen,
      bedFrame,
      mattress,
      blanket,
      pillow,
      counter,
      exitDoor,
      lamp
    );

    return group;
  }

  private buildBankVaultInterior(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(STORY_BANK_CENTER.x, STORY_BANK_CENTER.y, STORY_BANK_CENTER.z);

    const roomW = 24;
    const roomD = 24;
    const wallH = 6.2;
    const halfW = 12;
    const halfD = 12;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.28, metalness: 0.22 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.28 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.88, roughness: 0.32 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
    });
    const exitMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.5,
    });
    this.disposables.push(floorMat, wallMat, steelMat, darkSteelMat, accentMat, exitMat);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.4, roomD), floorMat);
    floor.position.set(0, -0.2, 0);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.4, roomD), wallMat);
    ceiling.position.set(0, wallH, 0);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, 0.5), wallMat);
    backWall.position.set(0, wallH / 2, -halfD);
    const frontWall = backWall.clone();
    frontWall.position.z = halfD;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallH, roomD), wallMat);
    leftWall.position.set(-halfW, wallH / 2, 0);
    const rightWall = leftWall.clone();
    rightWall.position.x = halfW;

    // Bank Teller Counters flanking center aisle
    [-6.5, 6.5].forEach((tx) => {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.2, 1.5), wallMat);
      counter.position.set(tx, 0.6, 2.4);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.16, 1.55), accentMat);
      trim.position.set(tx, 1.15, 2.4);
      group.add(counter, trim);
    });

    // Vault Wall Partition at z = -5.4 with wide central opening (left & right steel segments + lintel + open round vault door)
    const leftVaultWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, wallH, 0.9), steelMat);
    leftVaultWall.position.set(-7.4, wallH / 2, -5.4);
    const rightVaultWall = leftVaultWall.clone();
    rightVaultWall.position.x = 7.4;
    const vaultLintel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.2, 0.9), steelMat);
    vaultLintel.position.set(0, wallH - 1.1, -5.4);

    // Heavy Swung-Open Circular Vault Door
    const vaultDoorDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.45, 20), darkSteelMat);
    vaultDoorDisc.rotation.z = Math.PI / 2;
    vaultDoorDisc.rotation.y = 0.45;
    vaultDoorDisc.position.set(-3.1, 1.9, -4.1);

    // Cash Table inside the vault at z = -8.2
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.88, 1.4), darkSteelMat);
    table.position.set(0, 0.44, -8.2);

    // Exit door at +Z
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.22), exitMat);
    exitDoor.position.set(0, 1.6, halfD - 0.4);

    const lobbyLight = new THREE.PointLight(0xe0f2fe, 24, 28, 1.4);
    lobbyLight.position.set(0, 5.2, 3);
    const vaultLight = new THREE.PointLight(0xfef08a, 18, 16, 1.4);
    vaultLight.position.set(0, 4.4, -8.5);

    group.add(
      floor,
      ceiling,
      backWall,
      frontWall,
      leftWall,
      rightWall,
      leftVaultWall,
      rightVaultWall,
      vaultLintel,
      vaultDoorDisc,
      table,
      exitDoor,
      lobbyLight,
      vaultLight
    );

    return group;
  }

  private buildCashStashMesh(): THREE.Group {
    const g = new THREE.Group();
    const cashMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.65,
      metalness: 0.85,
      roughness: 0.2,
    });
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    this.disposables.push(cashMat, goldMat, bagMat);

    const bag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.65), bagMat);
    bag.position.set(-0.35, 1.12, 0);

    for (let i = 0; i < 4; i++) {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.28), i === 3 ? goldMat : cashMat);
      stack.position.set(0.32 + (i % 2) * 0.28, 0.98 + Math.floor(i / 2) * 0.17, (i % 2 === 0 ? -0.1 : 0.15));
      g.add(stack);
    }

    g.add(bag);
    return g;
  }

  public startStory(cb: StoryCallbacks, lang: Language): boolean {
    if (this.completed) {
      return false;
    }

    this.abortAndHide(cb);
    this.active = true;
    this.justFinishedModal = false;
    this.stage = 'apartment_call';
    this.guardHp = 70;
    this.guardAlive = true;
    this.guardFireCooldown = 2.2;
    this.cashGrabbed = false;
    this.carArriving = false;
    this.carArrivalTimer = 0;

    // Reset visuals
    this.apartmentGroup.visible = true;
    this.bankGroup.visible = false;
    this.exteriorBankGroup.visible = true;
    this.guardGroup.visible = true;
    this.guardGroup.rotation.set(0, 0, 0);
    this.guardGroup.position.set(0, 0, -2.8);
    this.guardRingMesh.visible = true;
    this.cashGroup.visible = true;
    this.alarmLight.intensity = 0;
    this.friendNpcGroup.visible = false;

    // Set Nighttime + Pistol ready + clean Wanted stars
    cb.setNightTime();
    cb.clearWanted();
    cb.equipStoryPistol();

    // Teleport player inside small apartment
    cb.teleportPlayer({
      x: STORY_APARTMENT_CENTER.x,
      y: STORY_APARTMENT_CENTER.y,
      z: STORY_APARTMENT_CENTER.z + 1.2,
      heading: Math.PI,
      inInterior: true,
      interiorFloorY: STORY_APARTMENT_CENTER.y,
      halfW: STORY_APARTMENT_HALF_W,
      halfD: STORY_APARTMENT_HALF_D,
    });

    cb.playPhoneRing();
    cb.onShowBanner(
      lang === 'ar' ? '📞 مكالمة واردة — صديقك طارق' : '📞 Incoming Call — Tariq',
      lang === 'ar' ? 'اضغط Enter أو موافق للرد ومتابعة الحوار' : 'Press Enter or OK to answer & continue',
      'info'
    );

    this.openDialogue(
      [
        {
          speakerEn: 'Tariq (Phone)',
          speakerAr: 'طارق (على الهاتف)',
          textEn:
            "Hey buddy! Tonight is our shot — I found a clean way into the CityWorld Bank vault. There's $10,000 sitting inside!",
          textAr:
            'ألو يا صاحبي! الليلة فرصتنا — عندي خطة مضمونة لسرقة البنك، وفي الخزنة 10,000 دولار!',
        },
        {
          speakerEn: 'You',
          speakerAr: 'أنت',
          textEn: "$10,000? I'm in! Tell me the plan — when do we head out?",
          textAr: '10,000 دولار؟ ممتاز، أنا موافق! قل لي متى نتحرك؟',
        },
        {
          speakerEn: 'Tariq (Phone)',
          speakerAr: 'طارق (على الهاتف)',
          textEn:
            "I'm already driving over to your apartment right now! Grab your pistol and step outside as soon as I pull up.",
          textAr:
            'أنا جاي بالسيارة الحين ورايح أوقف عند باب بيتك! جهّز مسدسك واخرج لي أول ما أوصل.',
        },
      ],
      () => {
        this.stage = 'exit_apartment';
        this.apartmentGroup.visible = true;
        this.carArriving = true;
        this.carArrivalTimer = 0;

        // Spawn friend's getaway car driving up along dt_ew_3 outside Maple Oaks apartment
        const veh = cb.spawnGetawayCar(STORY_CAR_START_POS.x, STORY_CAR_START_POS.z, STORY_CAR_HEADING);
        veh.headlightsOn = true;
        this.friendCar = veh;
        this.attachPassengerToCar(veh);

        cb.onShowBanner(
          lang === 'ar' ? '🚗 صديقك قريب من البيت!' : '🚗 Friend Arriving Outside!',
          lang === 'ar' ? 'اخرج من باب الشقة [E] لتركب معه' : 'Exit the apartment door [E] to meet Tariq',
          'info'
        );
        cb.onHudChanged();
      }
    );

    cb.onHudChanged();
    return true;
  }

  public abortAndHide(cb?: Pick<StoryCallbacks, 'removeGetawayCar'>): void {
    this.active = false;
    this.stage = 'idle';
    this.justFinishedModal = false;
    this.dialogueQueue = [];
    this.dialogueIndex = 0;
    this.onDialogueFinished = null;
    this.carArriving = false;
    this.apartmentGroup.visible = false;
    this.bankGroup.visible = false;
    this.exteriorBankGroup.visible = false;
    this.friendNpcGroup.visible = false;
    this.alarmLight.intensity = 0;
    this.detachPassengerFromCar();

    if (this.friendCar && cb) {
      cb.removeGetawayCar(this.friendCar);
    }
    this.friendCar = null;
  }

  private attachPassengerToCar(veh: WorldVehicle): void {
    this.detachPassengerFromCar();
    this.passengerFriendGroup.position.set(-0.38, 0.56, 0.05);
    this.passengerFriendGroup.rotation.set(0, 0, 0);
    veh.rig.cabinGroup.add(this.passengerFriendGroup);
  }

  private detachPassengerFromCar(): void {
    if (this.passengerFriendGroup.parent) {
      this.passengerFriendGroup.parent.remove(this.passengerFriendGroup);
    }
  }

  private openDialogue(lines: BilingualLine[], onDone: () => void): void {
    this.dialogueQueue = lines;
    this.dialogueIndex = 0;
    this.onDialogueFinished = onDone;
  }

  public isDialogueOpen(): boolean {
    return this.active && this.dialogueQueue.length > 0 && this.dialogueIndex < this.dialogueQueue.length;
  }

  public advanceDialogue(cb: StoryCallbacks): boolean {
    if (!this.isDialogueOpen()) return false;
    cb.playCue('step');
    this.dialogueIndex++;
    if (this.dialogueIndex >= this.dialogueQueue.length) {
      const done = this.onDialogueFinished;
      this.dialogueQueue = [];
      this.dialogueIndex = 0;
      this.onDialogueFinished = null;
      if (done) done();
    }
    cb.onHudChanged();
    return true;
  }

  public getCurrentDialogue(lang: Language): StoryDialogueLine | null {
    if (!this.isDialogueOpen()) return null;
    const item = this.dialogueQueue[this.dialogueIndex];
    return {
      speaker: lang === 'ar' ? item.speakerAr : item.speakerEn,
      text: lang === 'ar' ? item.textAr : item.textEn,
      index: this.dialogueIndex + 1,
      total: this.dialogueQueue.length,
    };
  }

  public getObjectiveText(lang: Language): string | null {
    if (!this.active) return null;
    switch (this.stage) {
      case 'apartment_call':
        return lang === 'ar' ? 'رد على مكالمة صديقك طارق' : 'Answer Tariq on the phone';
      case 'exit_apartment':
        return lang === 'ar'
          ? 'وصل صديقك عند البيت — اخرج من باب الشقة [E]'
          : 'Your friend is outside — exit the apartment door [E]';
      case 'board_car':
        return lang === 'ar'
          ? 'اركب السيارة مع صديقك [F] وقُد نحو البنك'
          : 'Get into the car with Tariq [F] and drive to the Bank';
      case 'drive_to_bank':
        return lang === 'ar'
          ? 'قُد السيارة إلى البنك ليلاً (المكان محدد على الخريطة)'
          : 'Drive to the Bank at night (marked on GPS)';
      case 'enter_bank':
        return lang === 'ar'
          ? 'انزل من السيارة وادخل البنك [E]'
          : 'Step out of the car and enter the Bank [E]';
      case 'shoot_guard':
        return lang === 'ar'
          ? 'أطلق النار على الحارس بالمسدس!'
          : 'Shoot the Bank Guard with your Pistol!';
      case 'grab_cash':
        return lang === 'ar'
          ? 'ادخل الخزنة وخذ الـ 10,000 دولار [E]'
          : 'Enter the vault and grab the $10,000 cash [E]';
      case 'exit_bank_escape':
        return lang === 'ar'
          ? 'اخرج من باب البنك فوراً قبل وصول الشرطة [E]'
          : 'Exit the Bank door immediately [E]!';
      case 'escape_police':
        return lang === 'ar'
          ? 'اهرب من مطاردة الشرطة حتى تختفي النجوم بالكامل!'
          : 'Escape the police chase until all Wanted Stars clear!';
      case 'completed':
        return lang === 'ar'
          ? 'تم إنهاء مهمة القصة بنجاح! +$10,000'
          : 'Story Mission Complete! +$10,000';
      default:
        return null;
    }
  }

  public getHudState(lang: Language): StoryHudState {
    return {
      active: this.active,
      completed: this.completed,
      stage: this.stage,
      objectiveText: this.getObjectiveText(lang),
      dialogue: this.getCurrentDialogue(lang),
      justFinishedModal: this.justFinishedModal,
      rewardAmount: STORY_REWARD_AMOUNT,
    };
  }

  public canShootInInterior(): boolean {
    return this.active && this.stage === 'shoot_guard' && !this.isDialogueOpen();
  }

  public isStoryCar(veh: WorldVehicle | null): boolean {
    return Boolean(this.active && veh && this.friendCar && veh.id === this.friendCar.id);
  }

  public getGpsTarget(): { x: number; z: number } | null {
    if (!this.active) return null;
    if (this.stage === 'board_car' && this.friendCar) {
      return { x: this.friendCar.x, z: this.friendCar.z };
    }
    if (this.stage === 'drive_to_bank' || this.stage === 'enter_bank') {
      return { x: STORY_BANK_EXTERIOR.x, z: STORY_BANK_EXTERIOR.z };
    }
    return null;
  }

  public getMapMarkers(lang: Language): MapMarker[] {
    if (!this.active) return [];
    const target = this.getGpsTarget();
    if (!target) return [];
    return [
      {
        id: 'story_obj',
        type: 'objective',
        x: target.x,
        z: target.z,
        label:
          this.stage === 'board_car'
            ? lang === 'ar'
              ? 'سيارة صديقك'
              : "Friend's Car"
            : lang === 'ar'
              ? 'البنك (الهدف)'
              : 'Bank Heist Target',
      },
    ];
  }

  public getCombatTargets(): Array<{ id: string; x: number; y: number; z: number; radius: number }> {
    if (!this.active || this.stage !== 'shoot_guard' || !this.guardAlive) return [];
    return [
      {
        id: 'story_guard',
        x: STORY_GUARD_WORLD_POS.x,
        y: STORY_GUARD_WORLD_POS.y,
        z: STORY_GUARD_WORLD_POS.z,
        radius: 1.45,
      },
    ];
  }

  public damageGuard(dmg: number, cb: StoryCallbacks, lang: Language): boolean {
    if (!this.active || this.stage !== 'shoot_guard' || !this.guardAlive) return false;
    this.guardHp = Math.max(0, this.guardHp - Math.max(35, dmg));
    if (this.guardHp <= 0) {
      this.guardAlive = false;
      this.guardRingMesh.visible = false;
      this.guardGroup.rotation.x = Math.PI / 2;
      this.guardGroup.position.y = 0.28;
      cb.playCue('step');

      this.openDialogue(
        [
          {
            speakerEn: 'Tariq',
            speakerAr: 'طارق',
            textEn: 'Nice shot! Guard is down — get inside the open vault and grab the $10,000!',
            textAr: 'كفو عليك! تم إسقاط الحارس — ادخل الخزنة وخذ الـ 10,000 دولار بسرعة!',
          },
        ],
        () => {
          this.stage = 'grab_cash';
          cb.onHudChanged();
        }
      );
      cb.onShowBanner(
        lang === 'ar' ? 'تم إسقاط الحارس!' : 'Guard Neutralized!',
        lang === 'ar' ? 'توجه للخزنة وخذ الـ $10,000' : 'Head into the vault and take the $10,000',
        'info'
      );
      cb.onHudChanged();
      return true;
    }
    return false;
  }

  public getInteractionContext(
    px: number,
    pz: number,
    inInterior: boolean,
    inVehicle: boolean,
    lang: Language
  ): {
    prompt: string | null;
    nearApartmentExit: boolean;
    nearBankEnter: boolean;
    nearBankCash: boolean;
    nearBankExit: boolean;
    nearGetawayCar: WorldVehicle | null;
  } {
    const empty = {
      prompt: null,
      nearApartmentExit: false,
      nearBankEnter: false,
      nearBankCash: false,
      nearBankExit: false,
      nearGetawayCar: null,
    };
    if (!this.active || this.isDialogueOpen()) return empty;

    if (inInterior && this.stage === 'exit_apartment') {
      const dz = pz - (STORY_APARTMENT_CENTER.z + STORY_APARTMENT_HALF_D - 1.2);
      if (dz > -2.4) {
        return {
          ...empty,
          prompt: lang === 'ar' ? '[E] الخروج من الشقة إلى الشارع' : '[E] Exit Apartment to Street',
          nearApartmentExit: true,
        };
      }
    }

    if (!inInterior && !inVehicle && (this.stage === 'board_car' || this.stage === 'drive_to_bank' || this.stage === 'escape_police') && this.friendCar && !this.friendCar.exploded) {
      const d = Math.hypot(px - this.friendCar.x, pz - this.friendCar.z);
      if (d < 5.0) {
        return {
          ...empty,
          prompt:
            lang === 'ar'
              ? '[F] ركوب السيارة مع صديقك طارق'
              : '[F] Get in Car with Tariq',
          nearGetawayCar: this.friendCar,
        };
      }
    }

    if (!inInterior && !inVehicle && this.stage === 'enter_bank') {
      const d = Math.hypot(px - STORY_BANK_EXTERIOR.x, pz - STORY_BANK_EXTERIOR.z);
      if (d < 5.2) {
        return {
          ...empty,
          prompt: lang === 'ar' ? '[E] دخول البنك لتنفيذ السرقة' : '[E] Enter Bank to Start Heist',
          nearBankEnter: true,
        };
      }
    }

    if (inInterior && this.stage === 'grab_cash' && !this.cashGrabbed) {
      const d = Math.hypot(px - STORY_CASH_WORLD_POS.x, pz - STORY_CASH_WORLD_POS.z);
      if (d < 3.4) {
        return {
          ...empty,
          prompt: lang === 'ar' ? '[E] أخذ 10,000 دولار من الخزنة' : '[E] Grab $10,000 Cash',
          nearBankCash: true,
        };
      }
    }

    if (inInterior && this.stage === 'exit_bank_escape') {
      const dz = pz - (STORY_BANK_CENTER.z + STORY_BANK_HALF_D - 1.5);
      if (dz > -2.6) {
        return {
          ...empty,
          prompt: lang === 'ar' ? '[E] الخروج والهرب من الشرطة!' : '[E] Exit Bank & Escape Police!',
          nearBankExit: true,
        };
      }
    }

    return empty;
  }

  public handleInteractKey(
    px: number,
    pz: number,
    inInterior: boolean,
    inVehicle: boolean,
    cb: StoryCallbacks,
    lang: Language
  ): boolean {
    if (!this.active) return false;
    if (this.isDialogueOpen()) {
      return this.advanceDialogue(cb);
    }

    const ctx = this.getInteractionContext(px, pz, inInterior, inVehicle, lang);

    if (ctx.nearApartmentExit) {
      this.exitApartmentAction(cb, lang);
      return true;
    }

    if (ctx.nearBankEnter) {
      this.enterBankAction(cb, lang);
      return true;
    }

    if (ctx.nearBankCash) {
      this.grabCashAction(cb, lang);
      return true;
    }

    if (ctx.nearBankExit) {
      this.exitBankEscapeAction(cb, lang);
      return true;
    }

    return false;
  }

  private exitApartmentAction(cb: StoryCallbacks, lang: Language): void {
    this.apartmentGroup.visible = false;
    cb.playDoorLatch();

    // Snap car to curb in case player exited fast while it was still driving in
    if (this.friendCar) {
      this.carArriving = false;
      this.friendCar.x = STORY_CAR_PARK_POS.x;
      this.friendCar.z = STORY_CAR_PARK_POS.z;
      this.friendCar.y = groundHeightAt(STORY_CAR_PARK_POS.x, STORY_CAR_PARK_POS.z);
      this.friendCar.heading = STORY_CAR_HEADING;
      this.friendCar.vx = 0;
      this.friendCar.vz = 0;
      this.friendCar.forwardSpeed = 0;
      this.friendCar.rig.root.position.set(this.friendCar.x, this.friendCar.y, this.friendCar.z);
      this.friendCar.rig.root.rotation.y = this.friendCar.heading;
    }

    cb.teleportPlayer({
      x: STORY_APARTMENT_EXTERIOR.x,
      y: groundHeightAt(STORY_APARTMENT_EXTERIOR.x, STORY_APARTMENT_EXTERIOR.z),
      z: STORY_APARTMENT_EXTERIOR.z + 1.4,
      heading: 0,
      inInterior: false,
      interiorFloorY: 0,
      halfW: 11,
      halfD: 11,
    });

    this.stage = 'board_car';
    this.openDialogue(
      [
        {
          speakerEn: 'Tariq',
          speakerAr: 'طارق',
          textEn:
            "Glad you made it! Hop in the driver's seat — you're driving us to the Bank. I set the route on your map!",
          textAr:
            'أهلاً بك! اركب معي السيارة وأنت سوق بنا للبنك، حددت لك الطريق والمكان على الخريطة!',
        },
      ],
      () => {
        cb.onHudChanged();
      }
    );
    cb.onHudChanged();
  }

  public onPlayerBoardedVehicle(veh: WorldVehicle, cb: StoryCallbacks, lang: Language): void {
    if (!this.active) return;
    if (this.stage === 'board_car') {
      if (this.friendCar && veh !== this.friendCar) {
        // Move friend passenger into whatever car player chose if they boarded another car
        this.attachPassengerToCar(veh);
      }
      this.stage = 'drive_to_bank';
      veh.headlightsOn = true;
      cb.onShowBanner(
        lang === 'ar' ? '🎯 الوجهة: بنك CityWorld' : '🎯 Destination: CityWorld Bank',
        lang === 'ar' ? 'اتبع المسار الأزرق إلى البنك' : 'Follow the GPS route to the Bank',
        'info'
      );
      cb.onHudChanged();
    }
  }

  private enterBankAction(cb: StoryCallbacks, lang: Language): void {
    this.bankGroup.visible = true;
    cb.playDoorLatch();
    cb.equipStoryPistol();

    // Friend stands just inside lobby behind player for cover
    this.detachPassengerFromCar();
    this.friendNpcGroup.visible = true;
    this.friendNpcGroup.position.set(STORY_BANK_CENTER.x - 2.2, STORY_BANK_CENTER.y, STORY_BANK_CENTER.z + 7.2);
    this.friendNpcGroup.rotation.y = Math.PI;

    cb.teleportPlayer({
      x: STORY_BANK_CENTER.x,
      y: STORY_BANK_CENTER.y,
      z: STORY_BANK_CENTER.z + 8.0,
      heading: Math.PI,
      inInterior: true,
      interiorFloorY: STORY_BANK_CENTER.y,
      halfW: STORY_BANK_HALF_W,
      halfD: STORY_BANK_HALF_D,
    });

    this.stage = 'shoot_guard';
    this.openDialogue(
      [
        {
          speakerEn: 'Bank Guard',
          speakerAr: 'حارس البنك',
          textEn: 'Freeze! What are you two doing inside the Bank after hours?!',
          textAr: 'توقّف مكانك! ماذا تفعلون داخل البنك في هذا الوقت المتأخر؟!',
        },
        {
          speakerEn: 'Tariq',
          speakerAr: 'طارق',
          textEn: 'No turning back now! Take out that guard with your Pistol so we can reach the vault!',
          textAr: 'لا مجال للتراجع الآن! أطلق النار على الحارس بمسدسك لنتمكن من دخول الخزنة!',
        },
      ],
      () => {
        cb.equipStoryPistol();
        cb.onHudChanged();
      }
    );
    cb.onHudChanged();
  }

  private grabCashAction(cb: StoryCallbacks, lang: Language): void {
    if (this.cashGrabbed) return;
    this.cashGrabbed = true;
    this.cashGroup.visible = false;
    cb.playCashPickup();

    this.stage = 'exit_bank_escape';
    this.openDialogue(
      [
        {
          speakerEn: 'Tariq',
          speakerAr: 'طارق',
          textEn:
            'We got the $10,000! Wait — the silent alarm just tripped! Get outside fast and lose the cops!',
          textAr:
            'أخذنا الـ 10,000 دولار! لكن جهاز الإنذار اشتغل! اخرج للشارع بسرعة واهرب من الشرطة!',
        },
      ],
      () => {
        cb.onShowBanner(
          lang === 'ar' ? '🚨 تم تفعيل الإنذار!' : '🚨 Bank Alarm Triggered!',
          lang === 'ar' ? 'اخرج من باب البنك واهرب بسيارتك!' : 'Exit the Bank & escape the police!',
          'fail'
        );
        cb.onHudChanged();
      }
    );
    cb.onHudChanged();
  }

  private exitBankEscapeAction(cb: StoryCallbacks, lang: Language): void {
    this.bankGroup.visible = false;
    this.friendNpcGroup.visible = false;
    this.alarmLight.intensity = 0;
    cb.playDoorLatch();

    // Ensure getaway car sits clean & repaired right in front of the Bank on road dt_ew_1
    if (!this.friendCar || this.friendCar.exploded) {
      this.friendCar = cb.spawnGetawayCar(STORY_BANK_CAR_PARK_POS.x, STORY_BANK_CAR_PARK_POS.z, Math.PI / 2);
    } else {
      this.friendCar.x = STORY_BANK_CAR_PARK_POS.x;
      this.friendCar.z = STORY_BANK_CAR_PARK_POS.z;
      this.friendCar.y = groundHeightAt(this.friendCar.x, this.friendCar.z);
      this.friendCar.heading = Math.PI / 2;
      this.friendCar.vx = 0;
      this.friendCar.vz = 0;
      this.friendCar.forwardSpeed = 0;
      this.friendCar.hp = 100;
      this.friendCar.rig.root.position.set(this.friendCar.x, this.friendCar.y, this.friendCar.z);
      this.friendCar.rig.root.rotation.y = this.friendCar.heading;
    }
    this.friendCar.headlightsOn = true;
    this.attachPassengerToCar(this.friendCar);

    cb.teleportPlayer({
      x: STORY_BANK_EXTERIOR.x,
      y: groundHeightAt(STORY_BANK_EXTERIOR.x, STORY_BANK_EXTERIOR.z),
      z: STORY_BANK_EXTERIOR.z + 2.5,
      heading: 0,
      inInterior: false,
      interiorFloorY: 0,
      halfW: 11,
      halfD: 11,
    });

    this.stage = 'escape_police';
    cb.triggerWantedStars(3);
    cb.onShowBanner(
      lang === 'ar' ? '🚓 مطاردة الشرطة — 3 نجوم!' : '🚓 Police Chase — 3 Wanted Stars!',
      lang === 'ar'
        ? 'اركب السيارة وابتعد عن الشرطة لمدة 20 ثانية للهرب!'
        : 'Get in the car and lose the cops for 20 seconds!',
      'fail'
    );
    cb.onHudChanged();
  }

  public update(
    dt: number,
    px: number,
    py: number,
    pz: number,
    inInterior: boolean,
    inVehicle: boolean,
    wantedStars: number,
    cb: StoryCallbacks,
    lang: Language
  ): void {
    if (!this.active) return;

    // 1. Friend driving getaway car up outside the apartment
    if (this.carArriving && this.friendCar) {
      this.carArrivalTimer += dt;
      const t = Math.min(1, this.carArrivalTimer / 4.2);
      const ease = 1 - Math.pow(1 - t, 2.2);
      const curX = THREE.MathUtils.lerp(STORY_CAR_START_POS.x, STORY_CAR_PARK_POS.x, ease);
      const curZ = STORY_CAR_PARK_POS.z;
      const curY = groundHeightAt(curX, curZ);
      this.friendCar.x = curX;
      this.friendCar.y = curY;
      this.friendCar.z = curZ;
      this.friendCar.heading = STORY_CAR_HEADING;
      this.friendCar.rig.root.position.set(curX, curY, curZ);
      this.friendCar.rig.root.rotation.y = STORY_CAR_HEADING;
      if (t >= 1) {
        this.carArriving = false;
      }
    }

    // 2. Auto-check apartment exit doorway if player walks onto the glowing exit door
    if (this.stage === 'exit_apartment' && inInterior && !this.isDialogueOpen()) {
      if (pz > STORY_APARTMENT_CENTER.z + STORY_APARTMENT_HALF_D - 1.1) {
        this.exitApartmentAction(cb, lang);
        return;
      }
    }

    // 3. Arriving near Bank during drive_to_bank
    if (this.exteriorBankGroup.visible) {
      this.exteriorBankRing.rotation.z += dt * 1.8;
    }

    if (this.stage === 'drive_to_bank' && !inInterior && !this.isDialogueOpen()) {
      const dBank = Math.hypot(px - STORY_BANK_EXTERIOR.x, pz - STORY_BANK_EXTERIOR.z);
      if (dBank < 21.0) {
        this.stage = 'enter_bank';
        this.openDialogue(
          [
            {
              speakerEn: 'Tariq',
              speakerAr: 'طارق',
              textEn:
                "We're right outside the Bank! Exit the car, head inside [E], and keep your Pistol ready.",
              textAr:
                'وصلنا أمام البنك! انزل من السيارة وادخل البنك [E] وجهّز مسدسك!',
            },
          ],
          () => {
            cb.onHudChanged();
          }
        );
        cb.onHudChanged();
      }
    }

    // 3B. Also allow stepping directly into glowing Bank doorway on foot during enter_bank
    if (this.stage === 'enter_bank' && !inInterior && !inVehicle && !this.isDialogueOpen()) {
      const dDoor = Math.hypot(px - STORY_BANK_EXTERIOR.x, pz - STORY_BANK_EXTERIOR.z);
      if (dDoor < 2.2) {
        this.enterBankAction(cb, lang);
        return;
      }
    }

    // 4. Inside Bank shoot_guard stage: Guard occasionally shoots back slowly so firefight is exciting
    if (this.stage === 'shoot_guard' && inInterior && this.guardAlive && !this.isDialogueOpen()) {
      this.guardRingMesh.rotation.z += dt * 2.5;
      this.guardFireCooldown -= dt;
      if (this.guardFireCooldown <= 0) {
        this.guardFireCooldown = 2.4;
        const gx = STORY_GUARD_WORLD_POS.x;
        const gy = STORY_GUARD_WORLD_POS.y + 1.35;
        const gz = STORY_GUARD_WORLD_POS.z;
        const dx = px - gx;
        const dy = py + 1.2 - gy;
        const dz = pz - gz;
        const len = Math.hypot(dx, dy, dz) || 1;
        this.guardGroup.rotation.y = Math.atan2(dx, dz);
        const hit = Math.random() < 0.42;
        cb.onGuardFireAtPlayer(gx, gy, gz, dx / len, dy / len, dz / len, hit);
      }
    }

    // 5. Auto-collect cash if player walks right up onto the vault table
    if (this.stage === 'grab_cash' && inInterior && !this.cashGrabbed && !this.isDialogueOpen()) {
      this.cashGroup.rotation.y += dt * 1.4;
      this.cashRingMesh.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.08);
      if (Math.hypot(px - STORY_CASH_WORLD_POS.x, pz - STORY_CASH_WORLD_POS.z) < 2.1) {
        this.grabCashAction(cb, lang);
        return;
      }
    }

    // 6. Bank alarm pulsing light + auto exit doorway check
    if (this.stage === 'exit_bank_escape' && inInterior) {
      this.alarmPhase += dt * 9;
      this.alarmLight.intensity = 10 + Math.sin(this.alarmPhase) * 10;
      if (!this.isDialogueOpen() && pz > STORY_BANK_CENTER.z + STORY_BANK_HALF_D - 1.15) {
        this.exitBankEscapeAction(cb, lang);
        return;
      }
    }

    // 7. Police Chase evasion completion check!
    if (this.stage === 'escape_police' && !inInterior && !this.isDialogueOpen()) {
      if (wantedStars === 0) {
        this.completeStory(cb);
      }
    }

    // Safety check if player exited car unexpectedly during drive_to_bank
    void inVehicle;
  }

  public completeStory(cb: StoryCallbacks): void {
    if (!this.active || this.stage === 'completed') return;
    this.stage = 'completed';
    this.completed = true;
    markStoryModeCompleted();
    this.detachPassengerFromCar();
    cb.awardStoryReward(STORY_REWARD_AMOUNT);
    cb.playCue('success');

    this.openDialogue(
      [
        {
          speakerEn: 'Tariq',
          speakerAr: 'طارق',
          textEn:
            "We pulled it off!! Not a single cop on our tail! Here's your $10,000 share — mission complete!",
          textAr:
            'عمل أسطوري يا صاحبي!! تخلصنا من الشرطة بالكامل! هذه حصتك 10,000 دولار — انتهت القصة بنجاح!',
        },
      ],
      () => {
        this.justFinishedModal = true;
        cb.onHudChanged();
      }
    );
    cb.onHudChanged();
  }

  public onPlayerWasted(cb: StoryCallbacks, lang: Language): void {
    if (!this.active) return;
    this.dialogueQueue = [];
    this.dialogueIndex = 0;
    this.onDialogueFinished = null;
    this.alarmLight.intensity = 0;
    cb.playCue('fail');
    cb.onShowBanner(
      lang === 'ar' ? 'خسرت في طور القصة!' : 'Story Mode Failed!',
      lang === 'ar' ? 'لقد متّ — سيتم إعادة القصة من البداية' : 'You died — Story Mode will restart from the beginning',
      'fail'
    );
    cb.onHudChanged();
  }

  public handlePlayerWastedInStory(cb: StoryCallbacks, lang: Language): boolean {
    if (!this.active) return false;
    const restarted = this.startStory(cb, lang);
    if (restarted) {
      cb.onShowBanner(
        lang === 'ar' ? 'خسرت المهمة — أُعيدت القصة من البداية' : 'Story Lost — Restarted from Beginning',
        lang === 'ar'
          ? 'ابدأ من الشقة وتابع مكالمة طارق من جديد'
          : 'Back at your apartment — answer Tariq to try again',
        'fail'
      );
      cb.onHudChanged();
    }
    return restarted;
  }

  public dispose(): void {
    this.detachPassengerFromCar();
    this.scene.remove(this.apartmentGroup, this.bankGroup, this.exteriorBankGroup, this.friendNpcGroup);
    this.disposables.forEach((d) => d.dispose());
  }
}
