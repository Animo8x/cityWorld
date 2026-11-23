import * as THREE from 'three';
import { InteriorPortalDef } from '../types';
import { INTERIOR_PORTALS } from './worldLayout';

export interface InteriorsHandle {
  setActiveInterior: (id: string | null) => void;
  dispose: () => void;
}

export function buildInteriors(scene: THREE.Scene): InteriorsHandle {
  const disposables: Array<{ dispose: () => void }> = [];
  const interiorGroups = new Map<string, THREE.Group>();

  INTERIOR_PORTALS.forEach((portal: InteriorPortalDef) => {
    const cx = portal.interiorCenter.x;
    const cy = portal.interiorCenter.y;
    const cz = portal.interiorCenter.z;

    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    group.visible = false;
    interiorGroups.set(portal.id, group);

    const isMarket = portal.kind === 'supermarket';
    const isHouse = portal.kind === 'house';
    const tier = portal.houseSizeTier ?? 1;
    const roomW = isHouse ? (tier === 1 ? 18 : tier === 2 ? 22 : tier === 3 ? 28 : 34) : 24;
    const roomD = isHouse ? (tier === 1 ? 18 : tier === 2 ? 22 : tier === 3 ? 26 : 30) : 24;
    const halfW = roomW / 2;
    const halfD = roomD / 2;
    const wallH = isHouse && tier >= 3 ? 7.2 : 6.2;

    const floorMat = new THREE.MeshStandardMaterial({
      color: isMarket ? 0xe2e8f0 : isHouse ? (tier >= 3 ? 0xf5f0e6 : 0xb48a5a) : 0x1e293b,
      roughness: isHouse ? 0.45 : 0.35,
      metalness: isHouse && tier >= 3 ? 0.12 : 0.15,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: isMarket ? 0x475569 : isHouse ? 0xf1f5f9 : 0x334155,
      roughness: 0.72,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: portal.accentColor,
      emissive: portal.accentColor,
      emissiveIntensity: 1.4,
    });
    disposables.push(floorMat, wallMat, accentMat);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.4, roomD), floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;

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

    if (isHouse) {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.55 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65 });
      const linenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
      const blanketMat = new THREE.MeshStandardMaterial({
        color: portal.accentColor,
        roughness: 0.75,
      });
      const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.65, roughness: 0.25 });
      const foodGlowMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 1.6,
      });
      const bedGlowMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.6,
      });
      const sofaMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
      const fruitMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
      const breadMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
      disposables.push(woodMat, darkWoodMat, linenMat, blanketMat, fridgeMat, foodGlowMat, bedGlowMat, sofaMat, fruitMat, breadMat);

      // Center Property Management / Deed Desk
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.1), darkWoodMat);
      desk.position.set(0, 0.5, -halfD + 3.2);
      const deskStrip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.15), accentMat);
      deskStrip.position.set(0, 0.95, -halfD + 3.2);

      // LEFT WING: Kitchen & Dining Table (Food Station)
      const foodX = -halfW * 0.48;
      const foodZ = -1.5;
      const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.5), woodMat);
      tableTop.position.set(foodX, 0.86, foodZ);
      const tableBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.82, 0.8), darkWoodMat);
      tableBase.position.set(foodX, 0.41, foodZ);
      const plate1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.06, 12), linenMat);
      plate1.position.set(foodX - 0.5, 0.96, foodZ);
      const dish1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), breadMat);
      dish1.position.set(foodX - 0.5, 1.05, foodZ);
      const plate2 = plate1.clone();
      plate2.position.set(foodX + 0.5, 0.96, foodZ);
      const dish2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), fruitMat);
      dish2.position.set(foodX + 0.5, 1.05, foodZ);

      // Refrigerator & Kitchen Counter behind dining table
      const fridge = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.3, 1.0), fridgeMat);
      fridge.position.set(foodX - 1.5, 1.15, -halfD + 1.1);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.0), linenMat);
      counter.position.set(foodX + 0.9, 0.5, -halfD + 1.1);

      const foodRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 8, 28), foodGlowMat);
      foodRing.rotation.x = Math.PI / 2;
      foodRing.position.set(foodX, 0.08, foodZ);

      // RIGHT WING: Bedroom (King/Cozy Bed + Nightstand + Lamp -> Sleep Station)
      const bedX = halfW * 0.48;
      const bedZ = -1.5;
      const bedW = tier >= 3 ? 2.6 : 2.1;
      const bedL = tier >= 3 ? 3.2 : 2.7;
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.25, 0.45, bedL + 0.2), darkWoodMat);
      bedFrame.position.set(bedX, 0.24, bedZ);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.32, bedL), linenMat);
      mattress.position.set(bedX, 0.62, bedZ);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.04, 0.34, bedL * 0.65), blanketMat);
      blanket.position.set(bedX, 0.64, bedZ + bedL * 0.16);
      const pillowL = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.38, 0.16, 0.48), linenMat);
      pillowL.position.set(bedX - bedW * 0.24, 0.84, bedZ - bedL * 0.34);
      const pillowR = pillowL.clone();
      pillowR.position.x = bedX + bedW * 0.24;
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.3, 1.4, 0.22), darkWoodMat);
      headboard.position.set(bedX, 0.72, bedZ - bedL * 0.5 - 0.1);

      const bedRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 8, 28), bedGlowMat);
      bedRing.rotation.x = Math.PI / 2;
      bedRing.position.set(bedX, 0.08, bedZ);

      // Living Room Rug & Sofa
      const rug = new THREE.Mesh(new THREE.BoxGeometry(roomW * 0.36, 0.04, 4.2), blanketMat);
      rug.position.set(0, 0.02, 2.5);
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.2), sofaMat);
      sofa.position.set(0, 0.45, 2.5);

      group.add(
        desk,
        deskStrip,
        tableTop,
        tableBase,
        plate1,
        dish1,
        plate2,
        dish2,
        fridge,
        counter,
        foodRing,
        bedFrame,
        mattress,
        blanket,
        pillowL,
        pillowR,
        headboard,
        bedRing,
        rug,
        sofa
      );

      // Mansion / Villa extra grand chandelier & indoor lounge columns
      if (tier >= 3) {
        const chandelier = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), accentMat);
        chandelier.position.set(0, wallH - 1.3, 0);
        group.add(chandelier);
      }

      const exitMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 });
      disposables.push(exitMat);
      const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.2), exitMat);
      exitDoor.position.set(0, 1.6, halfD - 0.4);

      const roomLight = new THREE.PointLight(0xfffbeb, tier >= 3 ? 32 : 24, roomW + 10, 1.4);
      roomLight.position.set(0, wallH - 0.8, 0);

      group.add(floor, ceiling, backWall, frontWall, leftWall, rightWall, exitDoor, roomLight);
      scene.add(group);
      return;
    }

    // Checkout / Service Desk for commercial interiors
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 1.15, 1.4), wallMat);
    desk.position.set(0, 0.58, -5);
    const deskStrip = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.14, 1.45), accentMat);
    deskStrip.position.set(0, 1.05, -5);

    if (isMarket) {
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const packRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
      const packBlueMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });
      const packGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      const fridgeMat = new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      });
      disposables.push(shelfMat, packRedMat, packBlueMat, packGoldMat, fridgeMat);

      [-6.5, 6.5].forEach((aisleX) => {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 9), shelfMat);
        shelf.position.set(aisleX, 1.25, 1);
        const item1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 7.6), packRedMat);
        item1.position.set(aisleX, 1.8, 1);
        const item2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 7.6), packGoldMat);
        item2.position.set(aisleX, 1.05, 1);
        group.add(shelf, item1, item2);
      });

      const cooler = new THREE.Mesh(new THREE.BoxGeometry(9, 2.8, 0.9), fridgeMat);
      cooler.position.set(0, 1.4, -10.8);
      group.add(cooler);
    } else if (portal.kind === 'gunshop') {
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5, metalness: 0.6 });
      const gunSteel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
      disposables.push(rackMat, gunSteel);
      [-8, 8].forEach((rx) => {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.2, 10), rackMat);
        rack.position.set(rx, 1.6, 0);
        const barrelRow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 8.2), gunSteel);
        barrelRow.position.set(rx, 2.1, 0);
        const barrelRow2 = barrelRow.clone();
        barrelRow2.position.y = 1.25;
        group.add(rack, barrelRow, barrelRow2);
      });
    } else if (portal.kind === 'skins') {
      const pedMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.96,
        roughness: 0.14,
        emissive: 0x78350f,
        emissiveIntensity: 0.15,
      });
      const cyberMat = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        metalness: 0.72,
        roughness: 0.24,
        emissive: 0x4c1d95,
        emissiveIntensity: 0.3,
      });
      disposables.push(pedMat, goldMat, cyberMat);
      [-5.5, 5.5].forEach((mx, idx) => {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.5, 16), pedMat);
        ped.position.set(mx, 0.25, 1);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.3), idx === 0 ? goldMat : cyberMat);
        torso.position.set(mx, 1.35, 1);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), idx === 0 ? goldMat : cyberMat);
        head.position.set(mx, 1.98, 1);
        group.add(ped, torso, head);
      });
    } else if (portal.kind === 'dealership') {
      const plinthMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.5 });
      const showCarMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.18 });
      disposables.push(plinthMat, showCarMat);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.24, 24), plinthMat);
      plinth.position.set(5.5, 0.12, 2);
      const modelHull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.3), showCarMat);
      modelHull.position.set(5.5, 0.72, 2);
      const modelCabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), plinthMat);
      modelCabin.position.set(5.5, 1.25, 1.7);
      group.add(plinth, modelHull, modelCabin);
    }

    // Exit door beacon at +Z
    const exitMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 });
    disposables.push(exitMat);
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.2), exitMat);
    exitDoor.position.set(0, 1.6, 11.6);

    const roomLight = new THREE.PointLight(0xfffbeb, isMarket ? 24 : 20, 28, 1.5);
    roomLight.position.set(0, 5.2, 0);

    group.add(floor, ceiling, backWall, frontWall, leftWall, rightWall, desk, deskStrip, exitDoor, roomLight);
    scene.add(group);
  });

  return {
    setActiveInterior: (id: string | null) => {
      interiorGroups.forEach((grp, key) => {
        grp.visible = key === id;
      });
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
