import * as THREE from 'three';
import { ColliderBox, VehicleClassId, WeatherType } from '../types';
import {
  getBridgeDeckHeight,
  groundHeightAt,
  MAINLAND_BORDER,
  resolveCircleColliders,
  RICH_COUNTRY_BOUNDS,
  ROAD_SEGMENTS,
  WATER_LEVEL,
} from '../world/worldLayout';
import { VEHICLE_CATALOG } from './vehicleCatalog';
import { buildVehicleMesh, VehicleRig } from './vehicleMesh';

export interface WorldVehicle {
  id: string;
  classId: VehicleClassId;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  vy: number;
  heading: number;
  vx: number;
  vz: number;
  forwardSpeed: number;
  steerAngle: number;
  pitch: number;
  roll: number;
  pedalPhase: number;
  hp: number;
  exploded: boolean;
  headlightsOn: boolean;
  turnSignal: -1 | 0 | 1;
  occupiedByPlayer: boolean;
  braking: boolean;
  drifting: boolean;
  wingsDeployed: boolean;
  wingProgress: number;
  crashCooldown: number;
}

export interface CollidableVehicle {
  x: number;
  y: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  mass: number;
  length: number;
  width: number;
  hp: number;
  exploded: boolean;
  rig: VehicleRig;
}

export function isBicycleClass(cls: VehicleClassId): boolean {
  return cls === 'bicycle' || cls === 'speed_bicycle';
}

export function isAirplaneClass(cls: VehicleClassId): boolean {
  return cls === 'airplane';
}

export function isFlyingCarClass(cls: VehicleClassId): boolean {
  return cls === 'gold_wing_coupe' || cls === 'gold_wing_hyper' || cls === 'gold_wing_sovereign';
}

export function canFlyVehicle(cls: VehicleClassId): boolean {
  return isAirplaneClass(cls) || isFlyingCarClass(cls);
}

export function applyWorldPointDent(
  rig: VehicleRig,
  vx: number,
  vz: number,
  heading: number,
  hitX: number,
  hitZ: number,
  severity: number
): void {
  const dx = hitX - vx;
  const dz = hitZ - vz;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const localZ = dx * sinH + dz * cosH;
  const localX = dx * cosH - dz * sinH;
  rig.applyImpactDent(localX, localZ, severity);
}

/** Speed-scaled crash damage so slow taps do tiny wear & high-speed smashes crush health sharply */
export function computeSpeedDamage(impactSpeed: number, massRatio = 1, fragileMult = 1): number {
  if (impactSpeed <= 1.8) return 0;
  const base = (impactSpeed - 1.5) * (1.25 + impactSpeed * 0.085);
  return Math.max(2, Math.round(base * massRatio * fragileMult));
}

function intersectRayAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number
): { t: number; nx: number; ny: number; nz: number } | null {
  let tmin = 0;
  let tmax = 200;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  const checkAxis = (
    o: number,
    d: number,
    bmin: number,
    bmax: number,
    ax: number,
    ay: number,
    az: number
  ): boolean => {
    if (Math.abs(d) < 1e-6) {
      return o >= bmin && o <= bmax;
    }
    let t1 = (bmin - o) / d;
    let t2 = (bmax - o) / d;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = ax * sign;
      ny = ay * sign;
      nz = az * sign;
    }
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };

  if (!checkAxis(ox, dx, minX, maxX, 1, 0, 0)) return null;
  if (!checkAxis(oy, dy, minY, maxY, 0, 1, 0)) return null;
  if (!checkAxis(oz, dz, minZ, maxZ, 0, 0, 1)) return null;
  if (tmin <= 0) return null;
  return { t: tmin, nx, ny, nz };
}

/** Places a tiny bullet hole decal at the exact bullet penetration point on the car's exterior surface */
export function applyBulletImpactToVehicleRig(
  rig: VehicleRig,
  vx: number,
  vy: number,
  vz: number,
  heading: number,
  rayOx: number,
  rayOy: number,
  rayOz: number,
  rayDx: number,
  rayDy: number,
  rayDz: number
): void {
  const spec = rig.spec;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  const rx = rayOx - vx;
  const ry = rayOy - vy;
  const rz = rayOz - vz;
  const lox = rx * cosH - rz * sinH;
  const loz = rx * sinH + rz * cosH;
  const ldx = rayDx * cosH - rayDz * sinH;
  const ldz = rayDx * sinH + rayDz * cosH;

  const halfW = spec.width * 0.5;
  const halfL = spec.length * 0.5;
  const minHullY = spec.wheelRadius * 0.72;
  const midHullY = minHullY + (spec.height - minHullY) * 0.56;

  const hullHit = intersectRayAABB(
    lox,
    ry,
    loz,
    ldx,
    rayDy,
    ldz,
    -halfW,
    halfW,
    minHullY,
    midHullY,
    -halfL,
    halfL
  );
  const cabHit = isBicycleClass(spec.id)
    ? null
    : intersectRayAABB(
        lox,
        ry,
        loz,
        ldx,
        rayDy,
        ldz,
        -halfW * 0.84,
        halfW * 0.84,
        midHullY,
        spec.height,
        -halfL * 0.34,
        halfL * 0.3
      );

  const bestHit =
    hullHit && cabHit ? (hullHit.t < cabHit.t ? hullHit : cabHit) : hullHit ?? cabHit;

  if (bestHit) {
    const jx = (Math.random() - 0.5) * 0.06;
    const jy = (Math.random() - 0.5) * 0.06;
    const jz = (Math.random() - 0.5) * 0.06;
    const hx = lox + ldx * bestHit.t + (bestHit.nx === 0 ? jx : 0);
    const hy = ry + rayDy * bestHit.t + (bestHit.ny === 0 ? jy : 0);
    const hz = loz + ldz * bestHit.t + (bestHit.nz === 0 ? jz : 0);
    rig.addBulletHole(hx, hy, hz, bestHit.nx, bestHit.ny, bestHit.nz);
    return;
  }

  // Fallback to closest exterior face facing the incoming bullet
  const dirLen = Math.hypot(lox, loz) || 1;
  const uX = lox / dirLen;
  const uZ = loz / dirLen;
  const jitter = (Math.random() - 0.5) * 0.25;
  const hy = THREE.MathUtils.clamp(
    minHullY + (midHullY - minHullY) * (0.42 + Math.random() * 0.38),
    minHullY + 0.08,
    midHullY - 0.06
  );

  if (Math.abs(uX) * halfL > Math.abs(uZ) * halfW) {
    const signX = uX >= 0 ? 1 : -1;
    rig.addBulletHole(signX * halfW, hy, THREE.MathUtils.clamp(jitter, -halfL * 0.7, halfL * 0.7), signX, 0, 0);
  } else {
    const signZ = uZ >= 0 ? 1 : -1;
    rig.addBulletHole(THREE.MathUtils.clamp(jitter, -halfW * 0.7, halfW * 0.7), hy, signZ * halfL, 0, 0, signZ);
  }
}

