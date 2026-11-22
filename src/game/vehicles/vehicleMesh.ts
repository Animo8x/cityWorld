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
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  leftSignalMesh: THREE.Mesh;
  rightSignalMesh: THREE.Mesh;
  headlightSpot?: THREE.SpotLight;
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

  const paintMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: classId === 'truck' || classId === 'bus' ? 0.35 : 0.72,
    roughness: 0.24,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.78,
    metalness: 0.25,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.94,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.45,
    transparent: true,
    opacity: 0.84,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.88,
    metalness: 0.05,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.25,
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
    darkTrimMat,
    chromeMat,
    glassMat,
    tireMat,
    headMat,
    tailMat,
    leftSigMat,
    rightSigMat,
  ];

  const wheelPivots: THREE.Group[] = [];
  const wheelSpinMeshes: THREE.Object3D[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  let lightbarRed: THREE.Mesh | undefined;
  let lightbarBlue: THREE.Mesh | undefined;
  let headlightSpot: THREE.SpotLight | undefined;
  let lowerHull!: THREE.Mesh;

  const w = spec.width;
  const l = spec.length;
  const h = spec.height;
  const wr = spec.wheelRadius;
  const groundClearance = wr * 0.72;

  const bulletHoleGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.016, 8);
  const bulletHoleMat = new THREE.MeshStandardMaterial({
    color: 0x050507,
    roughness: 0.92,
    metalness: 0.15,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  disposables.push(bulletHoleGeo, bulletHoleMat);

  const bulletHoles: THREE.Mesh[] = [];
  let bulletHoleCursor = 0;
  const maxBulletHoles = 24;
  for (let i = 0; i < maxBulletHoles; i++) {
    const hole = new THREE.Mesh(bulletHoleGeo, bulletHoleMat);
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

    // Noticeable progressive structural crumpling scaled with impact force, still recognizable as a car
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

    // Main diamond bicycle frame
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

    // Saddle
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.28), darkTrimMat);
    saddle.position.set(0, wr + 0.56, -0.24);
    cabinGroup.add(saddle);

    // Fork + Stem + Handlebars
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

    // Crank / Pedal ring
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateZ(Math.PI / 2), chromeMat);
    crank.position.set(0, wr - 0.04, -0.05);
    cabinGroup.add(crank);

    // Thin spoked bicycle wheels
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
  } else {
    const isSporty =
      classId === 'sports' ||
      classId === 'supercar' ||
      classId === 'hyper_viper' ||
      classId === 'track_phantom' ||
      classId === 'nova_x' ||
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
      classId === 'track_phantom' ||
      classId === 'nova_x'
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
                classId === 'track_phantom' ||
                classId === 'nova_x'
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
        classId === 'nova_x' ||
        classId === 'coupe' ||
        classId === 'muscle'
      ) {
        const isHyper =
          classId === 'supercar' ||
          classId === 'hyper_viper' ||
          classId === 'track_phantom' ||
          classId === 'nova_x';
        const wingH = classId === 'nova_x' || classId === 'track_phantom' ? 0.34 : isHyper ? 0.28 : classId === 'sports' ? 0.22 : 0.1;
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
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.56, wr * 0.56, tireWidth + 0.02, 10).rotateZ(Math.PI / 2),
        chromeMat
      );
      spinGroup.add(tire, rim);
      pivot.add(spinGroup);
      root.add(pivot);
      wheelPivots.push(pivot);
      wheelSpinMeshes.push(spinGroup);
    });

    if (withSpotLight) {
      headlightSpot = new THREE.SpotLight(0xfffbeb, 0, 55, Math.PI / 5, 0.45, 1.4);
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
