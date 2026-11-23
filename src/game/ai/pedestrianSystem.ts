import * as THREE from 'three';
import { groundHeightAt } from '../world/worldLayout';
import { buildMemeCostumeAttachables } from '../player/memeCostumes';
import { MEME_SKIN_IDS, PLAYER_SKINS } from '../player/skinCatalog';

export interface Pedestrian {
  id: string;
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  heading: number;
  walkSpeed: number;
  phase: number;
  panicTimer: number;
  turnTimer: number;
  idleTimer: number;
  fallTimer: number;
  ejectStumbleTimer: number;
  respawnTimer: number;
  hp: number;
  isAuroria?: boolean;
}

export class PedestrianSystem {
  public peds: Pedestrian[] = [];
  private scene: THREE.Scene;
  private activeLimit: number;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(scene: THREE.Scene, maxPool = 40) {
    this.scene = scene;
    this.activeLimit = maxPool;

    const torsoGeo = new THREE.BoxGeometry(0.4, 0.56, 0.22);
    const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const limbGeo = new THREE.BoxGeometry(0.14, 0.54, 0.16);
    const legGeo = new THREE.BoxGeometry(0.16, 0.7, 0.18);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfb18b, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    this.disposables.push(torsoGeo, headGeo, limbGeo, legGeo, skinMat, pantsMat);

    const shirtPalette = [0xe11d48, 0x2563eb, 0x059669, 0xd97706, 0x7c3aed, 0xf1f5f9, 0x475569];
    const shirtMats = shirtPalette.map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 });
      this.disposables.push(m);
      return m;
    });

    const sidewalkAnchors: Array<{ x: number; z: number; heading: number; isAuroria?: boolean }> = [];
    for (const roadCoord of [-129, -111, -49, -31, 31, 49, 111, 129]) {
      for (let t = -140; t <= 220; t += 45) {
        sidewalkAnchors.push({ x: roadCoord, z: t, heading: Math.random() > 0.5 ? 0 : Math.PI });
      }
    }
    for (let bx = -240; bx <= 80; bx += 32) {
      sidewalkAnchors.push({ x: bx, z: 306, heading: Math.PI / 2 });
    }
    // Add Auroria Rich Country luxury promenade anchors at end of anchor cycle
    const auroriaAnchors: Array<{ x: number; z: number; heading: number; isAuroria: boolean }> = [
      { x: 899, z: -180, heading: 0, isAuroria: true },
      { x: 1005, z: -130, heading: Math.PI / 2, isAuroria: true },
      { x: 1025, z: -110, heading: -Math.PI / 2, isAuroria: true },
      { x: 1121, z: -160, heading: Math.PI, isAuroria: true },
      { x: 960, z: -231, heading: Math.PI / 2, isAuroria: true },
      { x: 1060, z: -9, heading: -Math.PI / 2, isAuroria: true },
    ];

    const memeShirtMats = new Map<string, THREE.MeshStandardMaterial>();
    const memePantsMats = new Map<string, THREE.MeshStandardMaterial>();
    for (const mId of MEME_SKIN_IDS) {
      const sDef = PLAYER_SKINS[mId];
      const sm = new THREE.MeshStandardMaterial({
        color: sDef.jacketColor,
        roughness: sDef.roughness,
        metalness: sDef.metalness,
        emissive: sDef.emissive ?? 0x000000,
        emissiveIntensity: sDef.emissiveIntensity ?? 0,
      });
      const pm = new THREE.MeshStandardMaterial({
        color: sDef.pantsColor,
        roughness: sDef.roughness + 0.1,
        metalness: sDef.metalness * 0.6,
      });
      memeShirtMats.set(mId, sm);
      memePantsMats.set(mId, pm);
      this.disposables.push(sm, pm);
    }
    const auroriaSuitMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.2,
    });
    const auroriaGoldPantsMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85,
    });
    this.disposables.push(auroriaSuitMat, auroriaGoldPantsMat);

    for (let i = 0; i < maxPool; i++) {
      const anchor =
        i >= maxPool - 6
          ? auroriaAnchors[(i - (maxPool - 6)) % auroriaAnchors.length]
          : sidewalkAnchors[i % sidewalkAnchors.length];
      const root = new THREE.Group();
      const isAuroria = Boolean(anchor.isAuroria);
      // Roughly 45% of mainland pedestrians wear funny meme costumes!
      const memeId =
        !isAuroria && i % 2 === 0
          ? MEME_SKIN_IDS[Math.floor(i / 2) % MEME_SKIN_IDS.length]
          : null;

      const sMat = isAuroria
        ? auroriaSuitMat
        : memeId
          ? (memeShirtMats.get(memeId) ?? shirtMats[0])
          : shirtMats[i % shirtMats.length];
      const pMat = isAuroria
        ? auroriaGoldPantsMat
        : memeId
          ? (memePantsMats.get(memeId) ?? pantsMat)
          : pantsMat;

      const torso = new THREE.Mesh(torsoGeo, sMat);
      torso.position.set(0, 1.0, 0);
      torso.castShadow = true;

      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.44, 0);

      const leftArm = new THREE.Mesh(limbGeo, sMat);
      leftArm.position.set(-0.28, 0.98, 0);
      const rightArm = new THREE.Mesh(limbGeo, sMat);
      rightArm.position.set(0.28, 0.98, 0);

      const leftLeg = new THREE.Mesh(legGeo, pMat);
      leftLeg.position.set(-0.1, 0.36, 0);
      const rightLeg = new THREE.Mesh(legGeo, pMat);
      rightLeg.position.set(0.1, 0.36, 0);

      root.add(torso, head, leftArm, rightArm, leftLeg, rightLeg);

      if (memeId) {
        const costume = buildMemeCostumeAttachables(memeId);
        costume.torsoGroup.position.set(0, 1.0, 0);
        costume.torsoGroup.scale.setScalar(0.92);
        costume.headGroup.position.set(0, 1.44, 0);
        costume.headGroup.scale.setScalar(0.92);
        root.add(costume.torsoGroup, costume.headGroup);
      }

      const x = anchor.x + (Math.random() - 0.5) * 4;
      const z = anchor.z + (Math.random() - 0.5) * 8;
      const y = groundHeightAt(x, z);
      root.position.set(x, y, z);
      scene.add(root);

      this.peds.push({
        id: `ped_${i}`,
        root,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        x,
        y,
        z,
        heading: anchor.heading,
        walkSpeed: 1.5 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        panicTimer: 0,
        turnTimer: 3 + Math.random() * 6,
        idleTimer: 0,
        fallTimer: 0,
        ejectStumbleTimer: 0,
        respawnTimer: 0,
        hp: 40,
        isAuroria: Boolean(anchor.isAuroria),
      });
    }
  }

  public setActiveCount(count: number): void {
    this.activeLimit = Math.min(this.peds.length, Math.max(8, count));
    for (let i = 0; i < this.peds.length; i++) {
      if (i >= this.activeLimit) {
        this.peds[i].root.visible = false;
      }
    }
  }

  public findNearestPedestrian(x: number, z: number, maxDist = 2.8): Pedestrian | null {
    let best: Pedestrian | null = null;
    let bestSq = maxDist * maxDist;
    for (let i = 0; i < this.activeLimit; i++) {
      const p = this.peds[i];
      if (p.respawnTimer > 0) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  public getCombatTargets(): Array<{ id: string; x: number; y: number; z: number; radius: number }> {
    const out: Array<{ id: string; x: number; y: number; z: number; radius: number }> = [];
    for (let i = 0; i < this.activeLimit; i++) {
      const p = this.peds[i];
      if (p.respawnTimer <= 0 && p.root.visible) {
        out.push({ id: p.id, x: p.x, y: p.y, z: p.z, radius: 0.75 });
      }
    }
    return out;
  }

  public damagePedestrian(
    id: string,
    dmg: number,
    knockFromX?: number,
    knockFromZ?: number
  ): { hit: boolean; killed: boolean } {
    const p = this.peds.find((item) => item.id === id);
    if (!p || p.respawnTimer > 0 || p.fallTimer > 0) return { hit: false, killed: false };
    p.hp -= dmg;
    p.panicTimer = 6.5;
    p.idleTimer = 0;
    if (knockFromX !== undefined && knockFromZ !== undefined) {
      const dx = p.x - knockFromX;
      const dz = p.z - knockFromZ;
      const d = Math.hypot(dx, dz) || 1;
      p.x += (dx / d) * 0.9;
      p.z += (dz / d) * 0.9;
      p.heading = Math.atan2(dx, dz);
    }
    if (p.hp <= 0) {
      p.fallTimer = 1.4;
      return { hit: true, killed: true };
    }
    return { hit: true, killed: false };
  }

  /** Ejects an angry/panicked NPC driver onto the street beside the hijacked car */
  public spawnEjectedDriver(carX: number, carZ: number, carHeading: number): void {
    let candidate = this.peds.find((p) => !p.isAuroria && p.respawnTimer > 0) ?? null;
    if (!candidate) {
      // Pick the furthest non-Auroria pedestrian from the player/car
      let maxDistSq = -1;
      for (let i = 0; i < this.activeLimit; i++) {
        const p = this.peds[i];
        if (p.isAuroria) continue;
        const dSq = (p.x - carX) ** 2 + (p.z - carZ) ** 2;
        if (dSq > maxDistSq) {
          maxDistSq = dSq;
          candidate = p;
        }
      }
    }
    if (!candidate) return;

    const sideX = Math.cos(carHeading);
    const sideZ = -Math.sin(carHeading);
    candidate.respawnTimer = 0;
    candidate.fallTimer = 0;
    candidate.hp = 40;
    candidate.x = carX + sideX * 2.1;
    candidate.z = carZ + sideZ * 2.1;
    candidate.y = groundHeightAt(candidate.x, candidate.z);
    candidate.heading = Math.atan2(sideX, sideZ);
    candidate.panicTimer = 8.5;
    candidate.idleTimer = 0;
    candidate.ejectStumbleTimer = 0.55;
    candidate.root.visible = true;
    candidate.root.rotation.set(0, candidate.heading, 0);
    candidate.root.position.set(candidate.x, candidate.y, candidate.z);
  }

  public triggerPanicNear(cx: number, cz: number, radius = 26): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.activeLimit; i++) {
      const p = this.peds[i];
      const dx = p.x - cx;
      const dz = p.z - cz;
      if (dx * dx + dz * dz < r2) {
        p.panicTimer = 5.5;
        p.idleTimer = 0;
        p.heading = Math.atan2(dx, dz);
      }
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerSpeed: number,
    playerInVehicle: boolean,
    cullDist: number,
    onVehicleHitPedestrian: (killed: boolean) => void
  ): void {
    const cullSq = cullDist * cullDist;
    for (let i = 0; i < this.activeLimit; i++) {
      const p = this.peds[i];
      if (p.fallTimer > 0) {
        p.fallTimer -= dt;
        const progress = Math.min(1, (1.4 - p.fallTimer) / 0.28);
        p.root.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, progress);
        p.root.position.set(p.x, p.y + 0.14 * progress, p.z);
        p.root.visible = true;
        if (p.fallTimer <= 0) {
          p.respawnTimer = 18;
          p.root.rotation.x = 0;
          p.root.visible = false;
        }
        continue;
      }

      if (p.respawnTimer > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.hp = 40;
          p.panicTimer = 0;
          p.root.rotation.set(0, p.heading, 0);
        }
        p.root.visible = false;
        continue;
      }

      const dxp = p.x - playerX;
      const dzp = p.z - playerZ;
      const dy = Math.abs(playerY - p.y);
      const distSq = dxp * dxp + dzp * dzp;

      p.root.visible = distSq < cullSq;
      if (!p.root.visible) continue;

      if (p.ejectStumbleTimer > 0) {
        p.ejectStumbleTimer = Math.max(0, p.ejectStumbleTimer - dt);
        p.root.rotation.z = Math.sin(p.ejectStumbleTimer * 18) * 0.28;
      } else {
        p.root.rotation.z = 0;
      }

      // Gently step aside if player on foot brushes/touches them — NO crime!
      if (!playerInVehicle && distSq < 0.85 && dy < 2.2) {
        const d = Math.sqrt(distSq) || 0.1;
        p.x += (dxp / d) * (0.95 - d);
        p.z += (dzp / d) * (0.95 - d);
      }

      // Flee if a fast vehicle approaches closely at ground height (ignore high-flying planes!)
      if (playerInVehicle && distSq < 90 && dy < 8.5 && playerSpeed > 11) {
        p.panicTimer = 4.0;
        p.idleTimer = 0;
        p.heading = Math.atan2(dxp, dzp);
      }

      // Only a fast vehicle collision at street elevation hurts pedestrians (flying aircraft pass cleanly overhead)
      if (playerInVehicle && distSq < 2.2 && dy < 2.3 && playerSpeed > 10.5) {
        const res = this.damagePedestrian(p.id, 40, playerX, playerZ);
        onVehicleHitPedestrian(res.killed);
        continue;
      }

      if (p.panicTimer > 0) {
        p.panicTimer -= dt;
      } else if (p.idleTimer > 0) {
        p.idleTimer -= dt;
        p.leftLeg.rotation.x = 0;
        p.rightLeg.rotation.x = 0;
        p.leftArm.rotation.x = 0;
        p.rightArm.rotation.x = 0;
        continue;
      }

      p.turnTimer -= dt;
      if (p.turnTimer <= 0) {
        p.turnTimer = 4 + Math.random() * 8;
        if (Math.random() < 0.25 && p.panicTimer <= 0) {
          p.idleTimer = 1.5 + Math.random() * 2.5;
        } else {
          p.heading += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
        }
      }

      const speed = p.panicTimer > 0 ? p.walkSpeed * 2.8 : p.walkSpeed;
      if (p.isAuroria) {
        p.x = THREE.MathUtils.clamp(p.x + Math.sin(p.heading) * speed * dt, 770, 1155);
        p.z = THREE.MathUtils.clamp(p.z + Math.cos(p.heading) * speed * dt, -310, 65);
      } else {
        p.x = THREE.MathUtils.clamp(p.x + Math.sin(p.heading) * speed * dt, -330, 330);
        p.z = THREE.MathUtils.clamp(p.z + Math.cos(p.heading) * speed * dt, -260, 314);
      }
      p.y = groundHeightAt(p.x, p.z);

      p.phase += dt * speed * 4.2;
      const swing = Math.sin(p.phase) * 0.55;
      p.leftLeg.rotation.x = swing;
      p.rightLeg.rotation.x = -swing;
      p.leftArm.rotation.x = -swing * 0.8;
      p.rightArm.rotation.x = swing * 0.8;

      p.root.position.set(p.x, p.y, p.z);
      p.root.rotation.y = p.heading;
    }
  }

  public dispose(): void {
    this.peds.forEach((p) => this.scene.remove(p.root));
    this.disposables.forEach((d) => d.dispose());
  }
}