export function findSafeVehicleSpawnNearPlayer(
  px: number,
  py: number,
  pz: number,
  playerHeading: number,
  classId: VehicleClassId,
  colliders: ColliderBox[],
  existingVehicles: Array<{ x: number; z: number }>,
  trafficAgents: Array<{ x: number; z: number; rig: VehicleRig }>
): { x: number; z: number; heading: number } {
  const spec = VEHICLE_CATALOG[classId];
  const halfW = spec.width * 0.5 + 0.65;
  const halfL = spec.length * 0.5 + 0.5;
  const checkRadius = Math.max(halfW, halfL * 0.55) + 0.55;

  const isSpotSafe = (cx: number, cz: number, candHeading: number): boolean => {
    const onMainland = cx >= -530 && cx <= 530 && cz >= -530 && cz <= 530;
    const onIsland = cx >= -290 && cx <= -70 && cz >= 660 && cz <= 860;
    const onRichCountry =
      cx >= RICH_COUNTRY_BOUNDS.minX + 15 &&
      cx <= RICH_COUNTRY_BOUNDS.maxX - 15 &&
      cz >= RICH_COUNTRY_BOUNDS.minZ + 15 &&
      cz <= RICH_COUNTRY_BOUNDS.maxZ - 15;
    if (!onMainland && !onIsland && !onRichCountry) return false;
    const cy = groundHeightAt(cx, cz);
    if (cy < WATER_LEVEL + 0.3) return false;
    if (Math.abs(cy - py) > 3.5) return false;
    if (Math.hypot(cx - px, cz - pz) < 2.7) return false;

    if (resolveCircleColliders(cx, cz, cy, checkRadius, colliders).hit) return false;

    const sinH = Math.sin(candHeading);
    const cosH = Math.cos(candHeading);
    const frontX = cx + sinH * (halfL * 0.55);
    const frontZ = cz + cosH * (halfL * 0.55);
    const rearX = cx - sinH * (halfL * 0.55);
    const rearZ = cz - cosH * (halfL * 0.55);
    if (resolveCircleColliders(frontX, frontZ, cy, halfW, colliders).hit) return false;
    if (resolveCircleColliders(rearX, rearZ, cy, halfW, colliders).hit) return false;

    for (const v of existingVehicles) {
      if (Math.hypot(cx - v.x, cz - v.z) < 4.0) return false;
    }
    for (const a of trafficAgents) {
      if (!a.rig.root.visible) continue;
      if (Math.hypot(cx - a.x, cz - a.z) < 3.8) return false;
    }
    return true;
  };

  // Search concentric forward-biased arcs near player
  const distances = [5.4, 7.6, 10.2, 13.5, 17.5, 22.5, 28.0];
  const angleOffsets = [0, 0.45, -0.45, 0.9, -0.9, 1.45, -1.45, 2.1, -2.1, Math.PI];

  for (const dist of distances) {
    for (const angOff of angleOffsets) {
      const worldAng = playerHeading + angOff;
      const cx = px + Math.sin(worldAng) * dist;
      const cz = pz + Math.cos(worldAng) * dist;
      const candHeading = playerHeading + Math.PI * 0.5;
      if (isSpotSafe(cx, cz, candHeading)) {
        return { x: cx, z: cz, heading: candHeading };
      }
      if (isSpotSafe(cx, cz, playerHeading)) {
        return { x: cx, z: cz, heading: playerHeading };
      }
    }
  }

  // Fallback: project onto nearest road segments and sample clear lane spot
  const sortedRoads = [...ROAD_SEGMENTS]
    .map((seg) => {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const lenSq = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq));
      const rx = seg.x1 + dx * t;
      const rz = seg.z1 + dz * t;
      return { seg, rx, rz, d: Math.hypot(px - rx, pz - rz) };
    })
    .sort((a, b) => a.d - b.d);

  for (const item of sortedRoads.slice(0, 4)) {
    const roadHeading = Math.atan2(item.seg.x2 - item.seg.x1, item.seg.z2 - item.seg.z1);
    for (const shift of [0, 6, -6, 12, -12]) {
      const cx = item.rx + Math.sin(roadHeading) * shift;
      const cz = item.rz + Math.cos(roadHeading) * shift;
      if (isSpotSafe(cx, cz, roadHeading)) {
        return { x: cx, z: cz, heading: roadHeading };
      }
    }
  }

  const bestRoad = sortedRoads[0];
  return {
    x: bestRoad.rx,
    z: bestRoad.rz,
    heading: Math.atan2(bestRoad.seg.x2 - bestRoad.seg.x1, bestRoad.seg.z2 - bestRoad.seg.z1),
  };
}

