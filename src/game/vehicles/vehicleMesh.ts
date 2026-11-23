import * as THREE from 'three';
import { VehicleClassId, VehicleSpec } from '../types';
import { VEHICLE_CATALOG } from './vehicleCatalog';

export interface VehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontGroup: THREE.Group;
  rearGroup: THREE.Group;
  lowerHull: THREE.Mesh;
  cabinGroup: THREE.Group;
  wheelPivots: THREE.Group[];
  wheelSpinMeshes: THREE.Object3D[];
  propellerPivot?: THREE.Group;
  wingLeftPivot?: THREE.Group;
  wingRightPivot?: THREE.Group;
  thrusterGlowMat?: THREE.MeshStandardMaterial;
  npcLeftLegPivot?: THREE.Group;
  npcRightLegPivot?: THREE.Group;
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  leftSignalMesh: THREE.Mesh;
  rightSignalMesh: THREE.Mesh;
  headlightSpot?: THREE.SpotLight;
  underglowLight?: THREE.PointLight;
  underglowPlane?: THREE.Mesh;
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
  spec: VehicleSpec;
  paintMat: THREE.MeshStandardMaterial;
  damage: { front: number; rear: number; left: number; right: number; charred: boolean };
  applyImpactDent: (localX: number, localZ: number, severity: number) => void;
  addBulletHole: (localX: number, localY: number, localZ: number, nx: number, ny: number, nz: number) => void;
  setCharred: (charred: boolean) => void;
  resetDamage: () => void;
  dispose: () => void;
}

const sharedTireGeoCache = new Map<string, THREE.BufferGeometry>();
function getTireGeo(radius: number, width: number): THREE.CylinderGeometry {
  const key = `${radius.toFixed(2)}_${width.toFixed(2)}`;
  let geo = sharedTireGeoCache.get(key) as THREE.CylinderGeometry | undefined;
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, width, 16);
    geo.rotateZ(Math.PI / 2);
    sharedTireGeoCache.set(key, geo);
  }
  return geo;
}

let cachedCyanGlowTex: THREE.CanvasTexture | null = null;
function getCyanGlowTexture(): THREE.CanvasTexture {
  if (cachedCyanGlowTex) return cachedCyanGlowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 245, 255, 0.92)');
  grad.addColorStop(0.45, 'rgba(0, 230, 255, 0.55)');
  grad.addColorStop(0.78, 'rgba(0, 210, 255, 0.18)');
  grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedCyanGlowTex = new THREE.CanvasTexture(c);
  return cachedCyanGlowTex;
}

const sharedDarkTrimMat = new THREE.MeshStandardMaterial({
  color: 0x16181d,
  roughness: 0.78,
  metalness: 0.22,
});
const sharedChromeMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.16,
  metalness: 0.94,
});
const sharedTireMat = new THREE.MeshStandardMaterial({
  color: 0x0e1014,
  roughness: 0.88,
  metalness: 0.05,
});
const sharedBulletHoleGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.016, 7);
const sharedBulletHoleMat = new THREE.MeshStandardMaterial({
  color: 0x050507,
  roughness: 0.92,
  metalness: 0.15,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

const sharedRimGeoCache = new Map<string, THREE.BufferGeometry>();
function getRimGeo(radius: number, width: number): THREE.CylinderGeometry {
  const key = `rim_${radius.toFixed(2)}_${width.toFixed(2)}`;
  let geo = sharedRimGeoCache.get(key) as THREE.CylinderGeometry | undefined;
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.02, 8);
    geo.rotateZ(Math.PI / 2);
    sharedRimGeoCache.set(key, geo);
  }
  return geo;
}

// Shared NPC cyclist/motorcyclist geometry + materials so traffic bikes always have visible riders
const npcRiderGeo = {
  torso: new THREE.BoxGeometry(0.4, 0.5, 0.22),
  head: new THREE.BoxGeometry(0.24, 0.24, 0.24),
  helmet: new THREE.BoxGeometry(0.28, 0.14, 0.28),
  arm: new THREE.BoxGeometry(0.12, 0.44, 0.12),
  leg: new THREE.BoxGeometry(0.15, 0.56, 0.17),
};
const npcSkinMat = new THREE.MeshStandardMaterial({ color: 0xdfb18b, roughness: 0.7 });
const npcPantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
const npcHelmetMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
const npcJacketMats = [0xe11d48, 0x2563eb, 0x059669, 0xd97706, 0x7c3aed].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })
);
let npcRiderColorCursor = 0;

export function attachNpcRiderToRig(rig: VehicleRig, classId: VehicleClassId): void {
  const isBike = classId === 'bicycle' || classId === 'speed_bicycle';
  if (!isBike && classId !== 'motorcycle') return;

  const riderGroup = new THREE.Group();
  const jacketMat = npcJacketMats[npcRiderColorCursor++ % npcJacketMats.length];

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, isBike ? 0.66 : 0.72, isBike ? -0.14 : -0.22);
  torsoPivot.rotation.x = isBike ? 0.44 : 0.34;

  const torso = new THREE.Mesh(npcRiderGeo.torso, jacketMat);
  torso.position.set(0, 0.24, 0);
  torso.castShadow = true;

  const head = new THREE.Mesh(npcRiderGeo.head, npcSkinMat);
  head.position.set(0, 0.62, 0.04);

  const helmet = new THREE.Mesh(npcRiderGeo.helmet, npcHelmetMat);
  helmet.position.set(0, 0.72, 0.03);

  const armL = new THREE.Mesh(npcRiderGeo.arm, jacketMat);
  armL.position.set(-0.24, 0.34, 0.22);
  armL.rotation.x = -1.15;

  const armR = new THREE.Mesh(npcRiderGeo.arm, jacketMat);
  armR.position.set(0.24, 0.34, 0.22);
  armR.rotation.x = -1.15;

  torsoPivot.add(torso, head, helmet, armL, armR);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, isBike ? 0.64 : 0.68, isBike ? -0.06 : -0.1);
  const legL = new THREE.Mesh(npcRiderGeo.leg, npcPantsMat);
  legL.position.set(0, -0.24, 0.04);
  leftLegPivot.add(legL);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, isBike ? 0.64 : 0.68, isBike ? -0.06 : -0.1);
  const legR = new THREE.Mesh(npcRiderGeo.leg, npcPantsMat);
  legR.position.set(0, -0.24, 0.04);
  rightLegPivot.add(legR);

  if (!isBike) {
    leftLegPivot.rotation.set(-0.68, 0, -0.24);
    rightLegPivot.rotation.set(-0.68, 0, 0.24);
  }

  riderGroup.add(torsoPivot, leftLegPivot, rightLegPivot);
  rig.bodyGroup.add(riderGroup);
  rig.npcLeftLegPivot = leftLegPivot;
  rig.npcRightLegPivot = rightLegPivot;
}

