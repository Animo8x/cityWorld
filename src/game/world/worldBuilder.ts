import * as THREE from 'three';
import { ColliderBox } from '../types';
import { ProceduralTextureSet } from './textures';
import {
  groundHeightAt,
  INTERIOR_PORTALS,
  ISLAND_CENTER,
  MAINLAND_BORDER,
  RICH_COUNTRY_BOUNDS,
  RICH_COUNTRY_CENTER,
  ROAD_SEGMENTS,
  TRAFFIC_INTERSECTIONS,
  WATER_LEVEL,
} from './worldLayout';

export interface TrafficLightNode {
  x: number;
  z: number;
  phaseOffset: number;
  nsRed: THREE.Mesh;
  nsGreen: THREE.Mesh;
  ewRed: THREE.Mesh;
  ewGreen: THREE.Mesh;
}

export interface WorldBuildResult {
  colliders: ColliderBox[];
  trafficLights: TrafficLightNode[];
  streetLampBulbsMat: THREE.MeshStandardMaterial;
  skyscraperGlassMat: THREE.MeshStandardMaterial;
  waterUniforms: { uTime: { value: number } };
  radarDish: THREE.Object3D;
  roadMaterials: THREE.MeshStandardMaterial[];
  updateStreaming: (playerX: number, playerZ: number, streamRadius?: number) => void;
  updateLightsAndWater: (time: number, isNight: boolean, isRaining: boolean, simTime: number) => void;
  syncOwnedHouseSigns: (ownedHouses: Set<string>) => void;
  dispose: () => void;
}