export function resolveVehiclePairCollision(
  a: CollidableVehicle,
  b: CollidableVehicle
): { collided: boolean; contactX: number; contactZ: number; impactSpeed: number; dmgA: number; dmgB: number } {
  // Ignore vehicles separated vertically (fixes mid-air airplanes colliding with ground cars below!)
  if (Math.abs(a.y - b.y) > 4.2) {
    return { collided: false, contactX: 0, contactZ: 0, impactSpeed: 0, dmgA: 0, dmgB: 0 };
  }

  const offA = Math.max(0.25, a.length * 0.28);
  const offB = Math.max(0.25, b.length * 0.28);
  const radA = a.width * 0.5;
  const radB = b.width * 0.5;
  const minDist = radA + radB;

  const sinA = Math.sin(a.heading);
  const cosA = Math.cos(a.heading);
  const sinB = Math.sin(b.heading);
  const cosB = Math.cos(b.heading);

  const ptsA = [
    { x: a.x + sinA * offA, z: a.z + cosA * offA },
    { x: a.x - sinA * offA, z: a.z - cosA * offA },
  ];
  const ptsB = [
    { x: b.x + sinB * offB, z: b.z + cosB * offB },
    { x: b.x - sinB * offB, z: b.z - cosB * offB },
  ];

  let bestDist = Infinity;
  let bestAx = 0;
  let bestAz = 0;
  let bestBx = 0;
  let bestBz = 0;

  for (const pa of ptsA) {
    for (const pb of ptsB) {
      const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      if (d < bestDist) {
        bestDist = d;
        bestAx = pa.x;
        bestAz = pa.z;
        bestBx = pb.x;
        bestBz = pb.z;
      }
    }
  }

  if (bestDist >= minDist) {
    return { collided: false, contactX: 0, contactZ: 0, impactSpeed: 0, dmgA: 0, dmgB: 0 };
  }

  let nx = bestAx - bestBx;
  let nz = bestAz - bestBz;
  if (bestDist > 0.001) {
    nx /= bestDist;
    nz /= bestDist;
  } else {
    nx = 1;
    nz = 0;
  }

  const overlap = minDist - bestDist;
  const invMassA = 1 / Math.max(20, a.mass);
  const invMassB = 1 / Math.max(20, b.mass);
  const totalInv = invMassA + invMassB;

  a.x += nx * overlap * (invMassA / totalInv);
  a.z += nz * overlap * (invMassA / totalInv);
  b.x -= nx * overlap * (invMassB / totalInv);
  b.z -= nz * overlap * (invMassB / totalInv);

  const rvx = a.vx - b.vx;
  const rvz = a.vz - b.vz;
  const relVn = rvx * nx + rvz * nz;

  const contactX = (bestAx + bestBx) * 0.5;
  const contactZ = (bestAz + bestBz) * 0.5;
  let impactSpeed = Math.abs(relVn);

  if (relVn < 0) {
    const restitution = 0.28;
    const j = (-(1 + restitution) * relVn) / totalInv;
    a.vx += j * invMassA * nx;
    a.vz += j * invMassA * nz;
    b.vx -= j * invMassB * nx;
    b.vz -= j * invMassB * nz;
  } else {
    impactSpeed = Math.hypot(rvx, rvz) * 0.4;
  }

  if (impactSpeed > 2.2) {
    const sev = Math.min(0.95, (impactSpeed / 26) * (isBicycleClass(a.rig.spec.id) ? 1.5 : 1.0));
    applyWorldPointDent(a.rig, a.x, a.z, a.heading, contactX, contactZ, sev);
    applyWorldPointDent(b.rig, b.x, b.z, b.heading, contactX, contactZ, Math.min(0.95, impactSpeed / 26));
  }

  const massRatioA = Math.min(1.8, Math.max(0.75, b.mass / Math.max(150, a.mass)));
  const massRatioB = Math.min(1.8, Math.max(0.75, a.mass / Math.max(150, b.mass)));
  const fragA = isBicycleClass(a.rig.spec.id) ? 3.2 : 1.0;
  const fragB = isBicycleClass(b.rig.spec.id) ? 3.2 : 1.0;
  const dmgA = computeSpeedDamage(impactSpeed, massRatioA, fragA);
  const dmgB = computeSpeedDamage(impactSpeed, massRatioB, fragB);

  return { collided: true, contactX, contactZ, impactSpeed, dmgA, dmgB };
}

export class VehicleManager {
  public vehicles: WorldVehicle[] = [];
  private scene: THREE.Scene;
  private signalTimer = 0;

  private smokeMesh: THREE.InstancedMesh;
  private smokeCount = 85;
  private smokeData: Array<{
    active: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    maxAge: number;
    dark: boolean;
  }> = [];
  private smokeCursor = 0;
  private smokeDirty = false;
  private activeHeadlightSpot: THREE.SpotLight;
  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.activeHeadlightSpot = new THREE.SpotLight(0xfffbeb, 22, 62, Math.PI / 5, 0.45, 1.4);
    this.activeHeadlightSpot.visible = false;
    scene.add(this.activeHeadlightSpot);
    scene.add(this.activeHeadlightSpot.target);

