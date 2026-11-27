import * as THREE from 'three';
import { ColliderBox, Language, WeaponId } from '../types';
import { groundHeightAt } from '../world/worldLayout';

export const ZOMBIE_STORY_COOLDOWN_KEY = 'cityworld_story_zombie_cooldown_v1';
export const ZOMBIE_STORY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export const ZOMBIE_KILL_CASH = 50;
export const ZOMBIE_EXTRACT_THRESHOLD = 10;
export const ZOMBIE_BASE_ACTIVE = 14;
export const ZOMBIE_MAX_ACTIVE = 90;

export function getZombieTargetCount(killsSoFar: number): number {
  const waveTier = Math.floor(Math.max(0, killsSoFar) / 5);
  return Math.min(ZOMBIE_MAX_ACTIVE, Math.round(ZOMBIE_BASE_ACTIVE * Math.pow(1.5, waveTier)));
}

export const STORY2_HOUSE_CENTER = { x: 2040, y: -120, z: 0 };
export const STORY2_HOUSE_HALF_W = 7.4;
export const STORY2_HOUSE_HALF_D = 7.4;
export const STORY2_EXTERIOR_POS = { x: -205, y: 0, z: 31 };

export interface HouseGearPickup {
  id: string;
  isFirstTablePart: boolean;
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  weaponGrant: WeaponId;
  ammoGrant: number;
  armorGrant: number;
  labelEn: string;
  labelAr: string;
  collected: boolean;
  group: THREE.Group;
  ring: THREE.Mesh;
  itemMesh: THREE.Group;
}

export type ZombieVariant = 'shambler' | 'runner' | 'brute';

export interface ActiveZombie {
  id: string;
  variant: ZombieVariant;
  x: number;
  y: number;
  z: number;
  heading: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  attackCooldown: number;
  walkPhase: number;
  deathTimer: number;
  dead: boolean;
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
}

export function loadZombieStoryCooldownUntil(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(ZOMBIE_STORY_COOLDOWN_KEY);
    if (!raw) return 0;
    const val = Number(raw);
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

export function setZombieStoryCooldownOneHour(): number {
  const until = Date.now() + ZOMBIE_STORY_COOLDOWN_MS;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ZOMBIE_STORY_COOLDOWN_KEY, String(until));
    } catch {
      // Ignore storage failures
    }
  }
  return until;
}

export function clearZombieStoryCooldown(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(ZOMBIE_STORY_COOLDOWN_KEY);
    } catch {
      // Ignore
    }
  }
}

export class ZombieStoryHelper {
  private scene: THREE.Scene;
  private disposables: Array<{ dispose: () => void }> = [];

  public houseGroup: THREE.Group;
  public exitDoorRing: THREE.Mesh;
  public pickups: HouseGearPickup[] = [];

  public hordeGroup: THREE.Group;
  public zombies: ActiveZombie[] = [];
  private zombieIdCounter = 0;
  private spawnTimer = 0;

  public extractBeaconGroup: THREE.Group;
  public extractRingMesh: THREE.Mesh;
  public extractPos = { x: STORY2_EXTERIOR_POS.x + 24, z: STORY2_EXTERIOR_POS.z + 18 };
  public extractBeaconActive = false;