export function buildCityWorld(
  scene: THREE.Scene,
  tex: ProceduralTextureSet,
  isMobile = false
): WorldBuildResult {
  const colliders: ColliderBox[] = [];
  const trafficLights: TrafficLightNode[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const chunkSize = 280;
  const chunks = new Map<string, THREE.Group>();
  const getChunk = (x: number, z: number): THREE.Group => {
    const cx = Math.floor(x / chunkSize);
    const cz = Math.floor(z / chunkSize);
    const key = `${cx},${cz}`;
    let g = chunks.get(key);
    if (!g) {
      g = new THREE.Group();
      g.userData = { cx, cz, centerX: (cx + 0.5) * chunkSize, centerZ: (cz + 0.5) * chunkSize };
      chunks.set(key, g);
      scene.add(g);
    }
    return g;
  };

  // 1. Procedural Terrain Mesh (expanded & shifted east to cover Mainland + Island + Auroria Rich Country)
  const terrainSegs = isMobile ? 90 : 112;
  const terrainGeo = new THREE.PlaneGeometry(3000, 2600, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(260, 0, 120);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const _c = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const h = groundHeightAt(vx, vz);
    posAttr.setY(i, h);

    const onIsland = Math.hypot((vx - ISLAND_CENTER.x) / 1.05, (vz - ISLAND_CENTER.z) / 1.15) < 110;
    const onAuroria =
      vx >= RICH_COUNTRY_BOUNDS.minX - 16 &&
      vx <= RICH_COUNTRY_BOUNDS.maxX + 16 &&
      vz >= RICH_COUNTRY_BOUNDS.minZ - 16 &&
      vz <= RICH_COUNTRY_BOUNDS.maxZ + 16;

    if (onAuroria) {
      if (vx >= 776 && vx <= 816 && vz >= -232 && vz <= -8) {
        _c.setHex(0x334155);
      } else if (h < 0.25) {
        _c.setHex(0xf3e2b3);
      } else if (vx >= 850 && vx <= 1160 && vz >= -312 && vz <= 70) {
        _c.setHex(0x2d8a4e);
      } else {
        _c.setHex(0xf4ecd8);
      }
    } else if (onIsland) {
      if (Math.abs(vx - ISLAND_CENTER.x) <= 22 && vz >= 685 && vz <= 825) {
        _c.setHex(0x475569);
      } else if (h < 1.25) {
        _c.setHex(0xdcc592);
      } else {
        _c.setHex(0x3a6432);
      }
    } else if (vz > 300 && vx < 145) {
      _c.setHex(h < -0.5 ? 0x7c6f52 : 0xdcc592);
    } else if (vx >= -365 && vx <= 530 && vz >= -285 && vz <= 300) {
      const inPark = vx < -140 && vx > -330 && vz > 45 && vz < 195;
      _c.setHex(inPark ? 0x3b6e35 : 0x5c6470);
    } else if (h > 14) {
      _c.setHex(0x57534e);
    } else {
      _c.setHex(0x3a6432);
    }
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // 2. Animated Ocean Surface (covers Southern Ocean + Eastern Strait around Auroria)
  const waterUniforms = { uTime: { value: 0 } };
  const waterGeo = new THREE.PlaneGeometry(3400, 2600, isMobile ? 42 : 54, isMobile ? 32 : 42);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0e5a7a,
    roughness: 0.14,
    metalness: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += sin(position.x * 0.05 + uTime * 1.4) * 0.16 + cos(position.z * 0.06 + uTime * 1.1) * 0.14;`
      );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(280, WATER_LEVEL, 260);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
  disposables.push(waterGeo, waterMat);

  // 3. Roads & Overpass Bridge
  const roadMaterials: THREE.MeshStandardMaterial[] = [];
  const cityRoadMat = new THREE.MeshStandardMaterial({
    map: tex.asphaltMap,
    roughnessMap: tex.asphaltRoughness,
    roughness: 0.84,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const hwyRoadMat = new THREE.MeshStandardMaterial({
    map: tex.highwayMap,
    roughnessMap: tex.asphaltRoughness,
    roughness: 0.8,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const auroriaMarbleRoadMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.32,
    metalness: 0.14,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const auroriaGoldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.18,
    emissive: 0x78350f,
    emissiveIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  roadMaterials.push(cityRoadMat, hwyRoadMat, auroriaMarbleRoadMat);
  disposables.push(cityRoadMat, hwyRoadMat, auroriaMarbleRoadMat, auroriaGoldTrimMat);

  const concreteMat = new THREE.MeshStandardMaterial({
    map: tex.sidewalkMap,
    roughness: 0.88,
    metalness: 0.05,
  });
  disposables.push(concreteMat);

  for (const seg of ROAD_SEGMENTS) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const cx = (seg.x1 + seg.x2) / 2;
    const cz = (seg.z1 + seg.z2) / 2;
    const isAuroriaRoad = seg.id.startsWith('aur_');

    const rGeo = new THREE.PlaneGeometry(seg.width, len);
    rGeo.rotateX(-Math.PI / 2);
    const uv = rGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, uv.getY(i) * (len / 24));
    }
    const baseMat = isAuroriaRoad ? auroriaMarbleRoadMat : seg.isHighway ? hwyRoadMat : cityRoadMat;
    const roadMesh = new THREE.Mesh(rGeo, baseMat);
    const baseH =
      isAuroriaRoad || seg.z1 < -280 || seg.z2 < -280 ? groundHeightAt(cx, cz) + 0.05 : 0.04;
    roadMesh.position.set(cx, baseH, cz);
    roadMesh.rotation.y = angle;
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);
    disposables.push(rGeo);

    if (isAuroriaRoad) {
      const curbGeo = new THREE.BoxGeometry(0.45, 0.18, len);
      [-seg.width * 0.5 - 0.15, 0, seg.width * 0.5 + 0.15].forEach((offsetX, cIdx) => {
        const trimMesh = new THREE.Mesh(curbGeo, auroriaGoldTrimMat);
        const worldOx = cx + Math.cos(angle) * offsetX;
        const worldOz = cz - Math.sin(angle) * offsetX;
        trimMesh.position.set(worldOx, cIdx === 1 ? baseH + 0.02 : baseH + 0.06, worldOz);
        trimMesh.rotation.y = angle;
        if (cIdx === 1) trimMesh.scale.set(0.45, 0.25, 1);
        scene.add(trimMesh);
      });
      disposables.push(curbGeo);
    }
  }

  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  disposables.push(bridgeMat);
  const deckGeo = new THREE.BoxGeometry(100, 0.7, 17);
  const deck = new THREE.Mesh(deckGeo, bridgeMat);
  deck.position.set(0, 5.15, -265);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const deckRoad = new THREE.Mesh(new THREE.PlaneGeometry(100, 15).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), hwyRoadMat);
  deckRoad.position.set(0, 5.53, -265);
  scene.add(deck, deckRoad);
  [-1, 1].forEach((side) => {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(50.6, 0.7, 17), bridgeMat);
    ramp.position.set(side * 75, 2.4, -265);
    ramp.rotation.z = side * -Math.atan2(5.5, 50);
    ramp.receiveShadow = true;
    scene.add(ramp);
    [-40, -18, 18, 40].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 5.2, 10), bridgeMat);
      pillar.position.set(px, 2.6, -265 + side * 6.5);
      pillar.castShadow = true;
      scene.add(pillar);
    });
  });

  // Shared Architectural Materials + Night Illumination
  const skyscraperGlassMat = new THREE.MeshStandardMaterial({
    map: tex.glassTowerMap,
    emissiveMap: tex.glassTowerEmissive,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.65,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: tex.brickMap,
    emissiveMap: tex.brickEmissive,
    emissive: new THREE.Color(0xffe4a0),
    emissiveIntensity: 0.08,
    roughness: 0.85,
    metalness: 0.05,
  });
  const nightWindowMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: new THREE.Color(0xfde68a),
    emissiveIntensity: 0.08,
    roughness: 0.2,
    metalness: 0.3,
  });
  const industrialMat = new THREE.MeshStandardMaterial({ map: tex.industrialMap, roughness: 0.65, metalness: 0.45 });
  const stuccoWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.68, metalness: 0.05 });
  const warmPlasterMat = new THREE.MeshStandardMaterial({ color: 0xe7d3b3, roughness: 0.75 });
  const roofDarkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
  const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.7 });
  const streetLampBulbsMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde047,
    emissiveIntensity: 0.1,
    roughness: 0.2,
  });
  disposables.push(
    skyscraperGlassMat,
    brickMat,
    nightWindowMat,
    industrialMat,
    stuccoWhiteMat,
    warmPlasterMat,
    roofDarkMat,
    roofTileMat,
    darkMetalMat,
    streetLampBulbsMat
  );

  const addBoxCollider = (x: number, z: number, w: number, d: number, h: number, minY = 0) => {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      maxY: h,
      minY,
    });
  };

  // 4. DISTRICT 1: DOWNTOWN SKYSCRAPERS & PLAZAS
  const blockCenters = [-80, 0, 80];
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const chunk = getChunk(bx, bz);
      if (bx === 0 && bz === 0) {
        const plaza = new THREE.Mesh(new THREE.BoxGeometry(58, 0.24, 58), concreteMat);
        plaza.position.set(0, 0.12, 0);
        plaza.receiveShadow = true;
        const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.9, 20), stuccoWhiteMat);
        fountainBase.position.set(0, 0.55, 0);
        const fountainPool = new THREE.Mesh(
          new THREE.CylinderGeometry(6.1, 6.1, 0.5, 20),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, metalness: 0.2 })
        );
        fountainPool.position.set(0, 0.85, 0);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 8, 8), darkMetalMat);
        spire.position.set(0, 4.5, 0);
        spire.castShadow = true;
        chunk.add(plaza, fountainBase, fountainPool, spire);
        addBoxCollider(0, 0, 14, 14, 9);
        continue;
      }

      if (bx === -80 && bz === -80) {
        const hospPlaza = new THREE.Mesh(new THREE.BoxGeometry(56, 0.22, 56), concreteMat);
        hospPlaza.position.set(-80, 0.11, -80);
        hospPlaza.receiveShadow = true;

        const hospBase = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 28), stuccoWhiteMat);
        hospBase.position.set(-82, 7, -82);
        hospBase.castShadow = true;
        hospBase.receiveShadow = true;

        const hospWins = new THREE.Mesh(new THREE.BoxGeometry(36.3, 8.5, 28.3), nightWindowMat);
        hospWins.position.set(-82, 7.2, -82);

        const hospWing = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 18), skyscraperGlassMat);
        hospWing.position.set(-88, 11, -86);
        hospWing.castShadow = true;

        const hospCanopy = new THREE.Mesh(
          new THREE.BoxGeometry(12, 1.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
        );
        hospCanopy.position.set(-67, 4.2, -70);

        const crossMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 1.6,
        });
        disposables.push(crossMat);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 0.6), crossMat);
        crossV.position.set(-64, 10, -76);
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 4.6), crossMat);
        crossH.position.set(-64, 10, -76);

        chunk.add(hospPlaza, hospBase, hospWins, hospWing, hospCanopy, crossV, crossH);
        addBoxCollider(-82, -82, 36, 28, 22);
        continue;
      }

      const offsets: Array<[number, number]> = [
        [-15, -15],
        [15, -15],
        [-15, 15],
        [15, 15],
      ];
      offsets.forEach(([ox, oz], idx) => {
        const tx = bx + ox;
        const tz = bz + oz;
        const w = 18 + rand() * 6;
        const d = 18 + rand() * 6;
        const h = 34 + rand() * 58;

        const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 5.5, d + 2.4), stuccoWhiteMat);
        podium.position.set(tx, 2.75, tz);
        podium.castShadow = true;
        podium.receiveShadow = true;

        const podiumLights = new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 2.2, d + 2.6), nightWindowMat);
        podiumLights.position.set(tx, 2.8, tz);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skyscraperGlassMat);
        tower.position.set(tx, 5.5 + h / 2, tz);
        tower.castShadow = true;
        tower.receiveShadow = true;

        const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 6, d * 0.72), darkMetalMat);
        crown.position.set(tx, 5.5 + h + 3, tz);
        crown.castShadow = true;

        chunk.add(podium, podiumLights, tower, crown);

        if (idx === 0 && h > 60) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 14, 8), darkMetalMat);
          antenna.position.set(tx, 5.5 + h + 13, tz);
          chunk.add(antenna);
        }

        addBoxCollider(tx, tz, w + 2.4, d + 2.4, h + 12);
      });
    }
  }

  // CityWorld Illuminated Supermarkets (accessible by glowing portals!)
  const marketSignMat = new THREE.MeshStandardMaterial({
    map: tex.supermarketSignMap,
    emissiveMap: tex.supermarketSignMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const marketBodyMat = new THREE.MeshStandardMaterial({ color: 0xecfdf5, roughness: 0.55 });
  const marketAwningMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    emissive: 0x10b981,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  disposables.push(marketSignMat, marketBodyMat, marketAwningMat);

  INTERIOR_PORTALS.filter((p) => p.kind === 'supermarket').forEach((p) => {
    const mx = p.exteriorPos.x;
    const mz = p.exteriorPos.z - 6.5;
    const my = groundHeightAt(mx, mz);
    const chunk = getChunk(mx, mz);

    const store = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 10), marketBodyMat);
    store.position.set(mx, my + 2.75, mz);
    store.castShadow = true;
    store.receiveShadow = true;

    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(11.6, 3.2, 0.25), nightWindowMat);
    glassFront.position.set(mx, my + 1.8, mz + 5.05);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.85, 2.2), marketAwningMat);
    awning.position.set(mx, my + 4.3, mz + 5.6);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(11, 2.4, 0.35), marketSignMat);
    signBoard.position.set(mx, my + 6.4, mz + 5.05);

    chunk.add(store, glassFront, awning, signBoard);
    addBoxCollider(mx, mz, 14, 10, my + 7);
  });

  // CW Tactical Armory, Luxe Couture & Skins, Apex Auto Showroom, and Premier Motors Dealership
  INTERIOR_PORTALS.filter(
    (p) => p.kind === 'gunshop' || p.kind === 'skins' || p.kind === 'dealership' || p.kind === 'garage'
  ).forEach((p) => {
    const isDealer = p.kind === 'dealership' || p.kind === 'garage';
    const isGarage = p.kind === 'garage';
    const isSkins = p.kind === 'skins';
    const width = p.kind === 'dealership' ? 22 : isGarage ? 16 : 15;
    const depth = isGarage ? 9.5 : 11;
    // garage faces south (+Z) onto z=40 avenue; z=120 stores face north (-Z)
    const dirZ = isGarage ? 1 : -1;
    const sx = p.exteriorPos.x;
    const sz = p.exteriorPos.z - dirZ * (depth / 2 + 2.2);
    const sy = groundHeightAt(sx, sz);
    const chunk = getChunk(sx, sz);

    const signTex = isGarage
      ? tex.apexDealerSignMap
      : isDealer
        ? tex.dealershipSignMap
        : isSkins
          ? tex.skinShopSignMap
          : tex.gunShopSignMap;
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.05,
      roughness: 0.25,
    });
    const wallTone = p.kind === 'dealership' ? 0x0f172a : isGarage ? 0x1c1917 : isSkins ? 0x3b0764 : 0x27272a;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: wallTone,
      roughness: isDealer ? 0.3 : 0.55,
      metalness: isDealer ? 0.5 : 0.2,
    });
    const awnMat = new THREE.MeshStandardMaterial({
      color: p.accentColor,
      emissive: p.accentColor,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });
    disposables.push(signMat, bodyMat, awnMat);

    const store = new THREE.Mesh(new THREE.BoxGeometry(width, 6.4, depth), bodyMat);
    store.position.set(sx, sy + 3.2, sz);
    store.castShadow = true;
    store.receiveShadow = true;

    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(width - 2.0, 3.9, 0.28), nightWindowMat);
    glassFront.position.set(sx, sy + 2.1, sz + dirZ * (depth / 2 + 0.06));

    const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.85, 2.5), awnMat);
    awning.position.set(sx, sy + 4.75, sz + dirZ * (depth / 2 + 0.8));

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(width - 1.6, 2.8, 0.4), signMat);
    signBoard.position.set(sx, sy + 7.2, sz + dirZ * (depth / 2 + 0.06));
    if (dirZ < 0) signBoard.rotation.y = Math.PI;

    chunk.add(store, glassFront, awning, signBoard);
    addBoxCollider(sx, sz, width, depth, sy + 8.0);

    // Tall Dealership Pylon Totem + Outdoor Display Cars on Illuminated Pads
    if (isDealer) {
      const pylonPole = new THREE.Mesh(new THREE.BoxGeometry(1.1, 13.5, 1.1), darkMetalMat);
      const pylonX = sx + width / 2 + 1.6;
      const pylonZ = sz + dirZ * (depth / 2 - 1.5);
      pylonPole.position.set(pylonX, sy + 6.75, pylonZ);
      const pylonSign = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.4, 0.55), signMat);
      pylonSign.position.set(pylonX, sy + 12.6, pylonZ);
      chunk.add(pylonPole, pylonSign);

      const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.6 });
      const carPaintA = new THREE.MeshStandardMaterial({
        color: isGarage ? 0xf59e0b : 0x38bdf8,
        metalness: 0.85,
        roughness: 0.16,
      });
      const carPaintB = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.82, roughness: 0.18 });
      disposables.push(padMat, carPaintA, carPaintB);

      const displayOffsets = p.kind === 'dealership' ? [-6.8, 6.8] : [5.2];
      displayOffsets.forEach((dxOff, cIdx) => {
        const cx = sx + dxOff;
        const cz = sz + dirZ * (depth / 2 + 2.2);
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.28, 20), padMat);
        plinth.position.set(cx, sy + 0.14, cz);
        const ringTrim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.08, 6, 24), awnMat);
        ringTrim.rotation.x = Math.PI / 2;
        ringTrim.position.set(cx, sy + 0.28, cz);

        const showCar = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.58, 1.65), cIdx === 0 ? carPaintA : carPaintB);
        body.position.set(0, 0.48, 0);
        body.castShadow = true;
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.46, 1.35), nightWindowMat);
        cabin.position.set(-0.1, 0.92, 0);
        showCar.add(body, cabin);
        showCar.position.set(cx, sy + 0.25, cz);
        showCar.rotation.y = dirZ > 0 ? 0.35 : -0.35;
        chunk.add(plinth, ringTrim, showCar);
      });
    }
  });

  // Purchasable Live-In Houses (4 Progressive Sizes: Cottage -> 2-Story -> Beach Villa -> Royal Mansion)
  const houseSignMat = new THREE.MeshStandardMaterial({
    map: tex.houseSignMap,
    emissiveMap: tex.houseSignMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.75,
    roughness: 0.35,
  });
  const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65 });
  disposables.push(houseSignMat, doorWoodMat);

  const houseForSaleSigns = new Map<string, THREE.Group>();

  INTERIOR_PORTALS.filter((p) => p.kind === 'house').forEach((p) => {
    const tier = p.houseSizeTier ?? 1;
    const width = tier === 1 ? 11 : tier === 2 ? 15 : tier === 3 ? 20 : 24;
    const depth = tier === 1 ? 9 : tier === 2 ? 11 : tier === 3 ? 13 : 12;
    const h1 = tier === 1 ? 4.4 : tier === 2 ? 4.8 : tier === 3 ? 5.2 : 6.0;
    const hx = p.exteriorPos.x;
    const hz = p.exteriorPos.z - (depth / 2 + 5.5);
    const hy = groundHeightAt(hx, hz);
    const chunk = getChunk(hx, hz);

    const wallMat = new THREE.MeshStandardMaterial({
      color: tier === 1 ? 0xf5deb3 : tier === 2 ? 0xe2e8f0 : tier === 3 ? 0xf8fafc : 0xfef3c7,
      roughness: 0.65,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: p.accentColor,
      emissive: p.accentColor,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    disposables.push(wallMat, trimMat);

    // Main Ground Story
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(width, h1, depth), wallMat);
    mainBody.position.set(hx, hy + h1 / 2, hz);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;

    const winBand = new THREE.Mesh(new THREE.BoxGeometry(width + 0.25, 1.45, depth + 0.25), nightWindowMat);
    winBand.position.set(hx, hy + h1 * 0.56, hz);

    // Front Porch & Door facing South (+Z) toward portal ring
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.28), doorWoodMat);
    door.position.set(hx, hy + 1.35, hz + depth / 2 + 0.08);
    const porchStep = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 0.26, 2.6), concreteMat);
    porchStep.position.set(hx, hy + 0.13, hz + depth / 2 + 1.3);

    // For Sale Yard Sign next to doorway (hidden automatically once player buys the house)
    const signGroup = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), darkMetalMat);
    post.position.set(hx + width * 0.32, hy + 1.2, hz + depth / 2 + 1.6);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 0.16), houseSignMat);
    board.position.set(hx + width * 0.32, hy + 2.1, hz + depth / 2 + 1.6);
    signGroup.add(post, board);
    houseForSaleSigns.set(p.id, signGroup);

    chunk.add(mainBody, winBand, door, porchStep, signGroup);

    if (tier === 1) {
      // Pitched cozy cottage roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, 3.2, 4), roofTileMat);
      roof.position.set(hx, hy + h1 + 1.55, hz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      chunk.add(roof);
    } else {
      // Second Story (Medium, Villa, Royal Mansion)
      const upperW = width * 0.72;
      const upperD = depth * 0.76;
      const upperH = tier === 4 ? 4.8 : 3.9;
      const overhang = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.45, depth + 1.2), roofDarkMat);
      overhang.position.set(hx, hy + h1 + 0.2, hz);

      const upperBody = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), wallMat);
      upperBody.position.set(hx, hy + h1 + 0.4 + upperH / 2, hz);
      upperBody.castShadow = true;

      const upperWins = new THREE.Mesh(
        new THREE.BoxGeometry(upperW + 0.25, 1.35, upperD + 0.25),
        nightWindowMat
      );
      upperWins.position.set(hx, hy + h1 + 0.4 + upperH * 0.54, hz);

      const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(upperW + 1.0, 0.5, upperD + 1.0), roofDarkMat);
      upperRoof.position.set(hx, hy + h1 + 0.4 + upperH + 0.25, hz);
      const roofGlow = new THREE.Mesh(new THREE.BoxGeometry(upperW + 0.5, 0.2, upperD + 0.5), trimMat);
      roofGlow.position.set(hx, hy + h1 + 0.4 + upperH + 0.55, hz);

      chunk.add(overhang, upperBody, upperWins, upperRoof, roofGlow);
    }

    if (tier >= 3) {
      // Columns & Patio Deck / Pool for Beach Villa & Royal Mansion
      [-width * 0.26, width * 0.26].forEach((cxOff) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, h1, 10), stuccoWhiteMat);
        col.position.set(hx + cxOff, hy + h1 / 2, hz + depth / 2 + 1.1);
        chunk.add(col);
      });
      const sidePool = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 0.25, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.1, metalness: 0.18 })
      );
      sidePool.position.set(hx - width * 0.32, hy + 0.13, hz + depth / 2 + 3.2);
      chunk.add(sidePool);
    }

    addBoxCollider(hx, hz, width, depth, hy + 12);
  });

  // Billboards
  const billboardLocations = [
    { x: -30, z: -130, rot: 0, texIdx: 0 },
    { x: 132, z: -30, rot: Math.PI / 2, texIdx: 1 },
    { x: -130, z: 278, rot: 0, texIdx: 2 },
  ];
  billboardLocations.forEach((b) => {
    const chunk = getChunk(b.x, b.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 11, 8), darkMetalMat);
    pole.position.set(b.x, 5.5, b.z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.6), darkMetalMat);
    frame.position.set(b.x, 12, b.z);
    frame.rotation.y = b.rot;
    const faceMat = new THREE.MeshStandardMaterial({
      map: tex.billboardTextures[b.texIdx],
      emissiveMap: tex.billboardTextures[b.texIdx],
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    disposables.push(faceMat);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 6.2), faceMat);
    face.position.set(b.x + Math.sin(b.rot) * 0.35, 12, b.z + Math.cos(b.rot) * 0.35);
    face.rotation.y = b.rot;
    chunk.add(pole, frame, face);
    addBoxCollider(b.x, b.z, 1.5, 1.5, 12);
  });

  // 5. DISTRICT 2: RICH DISTRICT (Villas with glowing night windows!)
  const villaCoords: Array<[number, number]> = [
    [-190, -160],
    [-290, -160],
    [-190, -230],
    [-290, -230],
    [-190, -85],
    [-290, -85],
  ];
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.1, metalness: 0.15 });
  disposables.push(poolMat);
  villaCoords.forEach(([vx, vz]) => {
    const chunk = getChunk(vx, vz);
    const baseY = groundHeightAt(vx, vz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 5.2, 15), stuccoWhiteMat);
    body.position.set(vx, baseY + 2.6, vz);
    body.castShadow = true;
    const winBelt = new THREE.Mesh(new THREE.BoxGeometry(20.3, 1.8, 15.3), nightWindowMat);
    winBelt.position.set(vx, baseY + 2.9, vz);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(13, 3.8, 11), warmPlasterMat);
    upper.position.set(vx - 2, baseY + 7.1, vz);
    upper.castShadow = true;
    const upperWin = new THREE.Mesh(new THREE.BoxGeometry(13.25, 1.4, 11.25), nightWindowMat);
    upperWin.position.set(vx - 2, baseY + 7.1, vz);
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(22, 0.55, 17), roofDarkMat);
    overhang.position.set(vx, baseY + 5.3, vz);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 5.5), poolMat);
    pool.position.set(vx + 6, baseY + 0.15, vz + 12);
    chunk.add(body, winBelt, upper, upperWin, overhang, pool);
    addBoxCollider(vx, vz, 20, 15, baseY + 10);
  });

  // 6. DISTRICT 3: RESIDENTIAL DISTRICT (Houses with glowing windows at night)
  const houseCoords: Array<[number, number]> = [
    [-185, 0],
    [-290, 0],
    [-185, 80],
    [-290, 80],
    [-185, 165],
    [-290, 165],
    [-185, 245],
    [-290, 245],
  ];
  houseCoords.forEach(([hx, hz], idx) => {
    const chunk = getChunk(hx, hz);
    const bodyMat = idx % 2 === 0 ? warmPlasterMat : brickMat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4.6, 10), bodyMat);
    body.position.set(hx, 2.3, hz);
    body.castShadow = true;
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(12.22, 1.45, 10.22), nightWindowMat);
    winBand.position.set(hx, 2.6, hz);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.2, 3.4, 4), roofTileMat);
    roof.position.set(hx, 6.2, hz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    chunk.add(body, winBand, roof);
    addBoxCollider(hx, hz, 12, 10, 9);
  });

  // 7. DISTRICT 4: POOR DISTRICT (Brickyard Tenements with brickEmissive night windows!)
  for (const px of [-80, 0, 80]) {
    for (const pz of [165, 250]) {
      const chunk = getChunk(px, pz);
      [-14, 14].forEach((ox) => {
        const bx = px + ox;
        const h = 10 + rand() * 8;
        const b = new THREE.Mesh(new THREE.BoxGeometry(18, h, 16), brickMat);
        b.position.set(bx, h / 2, pz);
        b.castShadow = true;
        b.receiveShadow = true;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.7, 16.6), roofDarkMat);
        trim.position.set(bx, h + 0.35, pz);
        chunk.add(b, trim);
        addBoxCollider(bx, pz, 18, 16, h + 1);
      });
    }
  }

  // 8. DISTRICT 5: INDUSTRIAL DISTRICT (Factories with glowing clerestory strip at night)
  const factorySpots: Array<[number, number]> = [
    [185, -80],
    [295, -80],
    [185, 0],
    [295, 0],
    [185, 80],
    [295, 80],
  ];
  factorySpots.forEach(([fx, fz], i) => {
    const chunk = getChunk(fx, fz);
    const warehouse = new THREE.Mesh(new THREE.BoxGeometry(34, 11, 24), industrialMat);
    warehouse.position.set(fx, 5.5, fz);
    warehouse.castShadow = true;
    warehouse.receiveShadow = true;
    const clerestory = new THREE.Mesh(new THREE.BoxGeometry(34.3, 1.4, 24.3), nightWindowMat);
    clerestory.position.set(fx, 8.6, fz);
    chunk.add(warehouse, clerestory);
    addBoxCollider(fx, fz, 34, 24, 12);

    if (i % 2 === 0) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 24, 12), brickMat);
      stack.position.set(fx + 12, 12, fz - 9);
      stack.castShadow = true;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 8, 16), stuccoWhiteMat);
      tank.position.set(fx - 12, 4, fz + 16);
      tank.castShadow = true;
      chunk.add(stack, tank);
      addBoxCollider(fx - 12, fz + 16, 9, 9, 8);
    }
  });

  // 9. DISTRICT 6: PORT
  const portChunk = getChunk(260, 260);
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(240, 1.4, 210), concreteMat);
  pierDeck.position.set(265, -0.3, 250);
  pierDeck.receiveShadow = true;
  portChunk.add(pierDeck);

  const containerMat = new THREE.MeshStandardMaterial({ map: tex.containerMap, roughness: 0.6, metalness: 0.35 });
  disposables.push(containerMat);
  const contColors = [0xdc2626, 0x2563eb, 0xd97706, 0x059669, 0x7c3aed];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = 175 + col * 24;
      const cz = 185 + row * 28;
      const stackH = 1 + Math.floor(rand() * 3);
      for (let level = 0; level < stackH; level++) {
        const cm = new THREE.MeshStandardMaterial({
          map: tex.containerMap,
          color: contColors[(row + col + level) % contColors.length],
          roughness: 0.58,
          metalness: 0.35,
        });
        disposables.push(cm);
        const box = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 4.2), cm);
        box.position.set(cx, 0.4 + 1.6 + level * 3.2, cz);
        box.castShadow = true;
        portChunk.add(box);
      }
      addBoxCollider(cx, cz, 12, 4.2, 11);
    }
  }

  const craneMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45, metalness: 0.6 });
  disposables.push(craneMat);
  [210, 290].forEach((crX) => {
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 28, 1.5), craneMat);
    leg1.position.set(crX - 4, 14, 340);
    const leg2 = leg1.clone();
    leg2.position.x = crX + 4;
    const boom = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 42), craneMat);
    boom.position.set(crX, 27, 352);
    boom.castShadow = true;
    portChunk.add(leg1, leg2, boom);
    addBoxCollider(crX, 340, 10, 3, 28);
  });

  const shipHullMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.65, metalness: 0.3 });
  disposables.push(shipHullMat);
  const shipGroup = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(68, 9, 18), shipHullMat);
  hull.position.set(0, 2.5, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), stuccoWhiteMat);
  bridge.position.set(-22, 11, 0);
  shipGroup.add(hull, bridge);
  shipGroup.position.set(270, WATER_LEVEL, 385);
  portChunk.add(shipGroup);

  // 10. DISTRICT 7: BEACH & BOARDWALK
  const beachChunk = getChunk(-120, 330);
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(460, 0.35, 7),
    new THREE.MeshStandardMaterial({ color: 0x926239, roughness: 0.85 })
  );
  boardwalk.position.set(-100, 0.18, 306);
  boardwalk.receiveShadow = true;
  beachChunk.add(boardwalk);

  for (let ux = -280; ux <= 80; ux += 42) {
    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), stuccoWhiteMat);
    uPole.position.set(ux, 1.1, 328);
    const uTop = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: ux % 84 === 0 ? 0xef4444 : 0x0ea5e9, roughness: 0.7 })
    );
    uTop.position.set(ux, 2.5, 328);
    uTop.castShadow = true;
    beachChunk.add(uPole, uTop);
  }

  // 11. DISTRICT 8: AIRPORT
  const airportChunk = getChunk(320, -280);
  const runwayMat = new THREE.MeshStandardMaterial({ map: tex.runwayMap, roughness: 0.78 });
  disposables.push(runwayMat);
  const runwayMain = new THREE.Mesh(new THREE.PlaneGeometry(44, 240), runwayMat);
  runwayMain.rotation.x = -Math.PI / 2;
  runwayMain.rotation.z = Math.PI / 2;
  runwayMain.position.set(355, 0.05, -310);
  runwayMain.receiveShadow = true;

  const terminal = new THREE.Mesh(new THREE.BoxGeometry(74, 12, 26), skyscraperGlassMat);
  terminal.position.set(310, 6, -210);
  terminal.castShadow = true;
  addBoxCollider(310, -210, 74, 26, 12);

  const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 28, 12), stuccoWhiteMat);
  towerShaft.position.set(250, 14, -225);
  towerShaft.castShadow = true;
  const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 4.5, 5, 12), skyscraperGlassMat);
  towerCab.position.set(250, 29, -225);
  const radarDish = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 0.6), darkMetalMat);
  radarDish.position.set(250, 33, -225);
  addBoxCollider(250, -225, 9, 9, 32);

  airportChunk.add(runwayMain, terminal, towerShaft, towerCab, radarDish);

  [
    { x: 345, z: -255, rot: -0.35 },
    { x: 405, z: -255, rot: 0.15 },
  ].forEach((ap) => {
    const plane = new THREE.Group();
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 26, 14), stuccoWhiteMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 3.2, 0);
    fuselage.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 14), stuccoWhiteMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 3.2, 15.5);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(28, 0.45, 5.5), stuccoWhiteMat);
    wings.position.set(0, 2.8, 1);
    wings.castShadow = true;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6, 4.5), craneMat);
    tail.position.set(0, 6.2, -11);
    plane.add(fuselage, nose, wings, tail);
    plane.position.set(ap.x, 0, ap.z);
    plane.rotation.y = ap.rot;
    airportChunk.add(plane);
    addBoxCollider(ap.x, ap.z, 12, 12, 8);
  });

  // 12. DISTRICT 9: COUNTRYSIDE BARNS & SILO
  const countryChunk = getChunk(-140, -390);
  const barn = new THREE.Mesh(new THREE.BoxGeometry(16, 7.5, 22), craneMat);
  const barnY = groundHeightAt(-110, -400);
  barn.position.set(-110, barnY + 3.75, -400);
  barn.castShadow = true;
  const barnRoof = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 22, 6, 1, false, 0, Math.PI), roofDarkMat);
  barnRoof.rotation.z = Math.PI / 2;
  barnRoof.rotation.y = Math.PI / 2;
  barnRoof.position.set(-110, barnY + 7.5, -400);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 15, 14), stuccoWhiteMat);
  silo.position.set(-96, barnY + 7.5, -404);
  silo.castShadow = true;
  countryChunk.add(barn, barnRoof, silo);
  addBoxCollider(-110, -400, 16, 22, barnY + 12);
  addBoxCollider(-96, -404, 6.4, 6.4, barnY + 15);

  // 12B. TROPICAL ISLAND (Reachable by Airplane + Return Runway!)
  const islandGroup = new THREE.Group();
  const islRunway = new THREE.Mesh(new THREE.PlaneGeometry(22, 134), runwayMat);
  islRunway.rotation.x = -Math.PI / 2;
  islRunway.position.set(ISLAND_CENTER.x, 0.89, 756);
  islRunway.receiveShadow = true;
  islandGroup.add(islRunway);

  // Island landing lights & coastal wooden pier
  const beaconCyanMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.2,
  });
  const beaconRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.0,
  });
  disposables.push(beaconCyanMat, beaconRedMat);
  const dummyStatic = new THREE.Object3D();
  const beaconGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.65, 6);
  const beaconInst = new THREE.InstancedMesh(beaconGeo, beaconCyanMat, 12);
  let beaconIdx = 0;
  for (let bz = 696; bz <= 816; bz += 24) {
    [-12.5, 12.5].forEach((bx) => {
      dummyStatic.position.set(ISLAND_CENTER.x + bx, 1.15, bz);
      dummyStatic.rotation.set(0, 0, 0);
      dummyStatic.scale.setScalar(1);
      dummyStatic.updateMatrix();
      beaconInst.setMatrixAt(beaconIdx++, dummyStatic.matrix);
    });
  }
  beaconInst.instanceMatrix.needsUpdate = true;
  beaconInst.computeBoundingSphere();
  islandGroup.add(beaconInst);
  disposables.push(beaconGeo);

  // Island Pier & Beach Tiki Hut
  const pierWoodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
  disposables.push(pierWoodMat, thatchMat);
  const islPier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 24), pierWoodMat);
  islPier.position.set(ISLAND_CENTER.x, 0.25, 668);
  const hutFloor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 8), pierWoodMat);
  const hutY = groundHeightAt(ISLAND_CENTER.x - 42, 768);
  hutFloor.position.set(ISLAND_CENTER.x - 42, hutY + 0.2, 768);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.6, 4), thatchMat);
  hutRoof.position.set(ISLAND_CENTER.x - 42, hutY + 5.2, 768);
  hutRoof.rotation.y = Math.PI / 4;
  islandGroup.add(islPier, hutFloor, hutRoof);
  [
    [-3.6, -3.2],
    [3.6, -3.2],
    [-3.6, 3.2],
    [3.6, 3.2],
  ].forEach(([ox, oz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 3.8, 6), pierWoodMat);
    post.position.set(ISLAND_CENTER.x - 42 + ox, hutY + 2.1, 768 + oz);
    islandGroup.add(post);
  });
  scene.add(islandGroup);

  // 12C. WORLD BORDER BUOYS & PERIMETER POSTS (Batched into 3 InstancedMeshes -> 3 draw calls instead of 212!)
  const borderGroup = new THREE.Group();
  const buoyGeo = new THREE.CylinderGeometry(0.55, 0.85, 2.2, 8);
  const capGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const postGeo = new THREE.BoxGeometry(1.1, 4.2, 1.1);
  disposables.push(buoyGeo, capGeo, postGeo);

  const buoyPositions: Array<[number, number, number]> = [];
  const postPositions: Array<[number, number, number]> = [];
  const capPositions: Array<[number, number, number]> = [];

  for (let bx = -MAINLAND_BORDER; bx <= MAINLAND_BORDER; bx += 38) {
    buoyPositions.push([bx, WATER_LEVEL + 0.65, MAINLAND_BORDER + 2]);
    capPositions.push([bx, WATER_LEVEL + 1.95, MAINLAND_BORDER + 2]);

    const nh = groundHeightAt(bx, -MAINLAND_BORDER - 2);
    postPositions.push([bx, nh + 2.1, -MAINLAND_BORDER - 2]);
    capPositions.push([bx, nh + 4.4, -MAINLAND_BORDER - 2]);
  }
  for (let bz = -MAINLAND_BORDER; bz <= MAINLAND_BORDER; bz += 42) {
    [-MAINLAND_BORDER - 2, MAINLAND_BORDER + 2].forEach((bx) => {
      const h = groundHeightAt(bx, bz);
      if (h < WATER_LEVEL) {
        buoyPositions.push([bx, WATER_LEVEL + 0.65, bz]);
        capPositions.push([bx, WATER_LEVEL + 1.95, bz]);
      } else {
        postPositions.push([bx, h + 2.1, bz]);
        capPositions.push([bx, h + 4.4, bz]);
      }
    });
  }

  const buoyInst = new THREE.InstancedMesh(buoyGeo, stuccoWhiteMat, buoyPositions.length);
  const postInst = new THREE.InstancedMesh(postGeo, darkMetalMat, postPositions.length);
  const capInst = new THREE.InstancedMesh(capGeo, beaconRedMat, capPositions.length);

  buoyPositions.forEach(([x, y, z], idx) => {
    dummyStatic.position.set(x, y, z);
    dummyStatic.updateMatrix();
    buoyInst.setMatrixAt(idx, dummyStatic.matrix);
  });
  postPositions.forEach(([x, y, z], idx) => {
    dummyStatic.position.set(x, y, z);
    dummyStatic.updateMatrix();
    postInst.setMatrixAt(idx, dummyStatic.matrix);
  });
  capPositions.forEach(([x, y, z], idx) => {
    dummyStatic.position.set(x, y, z);
    dummyStatic.updateMatrix();
    capInst.setMatrixAt(idx, dummyStatic.matrix);
  });
  buoyInst.instanceMatrix.needsUpdate = true;
  postInst.instanceMatrix.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  buoyInst.computeBoundingSphere();
  postInst.computeBoundingSphere();
  capInst.computeBoundingSphere();
  borderGroup.add(buoyInst, postInst, capInst);
  scene.add(borderGroup);

  // 12D. AURORIA ROYAL COUNTRY (Second Wealthy Country across the Eastern Sea: Gold Mansions, Clean Plazas & Golden Runway)
  const auroriaGroup = new THREE.Group();
  const aurGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.94,
    roughness: 0.16,
    emissive: 0x78350f,
    emissiveIntensity: 0.14,
  });
  const aurRoseGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.9,
    roughness: 0.2,
  });
  const aurMarbleMat = new THREE.MeshStandardMaterial({
    color: 0xfcfbf7,
    roughness: 0.34,
    metalness: 0.1,
  });
  const aurGoldBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 2.3,
  });
  disposables.push(aurGoldMat, aurRoseGoldMat, aurMarbleMat, aurGoldBeaconMat);

  // Clean Marble Sea Wall & Golden Promenade Deck around Auroria Island
  const aurBaseY = 0.65;
  const aurRunway = new THREE.Mesh(new THREE.PlaneGeometry(26, 210), runwayMat);
  aurRunway.rotation.x = -Math.PI / 2;
  aurRunway.position.set(795, aurBaseY + 0.06, -120);
  aurRunway.receiveShadow = true;
  auroriaGroup.add(aurRunway);

  // Runway 24K Gold Runway Edge Strips & Beacons
  [-13.4, 13.4].forEach((rxOff) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 212), aurGoldMat);
    strip.position.set(795 + rxOff, aurBaseY + 0.08, -120);
    auroriaGroup.add(strip);
  });
  const aurBeaconInst = new THREE.InstancedMesh(beaconGeo, aurGoldBeaconMat, 16);
  let aurBIdx = 0;
  for (let bz = -216; bz <= -24; bz += 27.4) {
    [-14.4, 14.4].forEach((bxOff) => {
      if (aurBIdx >= 16) return;
      dummyStatic.position.set(795 + bxOff, aurBaseY + 0.34, bz);
      dummyStatic.rotation.set(0, 0, 0);
      dummyStatic.scale.setScalar(1);
      dummyStatic.updateMatrix();
      aurBeaconInst.setMatrixAt(aurBIdx++, dummyStatic.matrix);
    });
  }
  aurBeaconInst.instanceMatrix.needsUpdate = true;
  aurBeaconInst.computeBoundingSphere();
  auroriaGroup.add(aurBeaconInst);

  // Auroria VIP Royal Jet Terminal Pavilion (north-west corner of airfield)
  const termBase = new THREE.Mesh(new THREE.BoxGeometry(26, 9.5, 16), aurMarbleMat);
  termBase.position.set(778, aurBaseY + 4.75, -266);
  termBase.castShadow = true;
  termBase.receiveShadow = true;
  const termGlass = new THREE.Mesh(new THREE.BoxGeometry(26.3, 4.8, 16.3), nightWindowMat);
  termGlass.position.set(778, aurBaseY + 5.0, -266);
  const termRoof = new THREE.Mesh(new THREE.BoxGeometry(29, 0.9, 19), aurGoldMat);
  termRoof.position.set(778, aurBaseY + 9.9, -266);
  const termDome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), aurGoldMat);
  termDome.position.set(778, aurBaseY + 10.3, -266);
  auroriaGroup.add(termBase, termGlass, termRoof, termDome);
  addBoxCollider(778, -266, 26, 16, aurBaseY + 14);

  // Grand Central Triumph Arch & Emerald Fountain Plaza at (952, -180)
  const plazaSlab = new THREE.Mesh(new THREE.BoxGeometry(58, 0.3, 58), aurMarbleMat);
  plazaSlab.position.set(952, aurBaseY + 0.15, -180);
  plazaSlab.receiveShadow = true;
  const fRingOuter = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 11.2, 0.95, 24), aurGoldMat);
  fRingOuter.position.set(952, aurBaseY + 0.62, -180);
  const fWaterPool = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.55, 24), poolMat);
  fWaterPool.position.set(952, aurBaseY + 0.95, -180);
  const fPillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.8, 11.5, 12), aurMarbleMat);
  fPillar.position.set(952, aurBaseY + 6.0, -180);
  fPillar.castShadow = true;
  const fCrownOrb = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), aurGoldMat);
  fCrownOrb.position.set(952, aurBaseY + 13.2, -180);
  auroriaGroup.add(plazaSlab, fRingOuter, fWaterPool, fPillar, fCrownOrb);
  addBoxCollider(952, -180, 18, 18, aurBaseY + 15);

  // 4 Golden Corner Triumph Pillars around Fountain Plaza
  [
    [-21, -21],
    [21, -21],
    [-21, 21],
    [21, 21],
  ].forEach(([ox, oz]) => {
    const obeliskBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 2.8), aurMarbleMat);
    obeliskBase.position.set(952 + ox, aurBaseY + 0.75, -180 + oz);
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.95, 7.2, 6), aurGoldMat);
    obelisk.position.set(952 + ox, aurBaseY + 4.8, -180 + oz);
    obelisk.castShadow = true;
    auroriaGroup.add(obeliskBase, obelisk);
    addBoxCollider(952 + ox, -180 + oz, 2.8, 2.8, aurBaseY + 9);
  });

  // Auroria Country Golden Archway Gate flanking Main Royal Avenue at x=856, z=-120
  [-9.8, 9.8].forEach((gzOff) => {
    const gCol = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 11.5, 12), aurMarbleMat);
    gCol.position.set(856, aurBaseY + 5.75, -120 + gzOff);
    gCol.castShadow = true;
    const gCap = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.1, 1.4, 12), aurGoldMat);
    gCap.position.set(856, aurBaseY + 11.8, -120 + gzOff);
    auroriaGroup.add(gCol, gCap);
    addBoxCollider(856, -120 + gzOff, 2.5, 2.5, aurBaseY + 13);
  });
  const archSpan = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 22), aurGoldMat);
  archSpan.position.set(856, aurBaseY + 12.2, -120);
  archSpan.castShadow = true;
  const archCrest = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), aurGoldBeaconMat);
  archCrest.position.set(856, aurBaseY + 14.3, -120);
  auroriaGroup.add(archSpan, archCrest);

  // Crown embellishment on the owned Royal Auroria Palace (house_auroria_palace at 952, -262.5)
  const palaceDome = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    aurGoldMat
  );
  palaceDome.position.set(952, aurBaseY + 12.2, -262.5);
  const palaceLawn = new THREE.Mesh(new THREE.BoxGeometry(40, 0.24, 24), aurMarbleMat);
  palaceLawn.position.set(952, aurBaseY + 0.12, -262.5);
  auroriaGroup.add(palaceDome, palaceLawn);

  // 5 Grand Luxury Gold & White Marble Mansions across Auroria's clean billionaire estates
  const richVillas: Array<{ x: number; z: number; w: number; d: number; hasPool: boolean }> = [
    { x: 1072, z: -278, w: 28, d: 18, hasPool: true },
    { x: 1072, z: -180, w: 30, d: 20, hasPool: true },
    { x: 952, z: -60, w: 28, d: 18, hasPool: true },
    { x: 1072, z: -60, w: 30, d: 20, hasPool: true },
    { x: 952, z: 42, w: 26, d: 16, hasPool: false },
    { x: 1072, z: 42, w: 26, d: 16, hasPool: false },
  ];
  richVillas.forEach((rv, rIdx) => {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(rv.w + 14, 0.24, rv.d + 14), aurMarbleMat);
    apron.position.set(rv.x, aurBaseY + 0.12, rv.z);
    apron.receiveShadow = true;

    const wing1 = new THREE.Mesh(new THREE.BoxGeometry(rv.w, 6.2, rv.d), aurMarbleMat);
    wing1.position.set(rv.x, aurBaseY + 3.1, rv.z);
    wing1.castShadow = true;
    wing1.receiveShadow = true;

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(rv.w + 0.35, 2.2, rv.d + 0.35), nightWindowMat);
    win1.position.set(rv.x, aurBaseY + 3.4, rv.z);

    const goldCornice = new THREE.Mesh(new THREE.BoxGeometry(rv.w + 1.8, 0.75, rv.d + 1.8), aurGoldMat);
    goldCornice.position.set(rv.x, aurBaseY + 6.45, rv.z);

    const wing2 = new THREE.Mesh(new THREE.BoxGeometry(rv.w * 0.68, 5.0, rv.d * 0.72), aurMarbleMat);
    wing2.position.set(rv.x - (rIdx % 2 === 0 ? 1.5 : -1.5), aurBaseY + 9.2, rv.z);
    wing2.castShadow = true;

    const win2 = new THREE.Mesh(new THREE.BoxGeometry(rv.w * 0.68 + 0.3, 1.8, rv.d * 0.72 + 0.3), nightWindowMat);
    win2.position.set(wing2.position.x, aurBaseY + 9.4, rv.z);

    const topRoofGold = new THREE.Mesh(new THREE.BoxGeometry(rv.w * 0.74, 0.6, rv.d * 0.78), aurGoldMat);
    topRoofGold.position.set(wing2.position.x, aurBaseY + 12.0, rv.z);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      aurGoldMat
    );
    dome.position.set(wing2.position.x, aurBaseY + 12.25, rv.z);

    auroriaGroup.add(apron, wing1, win1, goldCornice, wing2, win2, topRoofGold, dome);

    // twin gold entry columns on front veranda
    [-rv.w * 0.24, rv.w * 0.24].forEach((cxOff) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 6.2, 10), aurGoldMat);
      col.position.set(rv.x + cxOff, aurBaseY + 3.1, rv.z + rv.d * 0.5 + 0.8);
      auroriaGroup.add(col);
    });

    if (rv.hasPool) {
      const poolBorder = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.34, 7.6), aurGoldMat);
      poolBorder.position.set(rv.x, aurBaseY + 0.17, rv.z + rv.d * 0.5 + 5.8);
      const vPool = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.42, 6.4), poolMat);
      vPool.position.set(rv.x, aurBaseY + 0.22, rv.z + rv.d * 0.5 + 5.8);
      auroriaGroup.add(poolBorder, vPool);
    }

    addBoxCollider(rv.x, rv.z, rv.w, rv.d, aurBaseY + 14);
  });

  // Auroria 24K Gold Boulevards Streetlamps (batched 2 InstancedMeshes!)
  const aurLampCoords: Array<[number, number]> = [];
  for (let az = -260; az <= 30; az += 48) {
    aurLampCoords.push([881, az], [1005, az], [1025, az], [1139, az]);
  }
  const aurPoleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6.4, 8);
  aurPoleGeo.translate(0, 3.2, 0);
  const aurBulbGeo = new THREE.SphereGeometry(0.42, 8, 6);
  aurBulbGeo.translate(0, 6.55, 0);
  disposables.push(aurPoleGeo, aurBulbGeo);

  const aurPolesInst = new THREE.InstancedMesh(aurPoleGeo, aurGoldMat, aurLampCoords.length);
  const aurBulbsInst = new THREE.InstancedMesh(aurBulbGeo, streetLampBulbsMat, aurLampCoords.length);
  aurLampCoords.forEach(([lx, lz], i) => {
    dummyStatic.position.set(lx, aurBaseY, lz);
    dummyStatic.rotation.set(0, 0, 0);
    dummyStatic.scale.setScalar(1);
    dummyStatic.updateMatrix();
    aurPolesInst.setMatrixAt(i, dummyStatic.matrix);
    aurBulbsInst.setMatrixAt(i, dummyStatic.matrix);
  });
  aurPolesInst.instanceMatrix.needsUpdate = true;
  aurBulbsInst.instanceMatrix.needsUpdate = true;
  aurPolesInst.computeBoundingSphere();
  aurBulbsInst.computeBoundingSphere();
  auroriaGroup.add(aurPolesInst, aurBulbsInst);

  scene.add(auroriaGroup);

  // 13. INSTANCED TREES & STREETLAMPS & TRAFFIC LIGHTS
  const treePositions: Array<{ x: number; y: number; z: number; scale: number; palm: boolean }> = [];
  for (let i = 0; i < 160; i++) {
    const tx = -335 + rand() * 185;
    const tz = -255 + rand() * 535;
    if (Math.abs(tx - -240) < 10 || Math.abs(tz % 80) < 10) continue;
    const ty = groundHeightAt(tx, tz);
    treePositions.push({ x: tx, y: ty, z: tz, scale: 0.85 + rand() * 0.35, palm: tz > 240 || (tx < -200 && tz < -40) });
  }
  for (let bx = -320; bx <= 100; bx += 26) {
    treePositions.push({ x: bx, y: groundHeightAt(bx, 314), z: 314, scale: 1.05 + rand() * 0.25, palm: true });
  }
  // Tropical Island Palm Trees (outside airstrip clearway)
  for (let i = 0; i < 36; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 28 + rand() * 52;
    const tx = ISLAND_CENTER.x + Math.cos(ang) * rad;
    const tz = ISLAND_CENTER.z + Math.sin(ang) * rad;
    if (Math.abs(tx - ISLAND_CENTER.x) < 22 && tz >= 680 && tz <= 832) continue;
    const ty = groundHeightAt(tx, tz);
    if (ty > 0.3) {
      treePositions.push({ x: tx, y: ty, z: tz, scale: 1.05 + rand() * 0.35, palm: true });
    }
  }
  for (let i = 0; i < 240; i++) {
    const tx = -520 + rand() * 640;
    const tz = -540 + rand() * 240;
    if (Math.abs(tx - -240) < 12 || Math.abs(tx - 40) < 12 || Math.abs(tz - -460) < 12) continue;
    const ty = groundHeightAt(tx, tz);
    treePositions.push({ x: tx, y: ty, z: tz, scale: 0.9 + rand() * 0.5, palm: false });
  }
  // Auroria Rich Country Manicured Palm & Emerald Cypress Trees
  for (let i = 0; i < 54; i++) {
    const tx = 845 + rand() * 315;
    const tz = -315 + rand() * 390;
    if (
      Math.abs(tx - 890) < 11 ||
      Math.abs(tx - 1015) < 12 ||
      Math.abs(tx - 1130) < 11 ||
      Math.abs(tz - -240) < 11 ||
      Math.abs(tz - -120) < 12 ||
      Math.abs(tz - 0) < 11 ||
      Math.hypot(tx - 952, tz - -180) < 34 ||
      (Math.abs(tx - 952) < 24 && Math.abs(tz - -262.5) < 16) ||
      richVillas.some((rv) => Math.abs(tx - rv.x) < rv.w * 0.68 && Math.abs(tz - rv.z) < rv.d * 0.78)
    ) {
      continue;
    }
    treePositions.push({
      x: tx,
      y: groundHeightAt(tx, tz),
      z: tz,
      scale: 0.95 + rand() * 0.35,
      palm: i % 2 === 0,
    });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.38, 3.4, 7);
  trunkGeo.translate(0, 1.7, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const crownGeo = new THREE.ConeGeometry(2.1, 4.8, 7);
  crownGeo.translate(0, 5.1, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d6a31, roughness: 0.85 });
  disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

  const trunksInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const crownsInst = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
  trunksInst.castShadow = false;
  crownsInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  treePositions.forEach((tp, idx) => {
    dummy.position.set(tp.x, tp.y, tp.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(tp.scale, tp.palm ? tp.scale * 1.25 : tp.scale, tp.scale);
    dummy.updateMatrix();
    trunksInst.setMatrixAt(idx, dummy.matrix);
    crownsInst.setMatrixAt(idx, dummy.matrix);
    tint.setHSL(tp.palm ? 0.28 : 0.33, 0.45 + rand() * 0.15, 0.32 + rand() * 0.14);
    crownsInst.setColorAt(idx, tint);
  });
  trunksInst.instanceMatrix.needsUpdate = true;
  crownsInst.instanceMatrix.needsUpdate = true;
  if (crownsInst.instanceColor) crownsInst.instanceColor.needsUpdate = true;
  trunksInst.computeBoundingSphere();
  crownsInst.computeBoundingSphere();
  scene.add(trunksInst, crownsInst);

  // Streetlamps
  const lampCoords: Array<[number, number]> = [];
  for (let z = -220; z <= 260; z += 40) {
    for (const x of [-130, -49, 49, 130, -249, 249]) {
      lampCoords.push([x, z]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.2, 6);
  poleGeo.translate(0, 3.1, 0);
  const bulbGeo = new THREE.BoxGeometry(0.7, 0.22, 0.4);
  bulbGeo.translate(0, 6.25, 0);
  disposables.push(poleGeo, bulbGeo);

  const polesInst = new THREE.InstancedMesh(poleGeo, darkMetalMat, lampCoords.length);
  const bulbsInst = new THREE.InstancedMesh(bulbGeo, streetLampBulbsMat, lampCoords.length);
  lampCoords.forEach(([lx, lz], i) => {
    dummy.position.set(lx, groundHeightAt(lx, lz), lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    polesInst.setMatrixAt(i, dummy.matrix);
    bulbsInst.setMatrixAt(i, dummy.matrix);
  });
  polesInst.instanceMatrix.needsUpdate = true;
  bulbsInst.instanceMatrix.needsUpdate = true;
  polesInst.computeBoundingSphere();
  bulbsInst.computeBoundingSphere();
  scene.add(polesInst, bulbsInst);

  // Traffic Lights (Shared geometry + 2 phase-group materials instead of 64 per-intersection materials!)
  const tlPostGeo = new THREE.CylinderGeometry(0.14, 0.16, 5.2, 6);
  const tlHeadGeo = new THREE.BoxGeometry(0.6, 1.4, 0.6);
  const tlBulbGeo = new THREE.SphereGeometry(0.18, 6, 6);
  disposables.push(tlPostGeo, tlHeadGeo, tlBulbGeo);

  const tlBuckets = [0, 1].map((bucketIdx) => {
    const phaseOffset = bucketIdx === 0 ? 0 : 6;
    const nsRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.1 });
    const nsGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2.4 });
    const ewRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.4 });
    const ewGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.1 });
    disposables.push(nsRedMat, nsGreenMat, ewRedMat, ewGreenMat);
    return { phaseOffset, lastNsGo: true, nsRedMat, nsGreenMat, ewRedMat, ewGreenMat };
  });

  TRAFFIC_INTERSECTIONS.forEach((inter) => {
    const chunk = getChunk(inter.x, inter.z);
    const bucketIdx = Math.round(inter.phaseOffset / 6) % 2;
    const bucket = tlBuckets[bucketIdx];
    const post = new THREE.Mesh(tlPostGeo, darkMetalMat);
    post.position.set(inter.x + 8.5, 2.6, inter.z + 8.5);
    const headBox = new THREE.Mesh(tlHeadGeo, darkMetalMat);
    headBox.position.set(inter.x + 8.5, 5.4, inter.z + 8.5);

    const nsRed = new THREE.Mesh(tlBulbGeo, bucket.nsRedMat);
    nsRed.position.set(inter.x + 8.5, 5.75, inter.z + 8.18);
    const nsGreen = new THREE.Mesh(tlBulbGeo, bucket.nsGreenMat);
    nsGreen.position.set(inter.x + 8.5, 5.15, inter.z + 8.18);

    const ewRed = new THREE.Mesh(tlBulbGeo, bucket.ewRedMat);
    ewRed.position.set(inter.x + 8.18, 5.75, inter.z + 8.5);
    const ewGreen = new THREE.Mesh(tlBulbGeo, bucket.ewGreenMat);
    ewGreen.position.set(inter.x + 8.18, 5.15, inter.z + 8.5);

    chunk.add(post, headBox, nsRed, nsGreen, ewRed, ewGreen);
    trafficLights.push({
      x: inter.x,
      z: inter.z,
      phaseOffset: inter.phaseOffset,
      nsRed,
      nsGreen,
      ewRed,
      ewGreen,
    });
  });

  // Glowing Interior Portal Rings + Subtle Vertical Sky Beacons
  const sharedRingGeo = new THREE.TorusGeometry(1.4, 0.14, 8, 20);
  const sharedBeamGeo = new THREE.CylinderGeometry(0.18, 0.95, 16, 10, 1, true);
  disposables.push(sharedRingGeo, sharedBeamGeo);
  INTERIOR_PORTALS.forEach((portal) => {
    const ringMat = new THREE.MeshStandardMaterial({
      color: portal.accentColor,
      emissive: portal.accentColor,
      emissiveIntensity: 1.9,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: portal.accentColor,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposables.push(ringMat, beamMat);
    const ring = new THREE.Mesh(sharedRingGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(portal.exteriorPos.x, portal.exteriorPos.y + 0.15, portal.exteriorPos.z);
    const beam = new THREE.Mesh(sharedBeamGeo, beamMat);
    beam.position.set(portal.exteriorPos.x, portal.exteriorPos.y + 8.0, portal.exteriorPos.z);
    scene.add(ring, beam);
  });

  let lastIsNight: boolean | null = null;
  let lastIsRaining: boolean | null = null;
  const chunkList = Array.from(chunks.values());

  // Freeze static world matrices (all static geometry except animated radarDish) for CPU matrix speedup
  const freezeStatic = (obj: THREE.Object3D) => {
    if (obj === radarDish) return;
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
    for (let i = 0; i < obj.children.length; i++) {
      freezeStatic(obj.children[i]);
    }
  };
  freezeStatic(terrainMesh);
  freezeStatic(waterMesh);
  freezeStatic(islandGroup);
  freezeStatic(auroriaGroup);
  freezeStatic(borderGroup);
  freezeStatic(trunksInst);
  freezeStatic(crownsInst);
  freezeStatic(polesInst);
  freezeStatic(bulbsInst);
  for (let i = 0; i < chunkList.length; i++) {
    freezeStatic(chunkList[i]);
  }

  return {
    colliders,
    trafficLights,
    streetLampBulbsMat,
    skyscraperGlassMat,
    waterUniforms,
    radarDish,
    roadMaterials,
    updateStreaming: (playerX: number, playerZ: number, streamRadius = 620) => {
      const r2 = streamRadius * streamRadius;
      for (let i = 0; i < chunkList.length; i++) {
        const group = chunkList[i];
        const dx = group.userData.centerX - playerX;
        const dz = group.userData.centerZ - playerZ;
        group.visible = dx * dx + dz * dz < r2;
      }
    },
    updateLightsAndWater: (time: number, isNight: boolean, isRaining: boolean, simTime: number) => {
      waterUniforms.uTime.value = time;
      radarDish.rotation.y = time * 1.1;

      if (isNight !== lastIsNight) {
        lastIsNight = isNight;
        streetLampBulbsMat.emissiveIntensity = isNight ? 2.6 : 0.08;
        skyscraperGlassMat.emissiveIntensity = isNight ? 1.55 : 0.1;
        brickMat.emissiveIntensity = isNight ? 1.45 : 0.04;
        nightWindowMat.emissiveIntensity = isNight ? 1.65 : 0.06;
      }

      if (isRaining !== lastIsRaining) {
        lastIsRaining = isRaining;
        const targetRough = isRaining ? 0.24 : 0.82;
        for (let i = 0; i < roadMaterials.length; i++) {
          roadMaterials[i].roughness = targetRough;
        }
      }

      for (let i = 0; i < tlBuckets.length; i++) {
        const b = tlBuckets[i];
        const nsGo = ((simTime + b.phaseOffset) % 12) < 6;
        if (nsGo !== b.lastNsGo) {
          b.lastNsGo = nsGo;
          b.nsGreenMat.emissiveIntensity = nsGo ? 2.4 : 0.1;
          b.nsRedMat.emissiveIntensity = nsGo ? 0.1 : 2.4;
          b.ewGreenMat.emissiveIntensity = !nsGo ? 2.4 : 0.1;
          b.ewRedMat.emissiveIntensity = !nsGo ? 0.1 : 2.4;
        }
      }
    },
    syncOwnedHouseSigns: (ownedHouses: Set<string>) => {
      houseForSaleSigns.forEach((signGroup, houseId) => {
        signGroup.visible = !ownedHouses.has(houseId);
      });
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      trunksInst.dispose();
      crownsInst.dispose();
      polesInst.dispose();
      bulbsInst.dispose();
    },
  };
}