    const smokeGeo = new THREE.SphereGeometry(0.28, 6, 6);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.48,
      roughness: 1,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, this.smokeCount);
    this.smokeMesh.frustumCulled = false;
    for (let i = 0; i < this.smokeCount; i++) {
      this.smokeData.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.7,
        dark: false,
      });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this._dummy.matrix);
      this.smokeMesh.setColorAt(i, this._color.setHex(0xd1d5db));
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
    scene.add(this.smokeMesh);
  }

  public spawnVehicle(
    id: string,
    classId: VehicleClassId,
    x: number,
    z: number,
    heading = 0,
    colorHex?: number,
    withSpotLight = true
  ): WorldVehicle {
    const rig = buildVehicleMesh(classId, colorHex, withSpotLight && !isBicycleClass(classId));
    const y = Math.max(groundHeightAt(x, z), WATER_LEVEL);
    rig.root.position.set(x, y, z);
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const v: WorldVehicle = {
      id,
      classId,
      rig,
      x,
      y,
      z,
      vy: 0,
      heading,
      vx: 0,
      vz: 0,
      forwardSpeed: 0,
      steerAngle: 0,
      pitch: 0,
      roll: 0,
      pedalPhase: 0,
      hp: 100,
      exploded: false,
      headlightsOn: false,
      turnSignal: 0,
      occupiedByPlayer: false,
      braking: false,
      drifting: false,
      wingsDeployed: false,
      wingProgress: 0,
      crashCooldown: 0,
    };
    this.vehicles.push(v);
    return v;
  }

  public spawnHijackedVehicle(
    classId: VehicleClassId,
    x: number,
    z: number,
    heading: number,
    colorHex?: number
  ): WorldVehicle {
    const hijackedIndices: number[] = [];
    this.vehicles.forEach((v, idx) => {
      if (v.id.startsWith('hijacked_') && !v.occupiedByPlayer) {
        hijackedIndices.push(idx);
      }
    });
    if (hijackedIndices.length >= 6) {
      const oldestIdx = hijackedIndices[0];
      const old = this.vehicles[oldestIdx];
      this.scene.remove(old.rig.root);
      old.rig.dispose();
      this.vehicles.splice(oldestIdx, 1);
    }
    const veh = this.spawnVehicle(`hijacked_${Date.now()}`, classId, x, z, heading, colorHex, false);
    veh.pitch = 0.07; // Suspension hop animation on entry
    return veh;
  }

  public spawnInitialFleet(): void {
    const spawns: Array<{ classId: VehicleClassId; x: number; z: number; heading: number }> = [
      { classId: 'sedan', x: -12, z: -28, heading: Math.PI * 0.5 },
      { classId: 'sports', x: -24, z: -48, heading: 0 },
      { classId: 'supercar', x: 14, z: -18, heading: Math.PI * 0.75 },
      { classId: 'motorcycle', x: 8, z: -32, heading: -Math.PI * 0.25 },
      { classId: 'bicycle', x: -5, z: -24, heading: 0.4 },
      { classId: 'speed_bicycle', x: 11, z: -25, heading: -0.6 },
      { classId: 'bicycle', x: -165, z: 95, heading: 1.2 },
      { classId: 'speed_bicycle', x: -65, z: 302, heading: Math.PI * 0.5 },
      { classId: 'taxi', x: -50, z: -46, heading: Math.PI * 0.5 },
      { classId: 'ambulance', x: -64, z: -60, heading: 0 },
      { classId: 'luxury', x: -210, z: -145, heading: Math.PI * 0.5 },
      { classId: 'supercar', x: -240, z: -170, heading: -Math.PI * 0.5 },
      { classId: 'suv', x: -265, z: -185, heading: 0 },
      { classId: 'hatchback', x: -215, z: 75, heading: Math.PI },
      { classId: 'muscle', x: 155, z: 95, heading: -Math.PI * 0.5 },
      { classId: 'truck', x: 215, z: 18, heading: Math.PI * 0.5 },
      { classId: 'pickup', x: 195, z: -15, heading: 0 },
      { classId: 'van', x: 255, z: -60, heading: 0 },
      { classId: 'bus', x: 105, z: 48, heading: Math.PI * 0.5 },
      { classId: 'convertible', x: -85, z: 278, heading: Math.PI * 0.5 },
      { classId: 'coupe', x: 260, z: -225, heading: 0 },
      { classId: 'hyper_viper', x: 22, z: -48, heading: Math.PI * 0.5 },
      { classId: 'track_phantom', x: -195, z: -135, heading: 0 },
      { classId: 'nova_x', x: -18, z: -34, heading: Math.PI * 0.5 },
      { classId: 'nova_x', x: 300, z: -260, heading: -Math.PI * 0.5 },
      { classId: 'police', x: 52, z: -26, heading: Math.PI },
      // Golden Flying Cars Showcase + Flyable Airplanes
      { classId: 'gold_wing_coupe', x: 74, z: 108, heading: Math.PI },
      { classId: 'gold_wing_hyper', x: -168, z: -130, heading: Math.PI * 0.5 },
      { classId: 'gold_wing_sovereign', x: 245, z: -295, heading: Math.PI * 0.5 },
      { classId: 'airplane', x: 262, z: -310, heading: Math.PI * 0.5 },
      { classId: 'airplane', x: -180, z: 730, heading: Math.PI },
      // Auroria Rich Country Return Fleet (Golden Runway & Mansion Estates)
      { classId: 'airplane', x: 795, z: -195, heading: 0 },
      { classId: 'gold_wing_sovereign', x: 830, z: -140, heading: -Math.PI * 0.5 },
      { classId: 'gold_wing_hyper', x: 1015, z: -188, heading: Math.PI * 0.5 },
      { classId: 'gold_wing_coupe', x: 912, z: -15, heading: 0 },
    ];

    spawns.forEach((s, i) => {
      this.spawnVehicle(`world_veh_${i}`, s.classId, s.x, s.z, s.heading, undefined, false);
    });
  }

  public findNearestVehicle(x: number, z: number, maxDist = 4.6): WorldVehicle | null {
    let best: WorldVehicle | null = null;
    let bestDistSq = maxDist * maxDist;
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const dx = v.x - x;
      const dz = v.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = v;
      }
    }
    return best;
  }

  public applyDamage(v: WorldVehicle, amount: number, onExploded: (veh: WorldVehicle) => void): void {
    if (v.exploded || amount <= 0) return;
    v.hp = Math.max(0, v.hp - amount);
    if (v.hp <= 0) {
      v.exploded = true;
      v.rig.setCharred(true);
      if (isBicycleClass(v.classId)) {
        v.vx *= 0.2;
        v.vz *= 0.2;
        v.forwardSpeed = 0;
        v.roll = 1.15; // Bicycle tips over broken on the pavement
      } else {
        v.vy = 6.8; // Launch car upward on fiery detonation
        v.vx *= 0.25;
        v.vz *= 0.25;
        v.forwardSpeed = 0;
        v.pitch = 0.16;
        v.roll = (Math.random() > 0.5 ? 1 : -1) * 0.18;
      }
      onExploded(v);
    }
  }

  public emitSmoke(x: number, y: number, z: number, dark = false): void {
    const p = this.smokeData[this.smokeCursor];
    this.smokeCursor = (this.smokeCursor + 1) % this.smokeCount;
    p.active = true;
    p.dark = dark;
    p.x = x + (Math.random() - 0.5) * 0.25;
    p.y = y + 0.15;
    p.z = z + (Math.random() - 0.5) * 0.25;
    p.vx = (Math.random() - 0.5) * 1.2;
    p.vy = (dark ? 1.4 : 0.8) + Math.random() * 1.0;
    p.vz = (Math.random() - 0.5) * 1.2;
    p.age = 0;
    p.maxAge = dark ? 0.85 : 0.55 + Math.random() * 0.35;
  }

  public update(
    dt: number,
    activeVehicle: WorldVehicle | null,
    input: { throttle: number; steer: number; handbrake: boolean; climb?: number },
    colliders: ColliderBox[],
    weather: WeatherType,
    isNight: boolean,
    onCollision: (intensity: number) => void,
    onVehicleExploded: (v: WorldVehicle) => void,
    onHitWorldBorder?: () => void,
    focusX = 0,
    focusZ = 0
  ): void {
    this.signalTimer += dt;
    const blinkOn = Math.floor(this.signalTimer * 2.5) % 2 === 0;
    const rainGripFactor = weather === 'rain' ? 0.72 : 1.0;
    let activeSpotUsed = false;

    for (const v of this.vehicles) {
      const spec = v.rig.spec;
      const isBike = isBicycleClass(v.classId);
      const isPlane = isAirplaneClass(v.classId);
      const isFlyingCar = isFlyingCarClass(v.classId);
      const terrainFloorNow = groundHeightAt(v.x, v.z);
      if (v.crashCooldown > 0) v.crashCooldown = Math.max(0, v.crashCooldown - dt);

      // Animate deployable 24K golden wings + jet thruster glow on flying cars
      if (isFlyingCar) {
        const targetWing = v.wingsDeployed && !v.exploded ? 1 : 0;
        v.wingProgress = THREE.MathUtils.damp(v.wingProgress, targetWing, 7.5, dt);
        const foldAngle = 1.48 * (1 - v.wingProgress);
        if (v.rig.wingLeftPivot) {
          v.rig.wingLeftPivot.rotation.y = foldAngle;
          v.rig.wingLeftPivot.rotation.z = -v.wingProgress * 0.07;
        }
        if (v.rig.wingRightPivot) {
          v.rig.wingRightPivot.rotation.y = -foldAngle;
          v.rig.wingRightPivot.rotation.z = v.wingProgress * 0.07;
        }
        if (v.rig.thrusterGlowMat) {
          v.rig.thrusterGlowMat.emissiveIntensity =
            v.exploded ? 0 : 1.1 + v.wingProgress * 2.2 + (v === activeVehicle ? Math.abs(v.forwardSpeed) * 0.025 : 0);
        }
      }

      const canFlyMode = isPlane || (isFlyingCar && (v.wingsDeployed || v.y > terrainFloorNow + 0.55));
      const isAirborne = canFlyMode && v.y > terrainFloorNow + 0.45;

      if (v === activeVehicle && !v.exploded) {
        const climbInput = input.climb ?? (input.handbrake ? 1 : 0);
        // Auto-deploy wings when player holds Climb while speeding in a Golden Flying Car
        if (isFlyingCar && !v.wingsDeployed && climbInput > 0.1 && Math.abs(v.forwardSpeed) > 16) {
          v.wingsDeployed = true;
        }

        const accel = input.throttle > 0 ? spec.acceleration : spec.braking;
        const targetSteer = input.steer * (canFlyMode ? 0.64 : 0.54);
        v.steerAngle = THREE.MathUtils.damp(v.steerAngle, targetSteer, canFlyMode ? 7 : 10, dt);

        const fwdX = Math.sin(v.heading);
        const fwdZ = Math.cos(v.heading);
        const rightX = Math.cos(v.heading);
        const rightZ = -Math.sin(v.heading);

        let fSpeed = v.vx * fwdX + v.vz * fwdZ;
        let latSpeed = v.vx * rightX + v.vz * rightZ;

        v.braking = false;
        if (input.throttle > 0.05) {
          fSpeed += input.throttle * accel * dt;
        } else if (input.throttle < -0.05) {
          if (fSpeed > 1.5) {
            fSpeed = Math.max(0, fSpeed - spec.braking * dt);
            v.braking = true;
          } else {
            fSpeed += input.throttle * spec.acceleration * 0.65 * dt;
          }
        } else {
          fSpeed = THREE.MathUtils.damp(fSpeed, isAirborne ? 34 : 0, canFlyMode ? 0.45 : isBike ? 1.8 : 1.35, dt);
        }

        if (input.handbrake && !canFlyMode) {
          fSpeed = THREE.MathUtils.damp(fSpeed, 0, 2.8, dt);
          v.braking = true;
        }

        fSpeed = THREE.MathUtils.clamp(fSpeed, isPlane ? -8 : -spec.reverseSpeed, spec.maxSpeed);

        const speedFactor = canFlyMode
          ? Math.max(0.35, Math.min(1, Math.abs(fSpeed) / 14))
          : Math.min(1, Math.abs(fSpeed) / (isBike ? 2.5 : 6.5));
        const dirSign = fSpeed >= -0.2 ? 1 : -1;
        const turnRate =
          v.steerAngle * spec.steeringSpeed * speedFactor * dirSign * (!canFlyMode && input.handbrake ? 1.35 : 1.0);
        v.heading += turnRate * dt;

        const gripLambda = canFlyMode
          ? 5.5
          : input.handbrake
            ? 2.2 * rainGripFactor
            : (1 - spec.driftGrip) * 65 * rainGripFactor + 3.5;
        latSpeed = THREE.MathUtils.damp(latSpeed, 0, gripLambda, dt);

        v.drifting = !isBike && !canFlyMode && (Math.abs(latSpeed) > 3.8 || (input.handbrake && Math.abs(fSpeed) > 8));

        const newFwdX = Math.sin(v.heading);
        const newFwdZ = Math.cos(v.heading);
        const newRightX = Math.cos(v.heading);
        const newRightZ = -Math.sin(v.heading);

        v.vx = newFwdX * fSpeed + newRightX * latSpeed;
        v.vz = newFwdZ * fSpeed + newRightZ * latSpeed;
        v.forwardSpeed = fSpeed;
        v.pedalPhase += Math.abs(fSpeed) * dt * 1.45;

        // Flight lift, climb (Space / climb > 0), and descent (Shift / climb < 0)
        if (canFlyMode) {
          const liftThreshold = isFlyingCar ? 15 : 18;
          if (fSpeed > liftThreshold) {
            if (climbInput > 0.1) {
              v.vy = THREE.MathUtils.damp(v.vy, 17, 4.5, dt);
            } else if (climbInput < -0.1) {
              v.vy = THREE.MathUtils.damp(v.vy, -14, 4.5, dt);
            } else if (v.y <= terrainFloorNow + 0.25 && fSpeed > (isFlyingCar ? 42 : 38) && input.throttle > 0.2) {
              v.vy = 6.8;
            } else if (v.y > terrainFloorNow + 0.35) {
              v.vy = THREE.MathUtils.damp(v.vy, 0, 4.0, dt);
            }
          } else if (v.y > terrainFloorNow + 0.2) {
            v.vy = THREE.MathUtils.damp(v.vy, -6.5, 2.5, dt);
          }

          if (v.y > 145) {
            v.y = 145;
            v.vy = Math.min(0, v.vy);
          }
          v.y += v.vy * dt;

          const targetPlanePitch = THREE.MathUtils.clamp(-v.vy * 0.025, -0.35, 0.32);
          const airFactor = v.y > terrainFloorNow + 0.45 ? 1.0 : 0.25;
          const targetPlaneRoll = -v.steerAngle * 0.65 * airFactor;
          v.pitch = THREE.MathUtils.damp(v.pitch, targetPlanePitch, 6, dt);
          v.roll = THREE.MathUtils.damp(v.roll, targetPlaneRoll, 6, dt);
        } else {
          const targetPitch = -input.throttle * 0.045 + (v.braking ? 0.055 : 0);
          const leanFactor = isBike || v.classId === 'motorcycle' ? -0.35 : -0.14;
          const targetRoll = v.steerAngle * Math.min(1, Math.abs(fSpeed) / 14) * leanFactor;
          v.pitch = THREE.MathUtils.damp(v.pitch, targetPitch, 9, dt);
          v.roll = THREE.MathUtils.damp(v.roll, targetRoll, 9, dt);
        }

        if (v.drifting && Math.random() < 0.55) {
          const rearX = v.x - newFwdX * (spec.length * 0.34);
          const rearZ = v.z - newFwdZ * (spec.length * 0.34);
          this.emitSmoke(rearX, v.y, rearZ, false);
        }
      } else {
        v.vx = THREE.MathUtils.damp(v.vx, 0, canFlyMode ? 1.4 : 3.5, dt);
        v.vz = THREE.MathUtils.damp(v.vz, 0, canFlyMode ? 1.4 : 3.5, dt);
        v.forwardSpeed = Math.hypot(v.vx, v.vz);
        v.pitch = THREE.MathUtils.damp(v.pitch, v.exploded && !isBike ? 0.06 : 0, 6, dt);
        if (!v.exploded) {
          v.roll = THREE.MathUtils.damp(v.roll, 0, 8, dt);
        }
        v.drifting = false;
      }

      // Spin airplane propeller
      if (isPlane && v.rig.propellerPivot && !v.exploded) {
        const rpmSpeed = v === activeVehicle ? 16 + Math.abs(v.forwardSpeed) * 0.9 : Math.abs(v.forwardSpeed) * 0.8;
        v.rig.propellerPivot.rotation.z += rpmSpeed * dt;
      }

      if (!isBike && (v.hp < 40 || v.exploded) && Math.random() < (v.exploded ? 0.45 : 0.3)) {
        const hoodX = v.x + Math.sin(v.heading) * (spec.length * 0.34);
        const hoodZ = v.z + Math.cos(v.heading) * (spec.length * 0.34);
        this.emitSmoke(hoodX, v.y + spec.height * 0.55, hoodZ, true);
      }

      const isResting =
        v !== activeVehicle &&
        !v.exploded &&
        !canFlyMode &&
        Math.abs(v.vx) < 0.01 &&
        Math.abs(v.vz) < 0.01 &&
        Math.abs(v.vy) < 0.01 &&
        Math.abs(v.pitch) < 0.005 &&
        Math.abs(v.roll) < 0.005 &&
        (!isFlyingCar || Math.abs(v.wingProgress - (v.wingsDeployed ? 1 : 0)) < 0.005);

      if (!isResting) {
        // World border limits: ground vehicles stay within Mainland or Auroria;
        // Airplanes & Winged Flying Cars unlock full airspace to travel between CityWorld, Island & Auroria Rich Country!
        const rawNextX = v.x + v.vx * dt;
        const rawNextZ = v.z + v.vz * dt;
        const inRichCountryArea = v.x >= RICH_COUNTRY_BOUNDS.minX - 5 && v.x <= RICH_COUNTRY_BOUNDS.maxX + 5;
        const minX = canFlyMode ? -720 : inRichCountryArea ? RICH_COUNTRY_BOUNDS.minX + 10 : -MAINLAND_BORDER;
        const maxX = canFlyMode ? 1320 : inRichCountryArea ? RICH_COUNTRY_BOUNDS.maxX - 10 : MAINLAND_BORDER;
        const minZ = canFlyMode ? -620 : inRichCountryArea ? RICH_COUNTRY_BOUNDS.minZ + 10 : -MAINLAND_BORDER;
        const maxZ = canFlyMode ? 980 : inRichCountryArea ? RICH_COUNTRY_BOUNDS.maxZ - 10 : MAINLAND_BORDER;
        const nextX = THREE.MathUtils.clamp(rawNextX, minX, maxX);
        const nextZ = THREE.MathUtils.clamp(rawNextZ, minZ, maxZ);

        if (v === activeVehicle && (nextX !== rawNextX || nextZ !== rawNextZ)) {
          v.vx *= 0.2;
          v.vz *= 0.2;
          if (onHitWorldBorder) onHitWorldBorder();
        }

        const radius = isPlane ? 2.1 : spec.width * 0.55;
        const col = resolveCircleColliders(nextX, nextZ, v.y, radius, colliders);

        if (col.hit) {
          const impactSpeed = Math.hypot(v.vx, v.vz);
          const minHit = isBike ? 1.8 : 2.8;
          if (impactSpeed > minHit) {
            const hitDirX = col.x - nextX;
            const hitDirZ = col.z - nextZ;
            const contactX = v.x - hitDirX * 2;
            const contactZ = v.z - hitDirZ * 2;
            const sev = Math.min(0.85, (impactSpeed / 28) * (isBike ? 1.5 : canFlyMode ? 0.45 : 1.0));
            applyWorldPointDent(v.rig, v.x, v.z, v.heading, contactX, contactZ, sev);
            if (v === activeVehicle && v.crashCooldown <= 0) {
              v.crashCooldown = canFlyMode ? 0.9 : 0.25;
              onCollision(Math.min(1, impactSpeed / 28));
              const rawDmg = computeSpeedDamage(impactSpeed, 1.0, isBike ? 3.2 : canFlyMode ? 0.35 : 1.0);
              const safeDmg = canFlyMode ? Math.min(22, rawDmg) : rawDmg;
              this.applyDamage(v, safeDmg, onVehicleExploded);
            }
          }
          v.vx *= canFlyMode ? -0.35 : -0.25;
          v.vz *= canFlyMode ? -0.35 : -0.25;
        }
        v.x = col.x;
        v.z = col.z;

        const terrainY = groundHeightAt(v.x, v.z);
        const bridgeY = getBridgeDeckHeight(v.x, v.z);
        let supportY = terrainY;
        if (bridgeY !== null && v.y >= bridgeY - 1.8) {
          supportY = Math.max(terrainY, bridgeY);
        }

        if (canFlyMode) {
          if (v.y <= supportY) {
            v.y = supportY;
            if (v.vy < -24 && v === activeVehicle && v.crashCooldown <= 0) {
              v.crashCooldown = 0.85;
              onCollision(Math.min(1, Math.abs(v.vy) / 28));
              this.applyDamage(v, Math.min(32, Math.round(Math.abs(v.vy + 18) * 1.4)), onVehicleExploded);
            }
            v.vy = Math.max(0, v.vy);
          } else if (v !== activeVehicle && v.y > supportY + 0.05) {
            v.vy -= 18 * dt;
            v.y = Math.max(supportY, v.y + v.vy * dt);
          }
        } else if (v.y > supportY + 0.05 || v.vy > 0.2) {
          v.vy -= 22 * dt;
          v.y += v.vy * dt;
          if (v.y <= supportY) {
            if (v.vy < -8 && v === activeVehicle) {
              onCollision(Math.min(1, Math.abs(v.vy) / 18));
            }
            v.y = supportY;
            v.vy = 0;
          }
        } else {
          v.y = supportY;
          v.vy = 0;
        }

        if (v.y < WATER_LEVEL - 0.5 && !canFlyMode) {
          v.vx *= 0.92;
          v.vz *= 0.92;
        }

        v.rig.root.position.set(v.x, v.y, v.z);
        v.rig.root.rotation.y = v.heading;
        v.rig.bodyGroup.rotation.x = v.pitch;
        v.rig.bodyGroup.rotation.z = v.roll;

        const spinDelta = (v.forwardSpeed * dt) / spec.wheelRadius;
        for (let idx = 0; idx < v.rig.wheelPivots.length; idx++) {
          if (isPlane ? idx === 0 : v.classId === 'motorcycle' || isBike ? idx === 0 : idx < 2) {
            v.rig.wheelPivots[idx].rotation.y = v.steerAngle;
          }
        }
        for (let idx = 0; idx < v.rig.wheelSpinMeshes.length; idx++) {
          v.rig.wheelSpinMeshes[idx].rotation.x += spinDelta;
        }
      }

      const lightsActive = !v.exploded && (v.occupiedByPlayer ? v.headlightsOn || isNight : isNight);
      const targetHeadGlow = v.classId === 'nova_x' ? (lightsActive ? 2.6 : 1.75) : lightsActive ? 2.4 : 0.15;
      const heads = v.rig.headlightMeshes;
      if (heads.length > 0 && (heads[0].material as THREE.MeshStandardMaterial).emissiveIntensity !== targetHeadGlow) {
        for (let idx = 0; idx < heads.length; idx++) {
          (heads[idx].material as THREE.MeshStandardMaterial).emissiveIntensity = targetHeadGlow;
        }
      }

      if (v === activeVehicle && lightsActive && !isBike) {
        activeSpotUsed = true;
        const sinH = Math.sin(v.heading);
        const cosH = Math.cos(v.heading);
        this.activeHeadlightSpot.visible = true;
        this.activeHeadlightSpot.color.setHex(v.classId === 'nova_x' ? 0xe0ffff : 0xfffbeb);
        this.activeHeadlightSpot.position.set(v.x + sinH * (spec.length * 0.48), v.y + 0.85, v.z + cosH * (spec.length * 0.48));
        this.activeHeadlightSpot.target.position.set(v.x + sinH * (spec.length * 0.5 + 18), v.y, v.z + cosH * (spec.length * 0.5 + 18));
        this.activeHeadlightSpot.target.updateMatrixWorld();
      }

      if (v.rig.underglowLight) {
        const dSq = (v.x - focusX) * (v.x - focusX) + (v.z - focusZ) * (v.z - focusZ);
        const showUnderglow = !v.exploded && (v === activeVehicle || dSq < 3025);
        v.rig.underglowLight.visible = showUnderglow;
        if (showUnderglow) {
          v.rig.underglowLight.intensity = isNight ? 8.5 : 5.5;
        }
      }

      const targetTailGlow = v.exploded
        ? 0
        : v.braking
          ? 2.8
          : v.classId === 'nova_x'
            ? 1.5
            : lightsActive
              ? 0.9
              : 0.2;
      const tails = v.rig.taillightMeshes;
      if (tails.length > 0 && (tails[0].material as THREE.MeshStandardMaterial).emissiveIntensity !== targetTailGlow) {
        for (let idx = 0; idx < tails.length; idx++) {
          (tails[idx].material as THREE.MeshStandardMaterial).emissiveIntensity = targetTailGlow;
        }
      }

      const leftSigGlow = !v.exploded && v.turnSignal === -1 && blinkOn ? 2.6 : 0;
      const rightSigGlow = !v.exploded && v.turnSignal === 1 && blinkOn ? 2.6 : 0;
      if ((v.rig.leftSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity !== leftSigGlow) {
        (v.rig.leftSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = leftSigGlow;
      }
      if ((v.rig.rightSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity !== rightSigGlow) {
        (v.rig.rightSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = rightSigGlow;
      }

      if ((v.classId === 'police' || v.classId === 'ambulance') && v.rig.lightbarRed && v.rig.lightbarBlue) {
        const strobe = Math.floor(this.signalTimer * 7) % 2 === 0;
        const active = !v.exploded && v.occupiedByPlayer && v.headlightsOn;
        (v.rig.lightbarRed.material as THREE.MeshStandardMaterial).emissiveIntensity =
          active && strobe ? 3.5 : 0.2;
        (v.rig.lightbarBlue.material as THREE.MeshStandardMaterial).emissiveIntensity =
          active && !strobe ? 3.5 : 0.2;
      }
    }
    if (!activeSpotUsed && this.activeHeadlightSpot.visible) {
      this.activeHeadlightSpot.visible = false;
    }

    // Active player vehicle vs parked WorldVehicles physical collision
    if (activeVehicle) {
      for (const other of this.vehicles) {
        if (other === activeVehicle) continue;
        const aWrap: CollidableVehicle = {
          x: activeVehicle.x,
          y: activeVehicle.y,
          z: activeVehicle.z,
          heading: activeVehicle.heading,
          vx: activeVehicle.vx,
          vz: activeVehicle.vz,
          mass: activeVehicle.rig.spec.mass,
          length: activeVehicle.rig.spec.length,
          width: activeVehicle.rig.spec.width,
          hp: activeVehicle.hp,
          exploded: activeVehicle.exploded,
          rig: activeVehicle.rig,
        };
        const bWrap: CollidableVehicle = {
          x: other.x,
          y: other.y,
          z: other.z,
          heading: other.heading,
          vx: other.vx,
          vz: other.vz,
          mass: other.rig.spec.mass,
          length: other.rig.spec.length,
          width: other.rig.spec.width,
          hp: other.hp,
          exploded: other.exploded,
          rig: other.rig,
        };
        const res = resolveVehiclePairCollision(aWrap, bWrap);
        if (res.collided) {
          activeVehicle.x = aWrap.x;
          activeVehicle.z = aWrap.z;
          activeVehicle.vx = aWrap.vx;
          activeVehicle.vz = aWrap.vz;
          other.x = bWrap.x;
          other.z = bWrap.z;
          other.vx = bWrap.vx;
          other.vz = bWrap.vz;
          if (res.impactSpeed > 2.0) {
            onCollision(Math.min(1, res.impactSpeed / 26));
            this.applyDamage(activeVehicle, res.dmgA, onVehicleExploded);
            this.applyDamage(other, res.dmgB, onVehicleExploded);
          }
        }
      }
    }

    let anySmokeColor = false;
    let anySmokeUpdated = false;
    for (let i = 0; i < this.smokeCount; i++) {
      const p = this.smokeData[i];
      if (!p.active) continue;
      anySmokeUpdated = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.01);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = p.age / p.maxAge;
        this._dummy.position.set(p.x, p.y, p.z);
        this._dummy.scale.setScalar((p.dark ? 0.9 : 0.6) + t * 2.2);
        this._color.setHex(p.dark ? 0x27272a : 0xd1d5db);
        this.smokeMesh.setColorAt(i, this._color);
        anySmokeColor = true;
      }
      this._dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anySmokeUpdated || this.smokeDirty) {
      this.smokeMesh.instanceMatrix.needsUpdate = true;
      this.smokeDirty = anySmokeUpdated;
    }
    if (anySmokeColor && this.smokeMesh.instanceColor) {
      this.smokeMesh.instanceColor.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.vehicles.forEach((v) => v.rig.dispose());
    this.smokeMesh.geometry.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
  }
}