  // Shared zombie geometries & materials for crisp FPS even with 28+ zombies
  private zHeadGeo: THREE.BoxGeometry;
  private zTorsoGeo: THREE.BoxGeometry;
  private zLegGeo: THREE.BoxGeometry;
  private zArmGeo: THREE.BoxGeometry;
  private zEyeGeo: THREE.BoxGeometry;
  private zSkinMat: THREE.MeshStandardMaterial;
  private zBruteSkinMat: THREE.MeshStandardMaterial;
  private zEyeMat: THREE.MeshStandardMaterial;
  private zShirtShamblerMat: THREE.MeshStandardMaterial;
  private zShirtRunnerMat: THREE.MeshStandardMaterial;
  private zShirtBruteMat: THREE.MeshStandardMaterial;
  private zPantsMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.zHeadGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    this.zTorsoGeo = new THREE.BoxGeometry(0.56, 0.74, 0.32);
    this.zLegGeo = new THREE.BoxGeometry(0.22, 0.78, 0.24);
    this.zArmGeo = new THREE.BoxGeometry(0.18, 0.64, 0.18);
    this.zEyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.04);

    this.zSkinMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.75 });
    this.zBruteSkinMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 });
    this.zEyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.2,
    });
    this.zShirtShamblerMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.85 });
    this.zShirtRunnerMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
    this.zShirtBruteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    this.zPantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    this.disposables.push(
      this.zHeadGeo,
      this.zTorsoGeo,
      this.zLegGeo,
      this.zArmGeo,
      this.zEyeGeo,
      this.zSkinMat,
      this.zBruteSkinMat,
      this.zEyeMat,
      this.zShirtShamblerMat,
      this.zShirtRunnerMat,
      this.zShirtBruteMat,
      this.zPantsMat
    );

    const builtHouse = this.buildLoneHouseInterior();
    this.houseGroup = builtHouse.root;
    this.exitDoorRing = builtHouse.exitRing;
    this.houseGroup.visible = false;
    this.scene.add(this.houseGroup);

    this.hordeGroup = new THREE.Group();
    this.hordeGroup.visible = false;
    this.scene.add(this.hordeGroup);

    const builtBeacon = this.buildExtractBeacon();
    this.extractBeaconGroup = builtBeacon.root;
    this.extractRingMesh = builtBeacon.ring;
    this.extractBeaconGroup.visible = false;
    this.scene.add(this.extractBeaconGroup);
  }

  private buildLoneHouseInterior(): { root: THREE.Group; exitRing: THREE.Mesh } {
    const group = new THREE.Group();
    group.position.set(STORY2_HOUSE_CENTER.x, STORY2_HOUSE_CENTER.y, STORY2_HOUSE_CENTER.z);

    // Visual room slightly larger than walkable bounds so third-person camera stays inside walls cleanly
    const wallHalfW = 9.4;
    const wallHalfD = 9.4;
    const W = wallHalfW * 2;
    const D = wallHalfD * 2;
    const H = 5.2;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.78 });
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.92 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4a24, roughness: 0.72 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.55, roughness: 0.35 });
    const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.8 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.5,
    });
    this.disposables.push(
      floorMat,
      rugMat,
      wallMat,
      trimMat,
      ceilingMat,
      woodMat,
      darkMetalMat,
      bedSheetMat,
      pillowMat,
      screenMat
    );

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.34, D), floorMat);
    floor.position.y = -0.17;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W, 0.34, D), ceilingMat);
    ceiling.position.y = H + 0.17;
    group.add(floor, ceiling);

    const rug = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.04, 5.2), rugMat);
    rug.position.set(0, 0.02, -0.6);
    group.add(rug);

    // Walls
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.36), wallMat);
    backWall.position.set(0, H / 2, -wallHalfD - 0.18);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.36), wallMat);
    frontWall.position.set(0, H / 2, wallHalfD + 0.18);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.36, H, D), wallMat);
    leftWall.position.set(-wallHalfW - 0.18, H / 2, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.36, H, D), wallMat);
    rightWall.position.set(wallHalfW + 0.18, H / 2, 0);
    group.add(backWall, frontWall, leftWall, rightWall);

    // Bed where player wakes up (+4.7, -4.6)
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.48, 3.2), woodMat);
    bedFrame.position.set(4.8, 0.24, -4.6);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.32, 2.95), bedSheetMat);
    mattress.position.set(4.8, 0.58, -4.6);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.65), pillowMat);
    pillow.position.set(4.8, 0.78, -5.65);
    group.add(bedFrame, mattress, pillow);

    // Nightstand + glowing phone screen showing error red glow
    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.95), woodMat);
    nightstand.position.set(2.85, 0.36, -5.3);
    const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.48), trimMat);
    phoneBody.position.set(2.85, 0.75, -5.3);
    const phoneGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.4), screenMat);
    phoneGlow.position.set(2.85, 0.755, -5.3);
    group.add(nightstand, phoneBody, phoneGlow);

    // Central tactical table for the first weapon part (0, -0.9)
    const centerTable = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 1.5), woodMat);
    centerTable.position.set(0, 0.425, -0.9);
    const tableTrim = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 1.6), darkMetalMat);
    tableTrim.position.set(0, 0.86, -0.9);
    group.add(centerTable, tableTrim);

    // Kitchen counter (-4.8, -4.6)
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.96, 1.3), darkMetalMat);
    counter.position.set(-4.8, 0.48, -4.6);
    group.add(counter);

    // Bookshelf / Workbench (-5.2, 2.2)
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 2.6), woodMat);
    shelf.position.set(-5.6, 0.95, 2.2);
    group.add(shelf);

    // Storage Crate (4.8, 1.8)
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), woodMat);
    crate.position.set(4.8, 0.45, 1.8);
    group.add(crate);

    // Armory Locker near door (2.9, 5.2)
    const locker = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.0), darkMetalMat);
    locker.position.set(3.0, 0.7, 5.4);
    group.add(locker);

    // Front Exit Door (0, 1.4, +9.1)
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      metalness: 0.3,
    });
    const exitRingMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const exitRingGeo = new THREE.TorusGeometry(1.05, 0.07, 8, 28);
    this.disposables.push(doorMat, exitRingMat, exitRingGeo);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.9, 0.22), doorMat);
    door.position.set(0, 1.45, wallHalfD - 0.15);
    const exitRing = new THREE.Mesh(exitRingGeo, exitRingMat);
    exitRing.rotation.x = Math.PI / 2;
    exitRing.position.set(0, 0.06, STORY2_HOUSE_HALF_D - 1.25);
    group.add(door, exitRing);

    // Bright indoor lighting matching Story 1 apartment intensity (22-26)
    const mainLight = new THREE.PointLight(0xffedd5, 26, 26, 1.4);
    mainLight.position.set(0, 4.4, 0);
    const tableLight = new THREE.PointLight(0x22d3ee, 14, 12, 1.4);
    tableLight.position.set(0, 2.8, -0.9);
    const bedLight = new THREE.PointLight(0xfef3c7, 12, 11, 1.4);
    bedLight.position.set(4.2, 3.0, -4.4);
    const doorLight = new THREE.PointLight(0x22c55e, 12, 11, 1.4);
    doorLight.position.set(0, 2.8, 6.2);
    group.add(mainLight, tableLight, bedLight, doorLight);

    // Build 5 glowing weapon / ammo pickup nodes inside house
    const defs: Array<{
      id: string;
      isFirstTablePart: boolean;
      localX: number;
      localZ: number;
      yHeight: number;
      color: number;
      weaponGrant: WeaponId;
      ammoGrant: number;
      armorGrant: number;
      labelEn: string;
      labelAr: string;
    }> = [
      {
        id: 'table_pistol',
        isFirstTablePart: true,
        localX: 0,
        localZ: -0.9,
        yHeight: 1.15,
        color: 0x22d3ee,
        weaponGrant: 'pistol',
        ammoGrant: 120,
        armorGrant: 0,
        labelEn: 'CW-9 Pistol Part & Mags',
        labelAr: 'قطعة المسدس الأولى والذخيرة',
      },
      {
        id: 'counter_smg',
        isFirstTablePart: false,
        localX: -4.4,
        localZ: -3.2,
        yHeight: 0.95,
        color: 0xf59e0b,
        weaponGrant: 'smg',
        ammoGrant: 240,
        armorGrant: 0,
        labelEn: 'Vortex SMG Kit & Ammo',
        labelAr: 'قطع رشاش Vortex والرصاص',
      },
      {
        id: 'shelf_shotgun',
        isFirstTablePart: false,
        localX: -3.8,
        localZ: 2.2,
        yHeight: 0.95,
        color: 0xf97316,
        weaponGrant: 'shotgun',
        ammoGrant: 64,
        armorGrant: 0,
        labelEn: 'Striker Shotgun & Shells',
        labelAr: 'قطع شوزن Striker والطلقات',
      },
      {
        id: 'crate_rifle',
        isFirstTablePart: false,
        localX: 3.4,
        localZ: 1.8,
        yHeight: 0.95,
        color: 0x38bdf8,
        weaponGrant: 'rifle',
        ammoGrant: 220,
        armorGrant: 0,
        labelEn: 'Titan AR-15 Parts & Ammo',
        labelAr: 'قطع بندقية Titan والرصاص',
      },
      {
        id: 'locker_ammo',
        isFirstTablePart: false,
        localX: 2.9,
        localZ: 4.1,
        yHeight: 0.95,
        color: 0x4ade80,
        weaponGrant: 'rifle',
        ammoGrant: 180,
        armorGrant: 100,
        labelEn: 'Heavy Ammo Crate & Vest',
        labelAr: 'صندوق ذخيرة ثقيلة ودرع',
      },
    ];

    this.pickups = defs.map((d) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(d.localX, 0, d.localZ);

      const ringGeo = new THREE.TorusGeometry(0.88, 0.06, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: d.color });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;

      const itemMesh = new THREE.Group();
      itemMesh.position.y = d.yHeight;
      const boxGeo = new THREE.BoxGeometry(0.54, 0.24, 0.34);
      const barrelGeo = new THREE.BoxGeometry(0.14, 0.14, 0.68);
      const itemMat = new THREE.MeshStandardMaterial({
        color: d.color,
        emissive: d.color,
        emissiveIntensity: 0.85,
        metalness: 0.55,
        roughness: 0.25,
      });
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.5,
      });
      this.disposables.push(ringGeo, ringMat, boxGeo, barrelGeo, itemMat, brassMat);

      const crateBox = new THREE.Mesh(boxGeo, itemMat);
      const barrel = new THREE.Mesh(barrelGeo, brassMat);
      barrel.position.set(0, 0.16, 0);
      itemMesh.add(crateBox, barrel);

      pGroup.add(ring, itemMesh);
      group.add(pGroup);

      return {
        id: d.id,
        isFirstTablePart: d.isFirstTablePart,
        localX: d.localX,
        localZ: d.localZ,
        worldX: STORY2_HOUSE_CENTER.x + d.localX,
        worldZ: STORY2_HOUSE_CENTER.z + d.localZ,
        weaponGrant: d.weaponGrant,
        ammoGrant: d.ammoGrant,
        armorGrant: d.armorGrant,
        labelEn: d.labelEn,
        labelAr: d.labelAr,
        collected: false,
        group: pGroup,
        ring,
        itemMesh,
      };
    });

    return { root: group, exitRing };
  }

  private buildExtractBeacon(): { root: THREE.Group; ring: THREE.Mesh } {
    const root = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(2.6, 0.14, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const pillarGeo = new THREE.CylinderGeometry(0.35, 1.2, 36, 12, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    this.disposables.push(ringGeo, ringMat, pillarGeo, pillarMat);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;

    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 18;

    const light = new THREE.PointLight(0x22c55e, 3.0, 22);
    light.position.y = 3.5;

    root.add(ring, pillar, light);
    return { root, ring };
  }

  public resetForNewRun(): void {
    this.clearZombies();
    this.spawnTimer = 0;
    this.extractBeaconActive = false;
    this.extractBeaconGroup.visible = false;
    this.exitDoorRing.visible = false;
    for (const p of this.pickups) {
      p.collected = false;
      p.group.visible = p.isFirstTablePart;
    }
  }

  public revealAllRemainingPickups(): void {
    for (const p of this.pickups) {
      p.group.visible = !p.collected;
    }
  }

  public hideAll(): void {
    this.houseGroup.visible = false;
    this.hordeGroup.visible = false;
    this.extractBeaconGroup.visible = false;
    this.extractBeaconActive = false;
    this.clearZombies();
  }

  public clearZombies(): void {
    for (const z of this.zombies) {
      this.hordeGroup.remove(z.root);
    }
    this.zombies = [];
  }

  private createZombieMesh(variant: ZombieVariant): {
    root: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
  } {
    const root = new THREE.Group();
    const skinMat = variant === 'brute' ? this.zBruteSkinMat : this.zSkinMat;
    const shirtMat =
      variant === 'runner'
        ? this.zShirtRunnerMat
        : variant === 'brute'
          ? this.zShirtBruteMat
          : this.zShirtShamblerMat;

    const leftLeg = new THREE.Mesh(this.zLegGeo, this.zPantsMat);
    leftLeg.position.set(-0.14, 0.42, 0);
    const rightLeg = new THREE.Mesh(this.zLegGeo, this.zPantsMat);
    rightLeg.position.set(0.14, 0.42, 0);

    const torso = new THREE.Mesh(this.zTorsoGeo, shirtMat);
    torso.position.set(0, 1.18, 0);

    // Classic outstretched zombie arms!
    const leftArm = new THREE.Mesh(this.zArmGeo, skinMat);
    leftArm.position.set(-0.38, 1.32, 0.28);
    leftArm.rotation.x = -Math.PI * 0.48;

    const rightArm = new THREE.Mesh(this.zArmGeo, skinMat);
    rightArm.position.set(0.38, 1.32, 0.28);
    rightArm.rotation.x = -Math.PI * 0.48;

    const head = new THREE.Mesh(this.zHeadGeo, skinMat);
    head.position.set(0, 1.74, 0.04);

    const leftEye = new THREE.Mesh(this.zEyeGeo, this.zEyeMat);
    leftEye.position.set(-0.08, 1.77, 0.22);
    const rightEye = new THREE.Mesh(this.zEyeGeo, this.zEyeMat);
    rightEye.position.set(0.08, 1.77, 0.22);

    root.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, leftEye, rightEye);
    if (variant === 'brute') {
      root.scale.set(1.32, 1.28, 1.32);
    } else if (variant === 'runner') {
      root.scale.set(0.95, 0.96, 0.95);
    }
    return { root, leftLeg, rightLeg, leftArm, rightArm };
  }

  private isInsideBuildingCollider(x: number, z: number, colliders: ColliderBox[]): boolean {
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (x >= b.minX - 0.9 && x <= b.maxX + 0.9 && z >= b.minZ - 0.9 && z <= b.maxZ + 0.9) {
        return true;
      }
    }
    return false;
  }

  private spawnOneZombie(px: number, pz: number, colliders: ColliderBox[], killsSoFar: number): void {
    let sx = px;
    let sz = pz;
    let found = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 17 + Math.random() * 29;
      const cx = THREE.MathUtils.clamp(px + Math.cos(ang) * dist, -380, 380);
      const cz = THREE.MathUtils.clamp(pz + Math.sin(ang) * dist, -380, 380);
      if (!this.isInsideBuildingCollider(cx, cz, colliders)) {
        sx = cx;
        sz = cz;
        found = true;
        break;
      }
    }
    if (!found) return;

    const r = Math.random();
    const runnerBias = Math.min(0.45, 0.2 + killsSoFar * 0.008);
    const bruteBias = Math.min(0.22, 0.08 + killsSoFar * 0.004);
    const variant: ZombieVariant = r < bruteBias ? 'brute' : r < bruteBias + runnerBias ? 'runner' : 'shambler';

    const maxHp = variant === 'brute' ? 140 : variant === 'runner' ? 50 : 75;
    const speed = variant === 'brute' ? 2.8 : variant === 'runner' ? 5.6 + Math.min(1.4, killsSoFar * 0.03) : 3.6;
    const damage = variant === 'brute' ? 16 : variant === 'runner' ? 9 : 11;
    const radius = variant === 'brute' ? 1.35 : 1.05;

    const mesh = this.createZombieMesh(variant);
    const sy = groundHeightAt(sx, sz);
    mesh.root.position.set(sx, sy, sz);
    this.hordeGroup.add(mesh.root);

    this.zombieIdCounter++;
    this.zombies.push({
      id: `zombie_${this.zombieIdCounter}`,
      variant,
      x: sx,
      y: sy,
      z: sz,
      heading: Math.atan2(px - sx, pz - sz),
      hp: maxHp,
      maxHp,
      speed,
      damage,
      radius,
      attackCooldown: 0.4,
      walkPhase: Math.random() * Math.PI * 2,
      deathTimer: 0,
      dead: false,
      ...mesh,
    });
  }

  public activateExtractBeacon(px: number, pz: number, colliders: ColliderBox[]): void {
    if (this.extractBeaconActive) return;
    this.extractBeaconActive = true;
    // Place extraction flare nearby on an open spot ~24m from player
    let ex = px + 22;
    let ez = pz + 16;
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = (attempt / 16) * Math.PI * 2;
      const cx = THREE.MathUtils.clamp(px + Math.cos(ang) * 24, -360, 360);
      const cz = THREE.MathUtils.clamp(pz + Math.sin(ang) * 24, -360, 360);
      if (!this.isInsideBuildingCollider(cx, cz, colliders)) {
        ex = cx;
        ez = cz;
        break;
      }
    }
    this.extractPos = { x: ex, z: ez };
    const ey = groundHeightAt(ex, ez);
    this.extractBeaconGroup.position.set(ex, ey, ez);
    this.extractBeaconGroup.visible = true;
  }

  public updateHouseAnimations(dt: number): void {
    const t = performance.now() * 0.003;
    for (const p of this.pickups) {
      if (!p.group.visible || p.collected) continue;
      p.ring.rotation.z += dt * 2.1;
      p.itemMesh.rotation.y += dt * 1.8;
      p.itemMesh.position.y = (p.isFirstTablePart ? 1.15 : 0.95) + Math.sin(t + p.localX) * 0.09;
    }
    if (this.exitDoorRing.visible) {
      this.exitDoorRing.rotation.z += dt * 1.8;
    }
  }

  public updateHorde(
    dt: number,
    px: number,
    pz: number,
    killsSoFar: number,
    colliders: ColliderBox[],
    onBitePlayer: (dmg: number) => void
  ): void {
    if (this.extractBeaconActive) {
      this.extractRingMesh.rotation.z += dt * 2.2;
      this.extractRingMesh.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.07);
    }

    // Every 5 zombie kills, multiply active zombie swarm by +50% (0.5x growth per 5 kills)
    const targetCount = getZombieTargetCount(killsSoFar);
    const aliveCount = this.zombies.filter((z) => !z.dead).length;
    this.spawnTimer -= dt;
    if (aliveCount < targetCount && this.spawnTimer <= 0) {
      const deficit = targetCount - aliveCount;
      const burst = Math.min(6, Math.max(2, Math.ceil(deficit / 3)));
      for (let i = 0; i < burst; i++) {
        this.spawnOneZombie(px, pz, colliders, killsSoFar);
      }
      this.spawnTimer = 0.22;
    }

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead) {
        z.deathTimer -= dt;
        z.root.rotation.x = Math.min(Math.PI / 2, z.root.rotation.x + dt * 5.2);
        z.root.position.y = Math.max(z.y - 0.15, z.root.position.y - dt * 0.5);
        if (z.deathTimer <= 0) {
          this.hordeGroup.remove(z.root);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      const dx = px - z.x;
      const dz = pz - z.z;
      const dist = Math.hypot(dx, dz) || 0.001;

      // Recycle stragglers very far from player so action stays intense nearby
      if (dist > 72) {
        this.hordeGroup.remove(z.root);
        this.zombies.splice(i, 1);
        continue;
      }

      const dirX = dx / dist;
      const dirZ = dz / dist;
      z.heading = Math.atan2(dirX, dirZ);

      // Soft repulsion between zombies so swarms fan out organically
      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.zombies.length; j++) {
        if (i === j || this.zombies[j].dead) continue;
        const oz = this.zombies[j];
        const sx = z.x - oz.x;
        const sz = z.z - oz.z;
        const dSq = sx * sx + sz * sz;
        if (dSq > 0.001 && dSq < 1.35 * 1.35) {
          const d = Math.sqrt(dSq);
          const push = (1.35 - d) * 1.8;
          sepX += (sx / d) * push;
          sepZ += (sz / d) * push;
        }
      }

      if (dist > 1.25) {
        const nextX = z.x + (dirX * z.speed + sepX) * dt;
        const nextZ = z.z + (dirZ * z.speed + sepZ) * dt;
        if (!this.isInsideBuildingCollider(nextX, z.z, colliders)) z.x = nextX;
        if (!this.isInsideBuildingCollider(z.x, nextZ, colliders)) z.z = nextZ;
        z.y = groundHeightAt(z.x, z.z);
      }

      z.walkPhase += dt * z.speed * 2.3;
      const swing = Math.sin(z.walkPhase) * 0.48;
      z.leftLeg.rotation.x = swing;
      z.rightLeg.rotation.x = -swing;
      z.leftArm.rotation.x = -Math.PI * 0.48 + Math.sin(z.walkPhase * 0.7) * 0.14;
      z.rightArm.rotation.x = -Math.PI * 0.48 - Math.sin(z.walkPhase * 0.7) * 0.14;

      z.root.position.set(z.x, z.y, z.z);
      z.root.rotation.y = z.heading;

      z.attackCooldown = Math.max(0, z.attackCooldown - dt);
      if (dist < 1.65 && z.attackCooldown <= 0) {
        z.attackCooldown = 0.85;
        onBitePlayer(z.damage);
      }
    }
  }

  public damageZombie(
    zombieId: string,
    dmg: number
  ): { hit: boolean; killed: boolean; x: number; y: number; z: number } {
    const z = this.zombies.find((item) => item.id === zombieId && !item.dead);
    if (!z) return { hit: false, killed: false, x: 0, y: 0, z: 0 };
    z.hp -= Math.max(12, dmg);
    // Knockback slightly on hit
    const backX = Math.sin(z.heading) * 0.45;
    const backZ = Math.cos(z.heading) * 0.45;
    z.x -= backX;
    z.z -= backZ;
    z.root.position.set(z.x, z.y, z.z);

    if (z.hp <= 0) {
      z.dead = true;
      z.deathTimer = 1.4;
      return { hit: true, killed: true, x: z.x, y: z.y, z: z.z };
    }
    return { hit: true, killed: false, x: z.x, y: z.y, z: z.z };
  }

  public getPickupCount(): { collected: number; total: number } {
    const collected = this.pickups.filter((p) => p.collected).length;
    return { collected, total: this.pickups.length };
  }

  public getNearestUncollectedPickup(px: number, pz: number, maxDist: number): HouseGearPickup | null {
    let best: HouseGearPickup | null = null;
    let bestDist = maxDist;
    for (const p of this.pickups) {
      if (!p.group.visible || p.collected) continue;
      const d = Math.hypot(px - p.worldX, pz - p.worldZ);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  public getNearestPickupTarget(px: number, pz: number): HouseGearPickup | null {
    return this.getNearestUncollectedPickup(px, pz, Infinity);
  }

  public getPromptLabel(p: HouseGearPickup, lang: Language): string {
    return lang === 'ar' ? `[E] أخذ ${p.labelAr}` : `[E] Collect ${p.labelEn}`;
  }

  public dispose(): void {
    this.clearZombies();
    this.scene.remove(this.houseGroup, this.hordeGroup, this.extractBeaconGroup);
    this.disposables.forEach((d) => d.dispose());
  }
}