export function buildVehicleMesh(
  classId: VehicleClassId,
  colorHex?: number,
  withSpotLight = false
): VehicleRig {
  const spec = VEHICLE_CATALOG[classId];
  const baseColor = colorHex ?? spec.colors[Math.floor(Math.random() * spec.colors.length)];

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const frontGroup = new THREE.Group();
  const rearGroup = new THREE.Group();
  const cabinGroup = new THREE.Group();
  bodyGroup.add(frontGroup, rearGroup, cabinGroup);
  root.add(bodyGroup);

  const isMeme = classId.startsWith('meme_');
  const paintMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: classId === 'truck' || classId === 'bus' || isMeme ? 0.22 : classId === 'nova_x' ? 0.28 : 0.72,
    roughness: classId === 'nova_x' ? 0.42 : isMeme ? 0.46 : 0.24,
  });

  const darkTrimMat = sharedDarkTrimMat;
  const chromeMat = sharedChromeMat;
  const tireMat = sharedTireMat;

  const glassMat = new THREE.MeshStandardMaterial({
    color: classId === 'nova_x' ? 0x050608 : 0x0f172a,
    roughness: 0.1,
    metalness: 0.45,
    transparent: true,
    opacity: classId === 'nova_x' ? 0.95 : 0.84,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: classId === 'nova_x' ? 0xffffff : 0xfef9c3,
    emissive: classId === 'nova_x' ? 0xffffff : 0xfef08a,
    emissiveIntensity: classId === 'nova_x' ? 1.85 : 0.15,
    roughness: 0.18,
  });

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: classId === 'nova_x' ? 1.3 : 0.25,
    roughness: 0.3,
  });

  const leftSigMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    emissive: 0xf59e0b,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const rightSigMat = leftSigMat.clone();

  const disposables: Array<{ dispose: () => void }> = [
    paintMat,
    glassMat,
    headMat,
    tailMat,
    leftSigMat,
    rightSigMat,
  ];

  const wheelPivots: THREE.Group[] = [];
  const wheelSpinMeshes: THREE.Object3D[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  let propellerPivot: THREE.Group | undefined;
  let wingLeftPivot: THREE.Group | undefined;
  let wingRightPivot: THREE.Group | undefined;
  let thrusterGlowMat: THREE.MeshStandardMaterial | undefined;
  let lightbarRed: THREE.Mesh | undefined;
  let lightbarBlue: THREE.Mesh | undefined;
  let headlightSpot: THREE.SpotLight | undefined;
  let underglowLight: THREE.PointLight | undefined;
  let underglowPlane: THREE.Mesh | undefined;
  let lowerHull!: THREE.Mesh;

  const w = spec.width;
  const l = spec.length;
  const h = spec.height;
  const wr = spec.wheelRadius;
  const groundClearance = wr * 0.72;

  const bulletHoles: THREE.Mesh[] = [];
  let bulletHoleCursor = 0;
  const maxBulletHoles = 8;
  for (let i = 0; i < maxBulletHoles; i++) {
    const hole = new THREE.Mesh(sharedBulletHoleGeo, sharedBulletHoleMat);
    hole.visible = false;
    bodyGroup.add(hole);
    bulletHoles.push(hole);
  }
  const _upAxis = new THREE.Vector3(0, 1, 0);
  const _holeNormal = new THREE.Vector3();
  const addBulletHole = (
    localX: number,
    localY: number,
    localZ: number,
    nx: number,
    ny: number,
    nz: number
  ) => {
    const hole = bulletHoles[bulletHoleCursor];
    bulletHoleCursor = (bulletHoleCursor + 1) % maxBulletHoles;
    _holeNormal.set(nx, ny, nz);
    if (_holeNormal.lengthSq() < 0.001) {
      _holeNormal.set(0, 1, 0);
    } else {
      _holeNormal.normalize();
    }
    hole.position.set(
      localX + _holeNormal.x * 0.012,
      localY + _holeNormal.y * 0.012,
      localZ + _holeNormal.z * 0.012
    );
    hole.quaternion.setFromUnitVectors(_upAxis, _holeNormal);
    hole.visible = true;
  };
  const clearBulletHoles = () => {
    bulletHoles.forEach((h) => (h.visible = false));
    bulletHoleCursor = 0;
  };

  const damage = { front: 0, rear: 0, left: 0, right: 0, charred: false };
  const isTwoWheeler = classId === 'motorcycle' || classId === 'bicycle' || classId === 'speed_bicycle';

  const syncVisualDent = () => {
    const f = Math.min(1.25, damage.front);
    const r = Math.min(1.25, damage.rear);
    const sideDiff = damage.left - damage.right;
    const sideMax = Math.min(1.25, Math.max(damage.left, damage.right));

    if (isTwoWheeler) {
      frontGroup.position.z = -f * 0.26;
      frontGroup.rotation.x = f * 0.32;
      frontGroup.rotation.z = sideDiff * 0.22;
      rearGroup.position.z = r * 0.22;
      rearGroup.rotation.x = -r * 0.25;
      cabinGroup.rotation.z = sideDiff * 0.18;
      lowerHull.rotation.z = sideDiff * 0.14;
      return;
    }

    frontGroup.position.z = -f * 0.44;
    frontGroup.position.y = -f * 0.11;
    frontGroup.rotation.x = f * 0.24;
    frontGroup.rotation.z = sideDiff * 0.12;

    rearGroup.position.z = r * 0.44;
    rearGroup.position.y = -r * 0.1;
    rearGroup.rotation.x = -r * 0.22;
    rearGroup.rotation.z = -sideDiff * 0.1;

    lowerHull.scale.z = Math.max(0.74, 1 - (f + r) * 0.13);
    lowerHull.scale.x = Math.max(0.8, 1 - sideMax * 0.14);
    lowerHull.position.z = (r - f) * 0.2;
    lowerHull.position.x = sideDiff * 0.14;
    lowerHull.rotation.z = sideDiff * 0.08;

    cabinGroup.rotation.z = sideDiff * 0.14;
    cabinGroup.rotation.x = (f - r) * 0.06;
    cabinGroup.scale.x = Math.max(0.84, 1 - sideMax * 0.11);
    cabinGroup.scale.z = Math.max(0.86, 1 - (f + r) * 0.07);
  };

  if (classId === 'bicycle' || classId === 'speed_bicycle') {
    const isAero = classId === 'speed_bicycle';
    const tubeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.72, 7);
    disposables.push(tubeGeo);

    lowerHull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), paintMat);
    lowerHull.position.set(0, wr + 0.08, 0);
    bodyGroup.add(lowerHull);

    const downTube = new THREE.Mesh(tubeGeo, paintMat);
    downTube.position.set(0, wr + 0.22, 0.16);
    downTube.rotation.x = 0.72;
    const topTube = new THREE.Mesh(tubeGeo, paintMat);
    topTube.position.set(0, wr + 0.42, 0.02);
    topTube.rotation.x = Math.PI / 2;
    const seatTube = new THREE.Mesh(tubeGeo, paintMat);
    seatTube.position.set(0, wr + 0.25, -0.18);
    seatTube.rotation.x = -0.22;
    cabinGroup.add(downTube, topTube, seatTube);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.28), darkTrimMat);
    saddle.position.set(0, wr + 0.56, -0.24);
    cabinGroup.add(saddle);

    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.06), paintMat);
    fork.position.set(0, wr + 0.25, 0.46);
    fork.rotation.x = -0.25;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 6), chromeMat);
    stem.position.set(0, wr + 0.58, 0.38);
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, isAero ? 0.44 : 0.54, 8),
      isAero ? darkTrimMat : chromeMat
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, wr + 0.66, 0.39);
    frontGroup.add(fork, stem, bar);

    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateZ(Math.PI / 2), chromeMat);
    crank.position.set(0, wr - 0.04, -0.05);
    cabinGroup.add(crank);

    [0.56, -0.56].forEach((wz) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, wr, wz);
      const spinGroup = new THREE.Group();
      const tireRing = new THREE.Mesh(new THREE.TorusGeometry(wr, 0.04, 8, 20), tireMat);
      tireRing.rotation.y = Math.PI / 2;
      tireRing.castShadow = true;
      const spokeA = new THREE.Mesh(new THREE.BoxGeometry(0.02, wr * 1.88, 0.02), chromeMat);
      const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, wr * 1.88), chromeMat);
      spinGroup.add(tireRing, spokeA, spokeB);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), headMat);
    hl.position.set(0, wr + 0.56, 0.46);
    frontGroup.add(hl);
    headlightMeshes.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.05), tailMat);
    tl.position.set(0, wr + 0.48, -0.38);
    rearGroup.add(tl);
    taillightMeshes.push(tl);
  } else if (classId === 'motorcycle') {
    const frameGeo = new THREE.BoxGeometry(0.28, 0.42, l * 0.65);
    lowerHull = new THREE.Mesh(frameGeo, darkTrimMat);
    lowerHull.position.set(0, wr + 0.15, 0);
    lowerHull.castShadow = true;
    bodyGroup.add(lowerHull);
    disposables.push(frameGeo);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.72), paintMat);
    tank.position.set(0, wr + 0.45, 0.15);
    tank.castShadow = true;
    cabinGroup.add(tank);

    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.52), paintMat);
    fairing.position.set(0, wr + 0.42, 0.62);
    fairing.rotation.x = -0.35;
    fairing.castShadow = true;
    frontGroup.add(fairing);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.25, 0.12), glassMat);
    visor.position.set(0, wr + 0.68, 0.64);
    visor.rotation.x = -0.5;
    frontGroup.add(visor);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.75), darkTrimMat);
    seat.position.set(0, wr + 0.44, -0.38);
    rearGroup.add(seat);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 8), chromeMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, wr + 0.62, 0.44);
    frontGroup.add(bar);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.75, 10), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.18, wr + 0.05, -0.45);
    rearGroup.add(exhaust);

    [0.72, -0.72].forEach((wz) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, wr, wz);
      const wheel = new THREE.Mesh(getTireGeo(wr, 0.18), tireMat);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.58, wr * 0.58, 0.2, 10).rotateZ(Math.PI / 2),
        chromeMat
      );
      const spinGroup = new THREE.Group();
      spinGroup.add(wheel, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.08), headMat);
    hl.position.set(0, wr + 0.45, 0.88);
    frontGroup.add(hl);
    headlightMeshes.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.06), tailMat);
    tl.position.set(0, wr + 0.42, -0.9);
    rearGroup.add(tl);
    taillightMeshes.push(tl);
  } else if (classId === 'nova_x') {
    // -------------------------------------------------------------------------
    // ZENITH NOVA X12 — Stepped Voxel Hypercar matching user's reference photo
    // With matte/semi-metallic teal stepped body, black glass & splitter,
    // pixel white headlights, red rear corner taillights, voxel mirrors & wing,
    // AND luminous CYAN UNDERGLOW lighting beneath the chassis!
    // -------------------------------------------------------------------------
    const chassisGeo = new THREE.BoxGeometry(w * 0.94, 0.34, l * 0.84);
    lowerHull = new THREE.Mesh(chassisGeo, paintMat);
    lowerHull.position.set(0, groundClearance + 0.2, 0);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);
    disposables.push(chassisGeo);

    const addVoxel = (parent: THREE.Object3D, bw: number, bh: number, bl: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Black front chin splitter + side skirts
    addVoxel(frontGroup, w * 0.96, 0.14, 0.56, 0, groundClearance + 0.07, l * 0.44, darkTrimMat);
    addVoxel(frontGroup, w * 0.82, 0.1, 0.22, 0, groundClearance + 0.14, l * 0.52, darkTrimMat);
    addVoxel(bodyGroup, w * 1.0, 0.12, l * 0.62, 0, groundClearance + 0.06, 0, darkTrimMat);

    // Stepped teal hood tiers
    addVoxel(frontGroup, w * 0.88, 0.18, 0.95, 0, groundClearance + 0.24, l * 0.32, paintMat);
    addVoxel(frontGroup, w * 0.72, 0.15, 0.9, 0, groundClearance + 0.37, l * 0.24, paintMat);
    addVoxel(frontGroup, w * 0.54, 0.12, 0.7, 0, groundClearance + 0.46, l * 0.16, paintMat);

    // Stepped wheel arch flares (front & rear left/right)
    [-1, 1].forEach((side) => {
      const xOuter = side * (w * 0.44);
      // Front arch steps
      addVoxel(frontGroup, 0.3, 0.16, 0.96, xOuter, groundClearance + 0.36, l * 0.31, paintMat);
      addVoxel(frontGroup, 0.26, 0.14, 0.62, xOuter * 0.95, groundClearance + 0.48, l * 0.3, paintMat);
      // Door / intake shoulder sill
      addVoxel(bodyGroup, 0.28, 0.28, 1.32, side * (w * 0.44), groundClearance + 0.34, 0.0, paintMat);
      addVoxel(bodyGroup, 0.14, 0.18, 0.68, side * (w * 0.41), groundClearance + 0.5, -0.15, darkTrimMat);
      // Rear arch haunches
      addVoxel(rearGroup, 0.3, 0.22, 1.04, xOuter, groundClearance + 0.42, -l * 0.3, paintMat);
      addVoxel(rearGroup, 0.28, 0.15, 0.72, xOuter * 0.94, groundClearance + 0.56, -l * 0.28, paintMat);

      // Stepped voxel side mirrors sticking out like in photo!
      addVoxel(bodyGroup, 0.24, 0.08, 0.09, side * (w * 0.52), groundClearance + 0.66, 0.52, darkTrimMat);
      addVoxel(bodyGroup, 0.2, 0.14, 0.16, side * (w * 0.61), groundClearance + 0.71, 0.48, darkTrimMat);
    });

    // Bright white V-stepped pixel headlights matching the photo
    [-1, 1].forEach((side) => {
      const hx = side * (w * 0.29);
      const hl1 = addVoxel(frontGroup, 0.28, 0.14, 0.16, hx, groundClearance + 0.33, l * 0.43, headMat);
      const hl2 = addVoxel(frontGroup, 0.18, 0.12, 0.16, hx + side * 0.12, groundClearance + 0.42, l * 0.38, headMat);
      headlightMeshes.push(hl1, hl2);

      // Red rear corner L-taillights
      const tl1 = addVoxel(rearGroup, 0.34, 0.11, 0.12, side * (w * 0.36), groundClearance + 0.44, -l * 0.47, tailMat);
      const tl2 = addVoxel(rearGroup, 0.12, 0.16, 0.16, side * (w * 0.47), groundClearance + 0.39, -l * 0.44, tailMat);
      taillightMeshes.push(tl1, tl2);
    });

    // Stepped black voxel windshield + canopy + side glass (in cabinGroup so FPS hides roof cleanly!)
    addVoxel(cabinGroup, w * 0.54, 0.15, 0.72, 0, groundClearance + 0.56, 0.42, glassMat);
    addVoxel(cabinGroup, w * 0.48, 0.14, 0.92, 0, groundClearance + 0.68, 0.1, glassMat);
    addVoxel(cabinGroup, w * 0.34, 0.09, 0.96, 0, groundClearance + 0.77, -0.2, paintMat);
    addVoxel(cabinGroup, w * 0.52, 0.12, 0.85, 0, groundClearance + 0.62, -0.58, glassMat);
    // Teal engine deck shoulder rails beside rear window
    [-1, 1].forEach((side) => {
      addVoxel(cabinGroup, 0.24, 0.16, 1.35, side * (w * 0.32), groundClearance + 0.64, -0.62, paintMat);
      addVoxel(cabinGroup, 0.14, 0.12, 0.65, side * (w * 0.29), groundClearance + 0.73, -0.28, paintMat);
    });

    // Rear black stepped diffuser + raised black voxel GT wing on twin pylons
    addVoxel(rearGroup, w * 0.94, 0.18, 0.32, 0, groundClearance + 0.15, -l * 0.47, darkTrimMat);
    addVoxel(rearGroup, w * 0.74, 0.16, 0.42, 0, groundClearance + 0.44, -l * 0.4, paintMat);
    const wingY = groundClearance + 0.82;
    addVoxel(rearGroup, w * 0.98, 0.08, 0.3, 0, wingY, -l * 0.44, darkTrimMat);
    addVoxel(rearGroup, 0.09, 0.28, 0.14, -w * 0.28, wingY - 0.15, -l * 0.43, darkTrimMat);
    addVoxel(rearGroup, 0.09, 0.28, 0.14, w * 0.28, wingY - 0.15, -l * 0.43, darkTrimMat);

    // Signals
    const leftSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), leftSigMat);
    leftSig.position.set(-w * 0.46, groundClearance + 0.24, l * 0.46);
    const rightSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), rightSigMat);
    rightSig.position.set(w * 0.46, groundClearance + 0.24, l * 0.46);
    frontGroup.add(leftSig, rightSig);

    // Chunky black voxel-styled wheels
    const wheelX = w / 2 - 0.05;
    const frontZ = l * 0.31;
    const rearZ = -l * 0.31;
    [
      [-wheelX, frontZ],
      [wheelX, frontZ],
      [-wheelX, rearZ],
      [wheelX, rearZ],
    ].forEach(([wx, wz]) => {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wr, wz);
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(getTireGeo(wr, 0.3), tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, wr * 0.78, wr * 0.78),
        darkTrimMat
      );
      spinGroup.add(tire, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    // CYAN NEON UNDERGLOW (underbody emissive tubes + ground glow plane + downward point light!)
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      emissive: 0x00f5ff,
      emissiveIntensity: 3.0,
      roughness: 0.15,
    });
    const underglowMat = new THREE.MeshBasicMaterial({
      map: getCyanGlowTexture(),
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const underglowGeo = new THREE.PlaneGeometry(w * 1.85, l * 1.38);
    underglowGeo.rotateX(-Math.PI / 2);
    underglowPlane = new THREE.Mesh(underglowGeo, underglowMat);
    underglowPlane.position.set(0, 0.04, 0);
    bodyGroup.add(underglowPlane);

    [-1, 1].forEach((side) => {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, l * 0.74), neonMat);
      tube.position.set(side * (w * 0.44), groundClearance * 0.42, 0);
      bodyGroup.add(tube);
    });
    const fTube = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.05, 0.08), neonMat);
    fTube.position.set(0, groundClearance * 0.42, l * 0.42);
    const rTube = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.05, 0.08), neonMat);
    rTube.position.set(0, groundClearance * 0.42, -l * 0.42);
    bodyGroup.add(fTube, rTube);

    underglowLight = new THREE.PointLight(0x00f5ff, 5.5, 7.5, 1.6);
    underglowLight.position.set(0, 0.25, 0);
    bodyGroup.add(underglowLight);
    disposables.push(neonMat, underglowMat, underglowGeo);

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xe0ffff, 0, 62, Math.PI / 5, 0.45, 1.4);
      headlightSpot.visible = false;
      headlightSpot.position.set(0, groundClearance + 0.42, l / 2);
      headlightSpot.target.position.set(0, 0, l / 2 + 18);
      frontGroup.add(headlightSpot);
      frontGroup.add(headlightSpot.target);
    }

    return {
      root,
      bodyGroup,
      frontGroup,
      rearGroup,
      lowerHull,
      cabinGroup,
      wheelPivots,
      wheelSpinMeshes,
      headlightMeshes,
      taillightMeshes,
      leftSignalMesh: leftSig,
      rightSignalMesh: rightSig,
      headlightSpot,
      underglowLight,
      underglowPlane,
      spec,
      paintMat,
      damage,
      applyImpactDent: (localX: number, localZ: number, severity: number) => {
        const s = THREE.MathUtils.clamp(severity, 0.14, 0.95);
        if (Math.abs(localZ) >= Math.abs(localX) * 0.85) {
          if (localZ >= 0) damage.front = Math.min(1.25, damage.front + s);
          else damage.rear = Math.min(1.25, damage.rear + s);
        } else {
          if (localX < 0) damage.left = Math.min(1.25, damage.left + s);
          else damage.right = Math.min(1.25, damage.right + s);
        }
        syncVisualDent();
      },
      addBulletHole,
      setCharred: (charred: boolean) => {
        damage.charred = charred;
        if (charred) {
          paintMat.color.setHex(0x1c1917);
          paintMat.roughness = 0.96;
          if (underglowLight) underglowLight.intensity = 0;
          if (underglowPlane) underglowPlane.visible = false;
        } else {
          paintMat.color.setHex(baseColor);
          paintMat.roughness = 0.42;
          if (underglowLight) underglowLight.intensity = 5.5;
          if (underglowPlane) underglowPlane.visible = true;
        }
      },
      resetDamage: () => {
        damage.front = 0;
        damage.rear = 0;
        damage.left = 0;
        damage.right = 0;
        clearBulletHoles();
        damage.charred = false;
        paintMat.color.setHex(baseColor);
        if (underglowLight) underglowLight.intensity = 5.5;
        if (underglowPlane) underglowPlane.visible = true;
        syncVisualDent();
      },
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  } else if (classId === 'airplane') {
    // -------------------------------------------------------------------------
    // FLYABLE AIRPLANE (SkyHopper Prop Plane)
    // -------------------------------------------------------------------------
    const fuselageGeo = new THREE.BoxGeometry(1.18, 1.05, 5.2);
    lowerHull = new THREE.Mesh(fuselageGeo, paintMat);
    lowerHull.position.set(0, 1.05, 0);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);
    disposables.push(fuselageGeo);

    const accentMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.4 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.45 });
    disposables.push(accentMat, stripeMat);

    // Tapered nose cowling + engine mount
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 1.1, 12).rotateX(Math.PI / 2), accentMat);
    nose.position.set(0, 1.02, 3.0);
    nose.castShadow = true;
    frontGroup.add(nose);

    // Spinning front propeller
    propellerPivot = new THREE.Group();
    propellerPivot.position.set(0, 1.02, 3.62);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 10).rotateX(Math.PI / 2), chromeMat);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.95, 0.04), darkTrimMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.16, 0.04), darkTrimMat);
    propellerPivot.add(spinner, blade1, blade2);
    frontGroup.add(propellerPivot);

    // Main Swept Wings + Aileron Stripes + Wingtips
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 1.45), paintMat);
    wing.position.set(0, 1.12, 0.35);
    wing.castShadow = true;
    wing.receiveShadow = true;
    const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(7.24, 0.15, 0.28), stripeMat);
    wingStripe.position.set(0, 1.12, -0.05);
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 1.42), accentMat);
    tipL.position.set(-3.65, 1.18, 0.35);
    const tipR = tipL.clone();
    tipR.position.x = 3.65;
    bodyGroup.add(wing, wingStripe, tipL, tipR);

    // Cockpit Canopy (placed inside cabinGroup so 1st-person hides tint cleanly!)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.58, 1.85), glassMat);
    canopy.position.set(0, 1.72, 0.55);
    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.1, 1.2), paintMat);
    roofBar.position.set(0, 2.02, 0.35);
    cabinGroup.add(canopy, roofBar);

    // Rear Tail Cone + Vertical Stabilizer + Horizontal Elevators
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.52, 1.7, 10).rotateX(Math.PI / 2), paintMat);
    tailBoom.position.set(0, 1.1, -3.15);
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.95), accentMat);
    vFin.position.set(0, 1.85, -3.35);
    vFin.castShadow = true;
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.65), paintMat);
    hStab.position.set(0, 1.32, -3.35);
    rearGroup.add(tailBoom, vFin, hStab);

    // Tricycle Landing Gear (Front nose wheel + two main wheels under wings)
    const struts = [
      { wx: 0, wz: 2.25 },
      { wx: -0.95, wz: -0.25 },
      { wx: 0.95, wz: -0.25 },
    ];
    struts.forEach(({ wx, wz }) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6), chromeMat);
      strut.position.set(wx, wr + 0.32, wz);
      bodyGroup.add(strut);

      const pivot = new THREE.Group();
      pivot.position.set(wx, wr, wz);
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(getTireGeo(wr, 0.18), tireMat);
      tire.castShadow = true;
      spinGroup.add(tire);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    // Landing Headlights & Nav Lights
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), headMat);
    hlL.position.set(-1.3, 1.12, 1.08);
    const hlR = hlL.clone();
    hlR.position.x = 1.3;
    frontGroup.add(hlL, hlR);
    headlightMeshes.push(hlL, hlR);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), tailMat);
    tl.position.set(0, 2.38, -3.72);
    rearGroup.add(tl);
    taillightMeshes.push(tl);

    const leftSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), leftSigMat);
    leftSig.position.set(-3.65, 1.18, 1.0);
    const rightSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), rightSigMat);
    rightSig.position.set(3.65, 1.18, 1.0);
    frontGroup.add(leftSig, rightSig);

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xfffbeb, 0, 75, Math.PI / 4, 0.45, 1.3);
      headlightSpot.visible = false;
      headlightSpot.position.set(0, 1.0, 3.2);
      headlightSpot.target.position.set(0, 0, 24);
      frontGroup.add(headlightSpot);
      frontGroup.add(headlightSpot.target);
    }

    return {
      root,
      bodyGroup,
      frontGroup,
      rearGroup,
      lowerHull,
      cabinGroup,
      wheelPivots,
      wheelSpinMeshes,
      propellerPivot,
      headlightMeshes,
      taillightMeshes,
      leftSignalMesh: leftSig,
      rightSignalMesh: rightSig,
      headlightSpot,
      spec,
      paintMat,
      damage,
      applyImpactDent: (localX: number, localZ: number, severity: number) => {
        const s = THREE.MathUtils.clamp(severity, 0.12, 0.75);
        if (Math.abs(localZ) >= Math.abs(localX)) {
          if (localZ >= 0) damage.front = Math.min(1.0, damage.front + s);
          else damage.rear = Math.min(1.0, damage.rear + s);
        } else {
          if (localX < 0) damage.left = Math.min(1.0, damage.left + s);
          else damage.right = Math.min(1.0, damage.right + s);
        }
        syncVisualDent();
      },
      addBulletHole,
      setCharred: (charred: boolean) => {
        damage.charred = charred;
        paintMat.color.setHex(charred ? 0x1c1917 : baseColor);
        paintMat.roughness = charred ? 0.96 : 0.24;
      },
      resetDamage: () => {
        damage.front = 0;
        damage.rear = 0;
        damage.left = 0;
        damage.right = 0;
        damage.charred = false;
        clearBulletHoles();
        paintMat.color.setHex(baseColor);
        syncVisualDent();
      },
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  } else if (
    classId === 'gold_wing_coupe' ||
    classId === 'gold_wing_hyper' ||
    classId === 'gold_wing_sovereign'
  ) {
    // -------------------------------------------------------------------------
    // 24K GOLDEN FLYING CARS COLLECTION (Deployable Wings + Jet Thrusters!)
    // -------------------------------------------------------------------------
    const isSovereign = classId === 'gold_wing_sovereign';
    const isHyper = classId === 'gold_wing_hyper' || isSovereign;
    paintMat.color.setHex(baseColor);
    paintMat.metalness = 0.94;
    paintMat.roughness = 0.16;

    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      metalness: 0.96,
      roughness: 0.12,
    });
    const thrusterCoreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    thrusterGlowMat = thrusterCoreMat;
    disposables.push(goldAccentMat, thrusterCoreMat);

    const lowerH = h * 0.48;
    const lowerGeo = new THREE.BoxGeometry(w, lowerH, l);
    lowerHull = new THREE.Mesh(lowerGeo, paintMat);
    lowerHull.position.set(0, groundClearance + lowerH / 2, 0);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);
    disposables.push(lowerGeo);

    // Aerodynamic gold nose splitter & intake grille
    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.08, 0.34), darkTrimMat);
    frontSplitter.position.set(0, groundClearance + 0.04, l / 2 + 0.08);
    const goldVents = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.16, 0.08), goldAccentMat);
    goldVents.position.set(0, groundClearance + lowerH * 0.55, l / 2 + 0.03);
    const hoodCrest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, l * 0.38), goldAccentMat);
    hoodCrest.position.set(0, groundClearance + lowerH + 0.03, l * 0.24);
    frontGroup.add(frontSplitter, goldVents, hoodCrest);

    // Cabin canopy (placed in cabinGroup so 1st-person hides tint cleanly)
    const cabinH = h - lowerH - groundClearance;
    const cabinLen = isSovereign ? l * 0.5 : l * 0.46;
    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, cabinH, cabinLen), glassMat);
    cabinGlass.position.set(0, groundClearance + lowerH + cabinH / 2 - 0.02, -l * 0.04);
    cabinGlass.castShadow = true;
    const goldRoof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.1, cabinLen * 0.88), paintMat);
    goldRoof.position.set(0, groundClearance + lowerH + cabinH - 0.01, -l * 0.04);
    goldRoof.castShadow = true;
    cabinGroup.add(cabinGlass, goldRoof);

    // Royal Crown Fin or Twin Vertical Aero Fins on rear deck
    if (isSovereign) {
      [-0.52, 0.52].forEach((fx) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.92), paintMat);
        fin.position.set(fx, groundClearance + lowerH + 0.26, -l * 0.34);
        rearGroup.add(fin);
      });
      const skyBridge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.08, 0.34), goldAccentMat);
      skyBridge.position.set(0, groundClearance + lowerH + 0.52, -l * 0.42);
      rearGroup.add(skyBridge);
    } else if (isHyper) {
      const wingRear = new THREE.Mesh(new THREE.BoxGeometry(w * 1.0, 0.07, 0.32), paintMat);
      wingRear.position.set(0, groundClearance + lowerH + 0.34, -l * 0.43);
      [-w * 0.34, w * 0.34].forEach((px) => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.16), darkTrimMat);
        pylon.position.set(px, groundClearance + lowerH + 0.17, -l * 0.43);
        rearGroup.add(pylon);
      });
      rearGroup.add(wingRear);
    }

    // Twin Rear Jet Thrusters (with glowing cyan/gold cores!)
    [-w * 0.26, w * 0.26].forEach((tx) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10).rotateX(Math.PI / 2), darkTrimMat);
      pod.position.set(tx, groundClearance + lowerH * 0.52, -l / 2 - 0.04);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10).rotateX(Math.PI / 2), thrusterCoreMat);
      core.position.set(tx, groundClearance + lowerH * 0.52, -l / 2 - 0.26);
      rearGroup.add(pod, core);
    });

    // DEPLOYABLE 24K GOLD FLIGHT WINGS (Fold cleanly flush along car flanks; extend out wide on fly!)
    const wingSpanHalf = isSovereign ? 3.2 : isHyper ? 2.85 : 2.55;
    const wingY = groundClearance + lowerH * 0.62;
    const makeGoldWing = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (w * 0.46), wingY, -0.05);
      // Folded state by default: swept tightly backward alongside body (rotation.y ~ +/- 1.48 rad)
      pivot.rotation.y = side * -1.48;

      const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(wingSpanHalf, 0.1, 1.15), paintMat);
      mainBlade.position.set(side * (wingSpanHalf * 0.5), 0, 0);
      mainBlade.castShadow = true;

      const leadEdge = new THREE.Mesh(new THREE.BoxGeometry(wingSpanHalf * 0.96, 0.12, 0.16), goldAccentMat);
      leadEdge.position.set(side * (wingSpanHalf * 0.5), 0, 0.52);

      const flap = new THREE.Mesh(new THREE.BoxGeometry(wingSpanHalf * 0.72, 0.08, 0.22), darkTrimMat);
      flap.position.set(side * (wingSpanHalf * 0.46), -0.01, -0.58);

      const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.95), darkTrimMat);
      wingTip.position.set(side * wingSpanHalf, 0.06, -0.05);

      const tipGlow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), thrusterCoreMat);
      tipGlow.position.set(side * wingSpanHalf, 0.12, 0.35);

      pivot.add(mainBlade, leadEdge, flap, wingTip, tipGlow);
      bodyGroup.add(pivot);
      return pivot;
    };

    wingLeftPivot = makeGoldWing(-1);
    wingRightPivot = makeGoldWing(1);

    // Headlights, Taillights & Turn Signals
    const hlY = groundClearance + lowerH * 0.65;
    [-w * 0.34, w * 0.34].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), headMat);
      hl.position.set(hx, hlY, l / 2 + 0.01);
      frontGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.06), tailMat);
      tl.position.set(hx, hlY, -l / 2 - 0.01);
      rearGroup.add(tl);
      taillightMeshes.push(tl);
    });

    const leftSig = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), leftSigMat);
    leftSig.position.set(-w * 0.46, hlY, l / 2 - 0.02);
    const rightSig = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), rightSigMat);
    rightSig.position.set(w * 0.46, hlY, l / 2 - 0.02);
    frontGroup.add(leftSig, rightSig);

    // 24K Gold Rims + Low-profile Tires
    const wheelX = w / 2 - 0.04;
    [
      [-wheelX, l * 0.31],
      [wheelX, l * 0.31],
      [-wheelX, -l * 0.31],
      [wheelX, -l * 0.31],
    ].forEach(([wx, wz]) => {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wr, wz);
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(getTireGeo(wr, 0.3), tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(getRimGeo(wr, 0.3), goldAccentMat);
      spinGroup.add(tire, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    // Golden-Amber Underglow Aura
    const goldUnderglowMat = new THREE.MeshBasicMaterial({
      map: getCyanGlowTexture(),
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const underglowGeo = new THREE.PlaneGeometry(w * 1.9, l * 1.38);
    underglowGeo.rotateX(-Math.PI / 2);
    underglowPlane = new THREE.Mesh(underglowGeo, goldUnderglowMat);
    underglowPlane.position.set(0, 0.04, 0);
    bodyGroup.add(underglowPlane);

    underglowLight = new THREE.PointLight(0xfbbf24, 5.2, 8.0, 1.6);
    underglowLight.position.set(0, 0.25, 0);
    bodyGroup.add(underglowLight);
    disposables.push(goldUnderglowMat, underglowGeo);

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xfef08a, 0, 70, Math.PI / 5, 0.45, 1.35);
      headlightSpot.visible = false;
      headlightSpot.position.set(0, hlY + 0.2, l / 2);
      headlightSpot.target.position.set(0, 0, l / 2 + 20);
      frontGroup.add(headlightSpot);
      frontGroup.add(headlightSpot.target);
    }

    return {
      root,
      bodyGroup,
      frontGroup,
      rearGroup,
      lowerHull,
      cabinGroup,
      wheelPivots,
      wheelSpinMeshes,
      wingLeftPivot,
      wingRightPivot,
      thrusterGlowMat,
      headlightMeshes,
      taillightMeshes,
      leftSignalMesh: leftSig,
      rightSignalMesh: rightSig,
      headlightSpot,
      underglowLight,
      underglowPlane,
      spec,
      paintMat,
      damage,
      applyImpactDent: (localX: number, localZ: number, severity: number) => {
        const s = THREE.MathUtils.clamp(severity, 0.14, 0.85);
        if (Math.abs(localZ) >= Math.abs(localX) * 0.85) {
          if (localZ >= 0) damage.front = Math.min(1.1, damage.front + s);
          else damage.rear = Math.min(1.1, damage.rear + s);
        } else {
          if (localX < 0) damage.left = Math.min(1.1, damage.left + s);
          else damage.right = Math.min(1.1, damage.right + s);
        }
        syncVisualDent();
      },
      addBulletHole,
      setCharred: (charred: boolean) => {
        damage.charred = charred;
        paintMat.color.setHex(charred ? 0x1c1917 : baseColor);
        paintMat.roughness = charred ? 0.96 : 0.16;
        paintMat.metalness = charred ? 0.1 : 0.94;
        if (underglowLight) underglowLight.intensity = charred ? 0 : 5.2;
        if (underglowPlane) underglowPlane.visible = !charred;
      },
      resetDamage: () => {
        damage.front = 0;
        damage.rear = 0;
        damage.left = 0;
        damage.right = 0;
        damage.charred = false;
        clearBulletHoles();
        paintMat.color.setHex(baseColor);
        paintMat.roughness = 0.16;
        paintMat.metalness = 0.94;
        if (underglowLight) underglowLight.intensity = 5.2;
        if (underglowPlane) underglowPlane.visible = true;
        syncVisualDent();
      },
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  } else if (isMeme) {
    // -------------------------------------------------------------------------
    // 10 HILARIOUS MEME CARS (Banana, Googly Head, Toilet, Duck, Cheeseburger,
    // Giant Sneaker, Land Shark, Cat-Loaf, Glizzy Hotdog, Butter Toast)
    // -------------------------------------------------------------------------
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    const brownMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 });
    const cheddarMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    disposables.push(whiteMat, redMat, orangeMat, brownMat, pinkMat, greenMat, cheddarMat);

    const addPart = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      disposables.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      parent.add(m);
      return m;
    };

    const addGooglyEyes = (parent: THREE.Object3D, xSpread: number, y: number, z: number, eyeSize = 0.26, crossEyed = true) => {
      const eyeGeo = new THREE.SphereGeometry(eyeSize, 10, 8);
      const pupilGeo = new THREE.SphereGeometry(eyeSize * 0.48, 8, 6);
      disposables.push(eyeGeo, pupilGeo);
      [-1, 1].forEach((side) => {
        const eye = new THREE.Mesh(eyeGeo, whiteMat);
        eye.position.set(side * xSpread, y, z);
        const pupil = new THREE.Mesh(pupilGeo, darkTrimMat);
        // Slightly cross-eyed goofy look!
        pupil.position.set(
          side * xSpread + (crossEyed ? -side * eyeSize * 0.22 : side * eyeSize * 0.08),
          y + (side > 0 ? 0.03 : -0.02),
          z + eyeSize * 0.72
        );
        parent.add(eye, pupil);
      });
    };

    // Base chassis platform (hidden/low inside or shaped as main hull)
    lowerHull = addPart(
      bodyGroup,
      new THREE.BoxGeometry(w * 0.86, 0.34, l * 0.78),
      classId === 'meme_toilet' || classId === 'meme_shoe' ? whiteMat : paintMat,
      0,
      groundClearance + 0.2,
      0
    );

    if (classId === 'meme_banana') {
      // Curved yellow voxel banana hull
      addPart(bodyGroup, new THREE.BoxGeometry(1.15, 0.65, 1.8), paintMat, 0, groundClearance + 0.42, 0);
      addPart(frontGroup, new THREE.BoxGeometry(1.0, 0.6, 1.3), paintMat, 0, groundClearance + 0.65, 1.35, -0.35);
      addPart(frontGroup, new THREE.BoxGeometry(0.55, 0.42, 0.7), paintMat, 0, groundClearance + 1.0, 2.05, -0.68);
      addPart(frontGroup, new THREE.BoxGeometry(0.28, 0.28, 0.32), brownMat, 0, groundClearance + 1.24, 2.32, -0.75);
      addPart(rearGroup, new THREE.BoxGeometry(0.95, 0.58, 1.25), paintMat, 0, groundClearance + 0.68, -1.35, 0.38);
      addPart(rearGroup, new THREE.BoxGeometry(0.42, 0.38, 0.55), brownMat, 0, groundClearance + 1.05, -2.02, 0.62);
      addGooglyEyes(frontGroup, 0.32, groundClearance + 0.92, 1.72, 0.25);
      addPart(frontGroup, new THREE.BoxGeometry(0.65, 0.12, 0.12), redMat, 0, groundClearance + 0.52, 2.0);
    } else if (classId === 'meme_head') {
      // Giant goofy blocky cartoon head with messy hair + cross-eyes + wide grin!
      addPart(bodyGroup, new THREE.BoxGeometry(1.85, 1.38, 2.55), paintMat, 0, groundClearance + 0.78, 0);
      addPart(cabinGroup, new THREE.BoxGeometry(1.94, 0.36, 2.65), brownMat, 0, groundClearance + 1.56, -0.05);
      addPart(cabinGroup, new THREE.BoxGeometry(0.7, 0.32, 0.7), brownMat, -0.35, groundClearance + 1.8, 0.3, 0, 0, 0.25);
      addPart(cabinGroup, new THREE.BoxGeometry(0.65, 0.36, 0.65), brownMat, 0.35, groundClearance + 1.82, -0.2, 0, 0, -0.2);
      // Giant ears on left/right
      addPart(bodyGroup, new THREE.BoxGeometry(0.26, 0.52, 0.42), paintMat, -1.04, groundClearance + 0.85, 0);
      addPart(bodyGroup, new THREE.BoxGeometry(0.26, 0.52, 0.42), paintMat, 1.04, groundClearance + 0.85, 0);
      addGooglyEyes(frontGroup, 0.46, groundClearance + 1.08, 1.32, 0.31);
      // Red nose & goofy big teeth grin
      addPart(frontGroup, new THREE.BoxGeometry(0.28, 0.28, 0.28), redMat, 0, groundClearance + 0.78, 1.4);
      addPart(frontGroup, new THREE.BoxGeometry(1.15, 0.26, 0.14), whiteMat, 0, groundClearance + 0.42, 1.3);
      addPart(frontGroup, new THREE.BoxGeometry(0.32, 0.16, 0.16), pinkMat, 0.22, groundClearance + 0.3, 1.34);
    } else if (classId === 'meme_toilet') {
      // Porcelain Toilet Bowl + Tank + Raised Lid Spoiler + Googly Eyes!
      addPart(bodyGroup, new THREE.CylinderGeometry(0.82, 0.58, 0.78, 12), whiteMat, 0, groundClearance + 0.5, 0.28);
      addPart(bodyGroup, new THREE.CylinderGeometry(0.68, 0.5, 0.35, 12), paintMat, 0, groundClearance + 0.78, 0.28);
      // White oval seat ring
      addPart(cabinGroup, new THREE.TorusGeometry(0.68, 0.14, 8, 16).rotateX(Math.PI / 2), whiteMat, 0, groundClearance + 0.92, 0.28);
      // Rear vertical cistern tank + raised lid
      addPart(rearGroup, new THREE.BoxGeometry(1.48, 1.38, 0.78), whiteMat, 0, groundClearance + 1.05, -0.98);
      addPart(rearGroup, new THREE.BoxGeometry(1.56, 0.16, 0.86), whiteMat, 0, groundClearance + 1.78, -0.98);
      addPart(rearGroup, new THREE.BoxGeometry(0.24, 0.1, 0.14), chromeMat, -0.78, groundClearance + 1.48, -0.78);
      // Open toilet lid up high
      addPart(cabinGroup, new THREE.BoxGeometry(1.2, 0.9, 0.12), whiteMat, 0, groundClearance + 1.35, -0.52, -0.2);
      addGooglyEyes(frontGroup, 0.36, groundClearance + 1.45, -0.52, 0.24);
    } else if (classId === 'meme_duck') {
      // Rubber Duck Mobile: yellow plump oval body, flat orange duck bill, side wings, head!
      addPart(bodyGroup, new THREE.BoxGeometry(1.58, 0.78, 2.75), paintMat, 0, groundClearance + 0.55, -0.1);
      addPart(cabinGroup, new THREE.BoxGeometry(1.12, 0.74, 1.15), paintMat, 0, groundClearance + 1.22, 0.65);
      // Little wings sticking out both sides
      addPart(bodyGroup, new THREE.BoxGeometry(0.24, 0.44, 1.35), cheddarMat, -0.88, groundClearance + 0.66, -0.15, 0, 0, 0.18);
      addPart(bodyGroup, new THREE.BoxGeometry(0.24, 0.44, 1.35), cheddarMat, 0.88, groundClearance + 0.66, -0.15, 0, 0, -0.18);
      // Orange flat bill
      addPart(frontGroup, new THREE.BoxGeometry(0.95, 0.22, 0.72), orangeMat, 0, groundClearance + 0.96, 1.45);
      // Cute duck tail
      addPart(rearGroup, new THREE.BoxGeometry(0.7, 0.48, 0.65), paintMat, 0, groundClearance + 0.92, -1.55, -0.45);
      addGooglyEyes(cabinGroup, 0.38, groundClearance + 1.36, 1.25, 0.24);
    } else if (classId === 'meme_burger') {
      // Layered Cheeseburger: Bottom Bun + Juicy Patty + Melted Cheddar + Lettuce + Sesame Top Bun!
      addPart(bodyGroup, new THREE.CylinderGeometry(1.02, 0.96, 0.28, 14), paintMat, 0, groundClearance + 0.3, 0);
      addPart(bodyGroup, new THREE.CylinderGeometry(1.06, 1.06, 0.32, 14), brownMat, 0, groundClearance + 0.58, 0);
      addPart(bodyGroup, new THREE.BoxGeometry(2.12, 0.12, 2.12), cheddarMat, 0, groundClearance + 0.76, 0, 0, Math.PI / 4);
      addPart(bodyGroup, new THREE.CylinderGeometry(1.08, 1.08, 0.16, 12), greenMat, 0, groundClearance + 0.9, 0);
      addPart(bodyGroup, new THREE.CylinderGeometry(1.0, 1.0, 0.14, 14), redMat, 0, groundClearance + 1.02, 0);
      // Dome Top Bun + Sesame seeds
      addPart(cabinGroup, new THREE.CylinderGeometry(0.78, 1.02, 0.46, 14), paintMat, 0, groundClearance + 1.3, 0);
      for (let sx = -0.45; sx <= 0.45; sx += 0.3) {
        addPart(cabinGroup, new THREE.BoxGeometry(0.12, 0.05, 0.18), whiteMat, sx, groundClearance + 1.54, sx * 0.5);
      }
      addGooglyEyes(frontGroup, 0.42, groundClearance + 1.15, 1.02, 0.24);
    } else if (classId === 'meme_shoe') {
      // Giant Red High-Top Sneaker: white thick sole + toe cap + laced tongue + ankle collar cabin!
      addPart(bodyGroup, new THREE.BoxGeometry(1.56, 0.34, 4.15), whiteMat, 0, groundClearance + 0.24, 0);
      addPart(frontGroup, new THREE.BoxGeometry(1.48, 0.44, 1.45), whiteMat, 0, groundClearance + 0.52, 1.28);
      addPart(bodyGroup, new THREE.BoxGeometry(1.46, 0.75, 2.7), paintMat, 0, groundClearance + 0.74, -0.55);
      addPart(cabinGroup, new THREE.BoxGeometry(1.38, 0.72, 1.45), paintMat, 0, groundClearance + 1.25, -1.05);
      addPart(cabinGroup, new THREE.BoxGeometry(1.42, 0.22, 1.48), whiteMat, 0, groundClearance + 1.62, -1.05);
      // Crisscross white shoelaces on hood
      for (let lz = 0.05; lz <= 0.95; lz += 0.3) {
        addPart(frontGroup, new THREE.BoxGeometry(1.05, 0.08, 0.12), whiteMat, 0, groundClearance + 1.12 - lz * 0.2, lz);
      }
      addGooglyEyes(frontGroup, 0.38, groundClearance + 0.85, 1.85, 0.24);
    } else if (classId === 'meme_shark') {
      // Great White Shark Car: streamlined grey fuselage, white belly, dorsal fin + jagged teeth mouth!
      addPart(bodyGroup, new THREE.BoxGeometry(1.55, 0.72, 3.6), paintMat, 0, groundClearance + 0.58, -0.1);
      addPart(bodyGroup, new THREE.BoxGeometry(1.42, 0.24, 3.45), whiteMat, 0, groundClearance + 0.26, 0);
      addPart(frontGroup, new THREE.ConeGeometry(0.86, 1.55, 8).rotateX(Math.PI / 2), paintMat, 0, groundClearance + 0.55, 2.15);
      // Iconic Tall Dorsal Shark Fin on roof!
      addPart(cabinGroup, new THREE.BoxGeometry(0.18, 0.85, 0.9), paintMat, 0, groundClearance + 1.28, -0.25, -0.35);
      // Tail fin at back
      addPart(rearGroup, new THREE.BoxGeometry(0.16, 1.05, 0.75), paintMat, 0, groundClearance + 0.82, -2.15, 0.45);
      // Jagged Teeth Grille + Googly Eyes
      for (let tx = -0.45; tx <= 0.45; tx += 0.22) {
        addPart(frontGroup, new THREE.ConeGeometry(0.08, 0.22, 4), whiteMat, tx, groundClearance + 0.32, 2.02, Math.PI);
      }
      addGooglyEyes(frontGroup, 0.52, groundClearance + 0.78, 1.55, 0.22);
    } else if (classId === 'meme_cat') {
      // Cute Chubby Cat-Loaf Express: loaf body, pointed ears, white whiskers, :3 mouth, raised tail!
      addPart(bodyGroup, new THREE.BoxGeometry(1.66, 0.96, 3.35), paintMat, 0, groundClearance + 0.62, 0);
      // Two triangular cat ears + pink inner ears
      [-0.52, 0.52].forEach((ex) => {
        addPart(cabinGroup, new THREE.ConeGeometry(0.28, 0.55, 4), paintMat, ex, groundClearance + 1.36, 1.05, 0, Math.PI / 4);
        addPart(cabinGroup, new THREE.ConeGeometry(0.16, 0.38, 4), pinkMat, ex, groundClearance + 1.34, 1.12, 0, Math.PI / 4);
      });
      // Pink nose + white muzzle + 4 whiskers
      addPart(frontGroup, new THREE.BoxGeometry(0.22, 0.14, 0.14), pinkMat, 0, groundClearance + 0.78, 1.72);
      [-1, 1].forEach((side) => {
        addPart(frontGroup, new THREE.BoxGeometry(0.55, 0.05, 0.05), whiteMat, side * 0.92, groundClearance + 0.8, 1.52, 0, 0, side * 0.14);
        addPart(frontGroup, new THREE.BoxGeometry(0.55, 0.05, 0.05), whiteMat, side * 0.92, groundClearance + 0.68, 1.52, 0, 0, -side * 0.1);
      });
      // Raised tail spoiler
      addPart(rearGroup, new THREE.BoxGeometry(0.24, 0.95, 0.24), paintMat, 0, groundClearance + 1.25, -1.62, -0.32);
      addGooglyEyes(frontGroup, 0.42, groundClearance + 0.98, 1.66, 0.25, false);
    } else if (classId === 'meme_hotdog') {
      // Glizzy Hotdogger: golden bun sides + juicy giant sausage center + zig-zag yellow mustard!
      addPart(bodyGroup, new THREE.BoxGeometry(0.48, 0.62, 3.95), paintMat, -0.58, groundClearance + 0.45, 0);
      addPart(bodyGroup, new THREE.BoxGeometry(0.48, 0.62, 3.95), paintMat, 0.58, groundClearance + 0.45, 0);
      addPart(bodyGroup, new THREE.CylinderGeometry(0.44, 0.44, 4.5, 10).rotateX(Math.PI / 2), redMat, 0, groundClearance + 0.68, 0);
      // Mustard squiggle strip on top
      addPart(cabinGroup, new THREE.BoxGeometry(0.22, 0.12, 3.6), cheddarMat, 0, groundClearance + 1.12, 0);
      addGooglyEyes(frontGroup, 0.28, groundClearance + 0.88, 2.08, 0.22);
    } else {
      // meme_toast: Butter Toast Racer — square golden crust toast + melting cube of butter on top + derpy eyes & tongue!
      addPart(bodyGroup, new THREE.BoxGeometry(1.78, 1.12, 3.1), brownMat, 0, groundClearance + 0.68, 0);
      addPart(bodyGroup, new THREE.BoxGeometry(1.52, 0.88, 3.16), paintMat, 0, groundClearance + 0.68, 0);
      // Melting cube of yellow butter pat on roof!
      addPart(cabinGroup, new THREE.BoxGeometry(0.88, 0.36, 0.88), cheddarMat, 0.12, groundClearance + 1.38, -0.1, 0, 0.35);
      addGooglyEyes(frontGroup, 0.44, groundClearance + 0.92, 1.56, 0.26);
      // Pink derpy tongue sticking out
      addPart(frontGroup, new THREE.BoxGeometry(0.36, 0.28, 0.22), pinkMat, 0.16, groundClearance + 0.46, 1.62, 0.35);
    }

    // Standard Headlights, Taillights & Signals on Meme Cars
    const hlY = groundClearance + 0.42;
    const hlX = w * 0.32;
    [-hlX, hlX].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), headMat);
      hl.position.set(x, hlY, l * 0.45);
      frontGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), tailMat);
      tl.position.set(x, hlY, -l * 0.45);
      rearGroup.add(tl);
      taillightMeshes.push(tl);
    });

    const leftSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), leftSigMat);
    leftSig.position.set(-w * 0.44, hlY, l * 0.42);
    const rightSig = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), rightSigMat);
    rightSig.position.set(w * 0.44, hlY, l * 0.42);
    frontGroup.add(leftSig, rightSig);

    const wheelX = w / 2 - 0.05;
    const frontZ = l * 0.3;
    const rearZ = -l * 0.3;
    [
      [-wheelX, frontZ],
      [wheelX, frontZ],
      [-wheelX, rearZ],
      [wheelX, rearZ],
    ].forEach(([wx, wz]) => {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wr, wz);
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(getTireGeo(wr, 0.26), tireMat);
      const rim = new THREE.Mesh(getRimGeo(wr, 0.26), chromeMat);
      spinGroup.add(tire, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xfffbeb, 0, 55, Math.PI / 5, 0.45, 1.4);
      headlightSpot.visible = false;
      headlightSpot.position.set(0, hlY + 0.2, l / 2);
      headlightSpot.target.position.set(0, 0, l / 2 + 18);
      frontGroup.add(headlightSpot);
      frontGroup.add(headlightSpot.target);
    }

    return {
      root,
      bodyGroup,
      frontGroup,
      rearGroup,
      lowerHull,
      cabinGroup,
      wheelPivots,
      wheelSpinMeshes,
      headlightMeshes,
      taillightMeshes,
      leftSignalMesh: leftSig,
      rightSignalMesh: rightSig,
      headlightSpot,
      spec,
      paintMat,
      damage,
      applyImpactDent: (localX: number, localZ: number, severity: number) => {
        const s = THREE.MathUtils.clamp(severity, 0.14, 0.95);
        if (Math.abs(localZ) >= Math.abs(localX) * 0.85) {
          if (localZ >= 0) damage.front = Math.min(1.25, damage.front + s);
          else damage.rear = Math.min(1.25, damage.rear + s);
        } else {
          if (localX < 0) damage.left = Math.min(1.25, damage.left + s);
          else damage.right = Math.min(1.25, damage.right + s);
        }
        syncVisualDent();
      },
      addBulletHole,
      setCharred: (charred: boolean) => {
        damage.charred = charred;
        paintMat.color.setHex(charred ? 0x1c1917 : baseColor);
        paintMat.roughness = charred ? 0.96 : 0.46;
      },
      resetDamage: () => {
        damage.front = 0;
        damage.rear = 0;
        damage.left = 0;
        damage.right = 0;
        damage.charred = false;
        clearBulletHoles();
        paintMat.color.setHex(baseColor);
        paintMat.roughness = 0.46;
        syncVisualDent();
      },
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  } else {
    const isSporty =
      classId === 'sports' ||
      classId === 'supercar' ||
      classId === 'hyper_viper' ||
      classId === 'track_phantom' ||
      classId === 'muscle' ||
      classId === 'convertible' ||
      classId === 'coupe';

    const lowerHeight =
      classId === 'bus'
        ? h * 0.72
        : classId === 'truck'
          ? h * 0.42
          : classId === 'van' || classId === 'ambulance'
            ? h * 0.56
            : isSporty
              ? h * 0.46
              : h * 0.44;

    const lowerGeo = new THREE.BoxGeometry(w, lowerHeight, l);
    lowerHull = new THREE.Mesh(lowerGeo, paintMat);
    lowerHull.position.set(0, groundClearance + lowerHeight / 2, 0);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);
    disposables.push(lowerGeo);

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.2, 0.22), darkTrimMat);
    frontBumper.position.set(0, groundClearance + 0.11, l / 2 + 0.02);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.54, 0.22, 0.06), chromeMat);
    grille.position.set(0, groundClearance + lowerHeight * 0.55, l / 2 + 0.02);
    frontGroup.add(frontBumper, grille);

    if (
      classId === 'supercar' ||
      classId === 'sports' ||
      classId === 'hyper_viper' ||
      classId === 'track_phantom'
    ) {
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.05, 0.26), darkTrimMat);
      splitter.position.set(0, groundClearance + 0.03, l / 2 + 0.09);
      frontGroup.add(splitter);
    }
    if (classId === 'pickup') {
      const bullBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.34, 0.12), chromeMat);
      bullBar.position.set(0, groundClearance + 0.25, l / 2 + 0.12);
      frontGroup.add(bullBar);
    }

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.2, 0.22), darkTrimMat);
    rearBumper.position.set(0, groundClearance + 0.11, -l / 2 - 0.02);
    rearGroup.add(rearBumper);

    if (classId === 'police') {
      const doorWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.4,
      });
      disposables.push(doorWhiteMat);
      const doors = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, lowerHeight * 0.92, l * 0.38), doorWhiteMat);
      doors.position.set(0, groundClearance + lowerHeight / 2, 0.05);
      cabinGroup.add(doors);
    } else if (classId === 'ambulance') {
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
      disposables.push(stripeMat);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.18, l * 0.96), stripeMat);
      stripe.position.set(0, groundClearance + lowerHeight * 0.65, 0);
      cabinGroup.add(stripe);
    } else if (classId === 'muscle') {
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
      disposables.push(stripeMat);
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.68), chromeMat);
      scoop.position.set(0, groundClearance + lowerHeight + 0.07, l * 0.24);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, l * 0.96), stripeMat);
      stripe.position.set(0, groundClearance + lowerHeight + 0.01, 0);
      frontGroup.add(scoop);
      cabinGroup.add(stripe);
    }

    if (classId === 'truck') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.48, l * 0.3), paintMat);
      cab.position.set(0, groundClearance + lowerHeight + h * 0.24, l * 0.3);
      cab.castShadow = true;
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, h * 0.25, l * 0.26), glassMat);
      windshield.position.set(0, groundClearance + lowerHeight + h * 0.32, l * 0.32);

      const cargoMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, metalness: 0.2 });
      disposables.push(cargoMat);
      const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.62, l * 0.64), cargoMat);
      cargoBox.position.set(0, groundClearance + lowerHeight + h * 0.31, -l * 0.17);
      cargoBox.castShadow = true;
      cargoBox.receiveShadow = true;
      cabinGroup.add(cab, windshield, cargoBox);
    } else if (classId === 'bus') {
      const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.34, l * 0.95), glassMat);
      upperGlass.position.set(0, groundClearance + lowerHeight + h * 0.12, 0);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.16, l * 0.98), chromeMat);
      roof.position.set(0, groundClearance + lowerHeight + h * 0.3, 0);
      roof.castShadow = true;
      cabinGroup.add(upperGlass, roof);
    } else if (classId === 'pickup') {
      const cabH = h - lowerHeight - groundClearance;
      const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, cabH, l * 0.34), glassMat);
      cabGlass.position.set(0, groundClearance + lowerHeight + cabH / 2 - 0.02, l * 0.08);
      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.1, l * 0.3), paintMat);
      roofCap.position.set(0, groundClearance + lowerHeight + cabH - 0.02, l * 0.08);
      const bedInner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.12, l * 0.38), darkTrimMat);
      bedInner.position.set(0, groundClearance + lowerHeight - 0.04, -l * 0.29);
      cabinGroup.add(cabGlass, roofCap, bedInner);
    } else if (classId === 'convertible') {
      const cabH = h - lowerHeight - groundClearance;
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, cabH * 0.95, 0.14), glassMat);
      windshield.position.set(0, groundClearance + lowerHeight + cabH * 0.42, l * 0.16);
      windshield.rotation.x = -0.45;
      const interior = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.08, l * 0.42), darkTrimMat);
      interior.position.set(0, groundClearance + lowerHeight + 0.02, -l * 0.05);
      const rollL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.1), chromeMat);
      rollL.position.set(-w * 0.25, groundClearance + lowerHeight + 0.16, -l * 0.24);
      const rollR = rollL.clone();
      rollR.position.x = w * 0.25;
      cabinGroup.add(windshield, interior, rollL, rollR);
    } else {
      const cabinLen =
        classId === 'van' || classId === 'ambulance'
          ? l * 0.78
          : classId === 'suv' || classId === 'hatchback'
            ? l * 0.64
            : classId === 'supercar' ||
                classId === 'hyper_viper' ||
                classId === 'track_phantom'
              ? l * 0.45
              : l * 0.52;
      const cabinH = h - lowerHeight - groundClearance;
      const cabinZ =
        classId === 'van' || classId === 'ambulance' || classId === 'hatchback' ? -l * 0.08 : -l * 0.05;

      const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, cabinH, cabinLen), glassMat);
      cabinGlass.position.set(0, groundClearance + lowerHeight + cabinH / 2 - 0.02, cabinZ);
      cabinGlass.castShadow = true;

      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.1, cabinLen * 0.88), paintMat);
      roofCap.position.set(0, groundClearance + lowerHeight + cabinH - 0.02, cabinZ);
      roofCap.castShadow = true;
      cabinGroup.add(cabinGlass, roofCap);

      if (
        classId === 'sports' ||
        classId === 'supercar' ||
        classId === 'hyper_viper' ||
        classId === 'track_phantom' ||
        classId === 'coupe' ||
        classId === 'muscle'
      ) {
        const isHyper =
          classId === 'supercar' ||
          classId === 'hyper_viper' ||
          classId === 'track_phantom';
        const wingH = classId === 'track_phantom' ? 0.34 : isHyper ? 0.28 : classId === 'sports' ? 0.22 : 0.1;
        const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.06, 0.3), darkTrimMat);
        spoilerWing.position.set(0, groundClearance + lowerHeight + wingH, -l / 2 + 0.18);
        const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.06, wingH, 0.14), darkTrimMat);
        pylonL.position.set(-w * 0.3, groundClearance + lowerHeight + wingH / 2, -l / 2 + 0.18);
        const pylonR = pylonL.clone();
        pylonR.position.x = w * 0.3;
        rearGroup.add(spoilerWing, pylonL, pylonR);
      }

      if (classId === 'taxi') {
        const taxiSignMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 1.4,
        });
        disposables.push(taxiSignMat);
        const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.26), taxiSignMat);
        taxiSign.position.set(0, groundClearance + lowerHeight + cabinH + 0.11, cabinZ + 0.2);
        cabinGroup.add(taxiSign);
      }

      if (classId === 'police' || classId === 'ambulance') {
        const barBase = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 0.07, 0.24), darkTrimMat);
        barBase.position.set(0, groundClearance + lowerHeight + cabinH + 0.04, cabinZ + 0.15);
        const redMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.3,
          roughness: 0.2,
        });
        const blueMat = new THREE.MeshStandardMaterial({
          color: classId === 'ambulance' ? 0xf8fafc : 0x3b82f6,
          emissive: classId === 'ambulance' ? 0xfef2f2 : 0x3b82f6,
          emissiveIntensity: 0.3,
          roughness: 0.2,
        });
        disposables.push(redMat, blueMat);
        lightbarRed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.11, 0.2), redMat);
        lightbarRed.position.set(-w * 0.16, groundClearance + lowerHeight + cabinH + 0.1, cabinZ + 0.15);
        lightbarBlue = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.11, 0.2), blueMat);
        lightbarBlue.position.set(w * 0.16, groundClearance + lowerHeight + cabinH + 0.1, cabinZ + 0.15);
        cabinGroup.add(barBase, lightbarRed, lightbarBlue);
      }
    }

    const hlY = groundClearance + lowerHeight * 0.62;
    const hlX = w * 0.35;
    [-hlX, hlX].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.06), headMat);
      hl.position.set(x, hlY, l / 2 + 0.01);
      frontGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.06), tailMat);
      tl.position.set(x, hlY, -l / 2 - 0.01);
      rearGroup.add(tl);
      taillightMeshes.push(tl);
    });

    const leftSig = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), leftSigMat);
    leftSig.position.set(-w * 0.45, hlY, l / 2 - 0.02);
    const rightSig = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), rightSigMat);
    rightSig.position.set(w * 0.45, hlY, l / 2 - 0.02);
    frontGroup.add(leftSig, rightSig);

    const wheelX = w / 2 - 0.04;
    const frontZ = l * 0.31;
    const rearZ = -l * 0.31;
    const wheelCoords: Array<[number, number]> = [
      [-wheelX, frontZ],
      [wheelX, frontZ],
      [-wheelX, rearZ],
      [wheelX, rearZ],
    ];
    const tireWidth = classId === 'truck' || classId === 'bus' ? 0.32 : isSporty ? 0.28 : 0.24;

    wheelCoords.forEach(([wx, wz]) => {
      const pivot = new THREE.Group();
      pivot.position.set(wx, wr, wz);
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(getTireGeo(wr, tireWidth), tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(getRimGeo(wr, tireWidth), chromeMat);
      spinGroup.add(tire, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xfffbeb, 0, 55, Math.PI / 5, 0.45, 1.4);
      headlightSpot.visible = false;
      headlightSpot.position.set(0, hlY + 0.2, l / 2);
      headlightSpot.target.position.set(0, 0, l / 2 + 18);
      frontGroup.add(headlightSpot);
      frontGroup.add(headlightSpot.target);
    }

    return {
      root,
      bodyGroup,
      frontGroup,
      rearGroup,
      lowerHull,
      cabinGroup,
      wheelPivots,
      wheelSpinMeshes,
      headlightMeshes,
      taillightMeshes,
      leftSignalMesh: leftSig,
      rightSignalMesh: rightSig,
      headlightSpot,
      lightbarRed,
      lightbarBlue,
      spec,
      paintMat,
      damage,
      applyImpactDent: (localX: number, localZ: number, severity: number) => {
        const s = THREE.MathUtils.clamp(severity, 0.14, 0.95);
        if (Math.abs(localZ) >= Math.abs(localX) * 0.85) {
          if (localZ >= 0) damage.front = Math.min(1.25, damage.front + s);
          else damage.rear = Math.min(1.25, damage.rear + s);
        } else {
          if (localX < 0) damage.left = Math.min(1.25, damage.left + s);
          else damage.right = Math.min(1.25, damage.right + s);
        }
        syncVisualDent();
      },
      addBulletHole,
      setCharred: (charred: boolean) => {
        damage.charred = charred;
        if (charred) {
          paintMat.color.setHex(0x1c1917);
          paintMat.roughness = 0.96;
          paintMat.metalness = 0.05;
          glassMat.opacity = 0.35;
        } else {
          paintMat.color.setHex(baseColor);
          paintMat.roughness = 0.24;
          paintMat.metalness = classId === 'truck' || classId === 'bus' ? 0.35 : 0.72;
          glassMat.opacity = 0.84;
        }
      },
      resetDamage: () => {
        damage.front = 0;
        damage.rear = 0;
        damage.left = 0;
        damage.right = 0;
        clearBulletHoles();
        setCharredSafe(false);
        syncVisualDent();
      },
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  }

  function setCharredSafe(charred: boolean) {
    damage.charred = charred;
    paintMat.color.setHex(charred ? 0x1c1917 : baseColor);
    paintMat.roughness = charred ? 0.96 : 0.24;
  }

  // Motorcycle & Bicycle return
  const dummySig = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), leftSigMat);
  const dummySigR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), rightSigMat);
  dummySig.position.set(-0.2, wr + 0.45, 0.45);
  dummySigR.position.set(0.2, wr + 0.45, 0.45);
  frontGroup.add(dummySig, dummySigR);

  return {
    root,
    bodyGroup,
    frontGroup,
    rearGroup,
    lowerHull,
    cabinGroup,
    wheelPivots,
    wheelSpinMeshes,
    headlightMeshes,
    taillightMeshes,
    leftSignalMesh: dummySig,
    rightSignalMesh: dummySigR,
    spec,
    paintMat,
    damage,
    applyImpactDent: (localX: number, localZ: number, severity: number) => {
      const s = THREE.MathUtils.clamp(severity, 0.15, 0.9);
      if (Math.abs(localZ) >= Math.abs(localX)) {
        if (localZ >= 0) damage.front = Math.min(1.25, damage.front + s);
        else damage.rear = Math.min(1.25, damage.rear + s);
      } else {
        if (localX < 0) damage.left = Math.min(1.25, damage.left + s);
        else damage.right = Math.min(1.25, damage.right + s);
      }
      syncVisualDent();
    },
    addBulletHole,
    setCharred: (charred: boolean) => {
      damage.charred = charred;
      paintMat.color.setHex(charred ? 0x1c1917 : baseColor);
    },
    resetDamage: () => {
      damage.front = 0;
      damage.rear = 0;
      damage.left = 0;
      damage.right = 0;
      damage.charred = false;
      clearBulletHoles();
      paintMat.color.setHex(baseColor);
      syncVisualDent();
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
