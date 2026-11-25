import * as THREE from 'three';
import { ColliderBox, WeaponId } from '../types';
import { groundHeightAt, resolveCircleColliders } from '../world/worldLayout';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  cooldown: number;
  damage: number;
  range: number;
  isMelee: boolean;
}

export const WEAPON_CATALOG: Record<WeaponId, WeaponSpec> = {
  fists: { id: 'fists', name: 'Melee', cooldown: 0.38, damage: 14, range: 2.8, isMelee: true },
  pistol: { id: 'pistol', name: 'CW-9 Pistol', cooldown: 0.28, damage: 36, range: 65, isMelee: false },
  smg: { id: 'smg', name: 'Vortex SMG', cooldown: 0.11, damage: 21, range: 52, isMelee: false },
  shotgun: { id: 'shotgun', name: 'Striker 12G', cooldown: 0.68, damage: 72, range: 28, isMelee: false },
  rifle: { id: 'rifle', name: 'Titan AR-15', cooldown: 0.14, damage: 34, range: 85, isMelee: false },
  rpg: { id: 'rpg', name: 'HX-7 RPG', cooldown: 1.25, damage: 250, range: 130, isMelee: false },
};

const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'rpg', 'fists'];

interface TracerBolt {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  fromPolice: boolean;
}

interface RpgRocket {
  active: boolean;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  fromJet: boolean;
  homingHit: boolean;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export class WeaponSystem {
  public currentWeapon: WeaponId = 'pistol';
  public ownedWeapons = new Set<WeaponId>(['fists', 'pistol']);
  public ammoByWeapon: Record<WeaponId, number> = {
    fists: 999,
    pistol: 90,
    smg: 0,
    shotgun: 0,
    rifle: 0,
    rpg: 0,
  };
  private fireCooldown = 0;

  private tracersMesh: THREE.InstancedMesh;
  private tracerPool: TracerBolt[] = [];
  private tracerCount = 60;
  private tracerCursor = 0;
  private rockets: RpgRocket[] = [];
  private rocketCursor = 0;
  private disposables: Array<{ dispose: () => void }> = [];
  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 1.15);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.tracersMesh = new THREE.InstancedMesh(geo, mat, this.tracerCount);
    this.tracersMesh.frustumCulled = false;

    for (let i = 0; i < this.tracerCount; i++) {
      this.tracerPool.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.25,
        fromPolice: false,
      });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.tracersMesh.setMatrixAt(i, this._dummy.matrix);
      this.tracersMesh.setColorAt(i, this._color.setHex(0xfde047));
    }
    this.tracersMesh.instanceMatrix.needsUpdate = true;
    if (this.tracersMesh.instanceColor) this.tracersMesh.instanceColor.needsUpdate = true;
    scene.add(this.tracersMesh);

    // 3D Flying RPG Rocket Mesh Pool
    const bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const coneGeo = new THREE.ConeGeometry(0.09, 0.24, 8);
    coneGeo.rotateX(Math.PI / 2);
    const flameGeo = new THREE.ConeGeometry(0.11, 0.42, 8);
    flameGeo.rotateX(-Math.PI / 2);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.5 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    this.disposables.push(bodyGeo, coneGeo, flameGeo, bodyMat, coneMat, flameMat);

    for (let i = 0; i < 12; i++) {
      const grp = new THREE.Group();
      const b = new THREE.Mesh(bodyGeo, bodyMat);
      const c = new THREE.Mesh(coneGeo, coneMat);
      c.position.z = 0.36;
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.z = -0.45;
      grp.add(b, c, f);
      grp.visible = false;
      scene.add(grp);
      this.rockets.push({
        active: false,
        mesh: grp,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        fromJet: false,
        homingHit: false,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
      });
    }
  }

  public getSpec(): WeaponSpec {
    return WEAPON_CATALOG[this.currentWeapon];
  }

  public hasActiveRockets(): boolean {
    for (let i = 0; i < this.rockets.length; i++) {
      if (this.rockets[i].active) return true;
    }
    return false;
  }

  public cycleWeapon(): WeaponId {
    const owned = WEAPON_ORDER.filter((w) => this.ownedWeapons.has(w));
    if (owned.length === 0) return 'fists';
    const idx = owned.indexOf(this.currentWeapon);
    this.currentWeapon = owned[(idx + 1) % owned.length];
    return this.currentWeapon;
  }

  public selectWeapon(id: WeaponId): boolean {
    if (!this.ownedWeapons.has(id)) return false;
    this.currentWeapon = id;
    return true;
  }

  public unlockOrRefillWeapon(id: WeaponId, refillAmount: number): void {
    this.ownedWeapons.add(id);
    if (id === 'rpg') {
      this.ammoByWeapon.rpg = Math.min(24, Math.max(refillAmount, this.ammoByWeapon.rpg + refillAmount));
    } else if (id !== 'fists') {
      this.ammoByWeapon[id] = Math.max(this.ammoByWeapon[id], refillAmount);
    }
    this.currentWeapon = id;
  }

  public refillAmmo(): void {
    this.ammoByWeapon.pistol = Math.max(this.ammoByWeapon.pistol, 90);
    if (this.ownedWeapons.has('smg')) this.ammoByWeapon.smg = Math.max(this.ammoByWeapon.smg, 180);
    if (this.ownedWeapons.has('shotgun')) this.ammoByWeapon.shotgun = Math.max(this.ammoByWeapon.shotgun, 36);
    if (this.ownedWeapons.has('rifle')) this.ammoByWeapon.rifle = Math.max(this.ammoByWeapon.rifle, 150);
    if (this.ownedWeapons.has('rpg')) this.ammoByWeapon.rpg = Math.max(this.ammoByWeapon.rpg, 6);
  }

  public addSupermarketAmmoPack(): void {
    this.ammoByWeapon.pistol = Math.max(this.ammoByWeapon.pistol, 120);
    if (this.ownedWeapons.has('smg')) this.ammoByWeapon.smg = Math.max(this.ammoByWeapon.smg, 240);
    if (this.ownedWeapons.has('shotgun')) this.ammoByWeapon.shotgun = Math.max(this.ammoByWeapon.shotgun, 48);
    if (this.ownedWeapons.has('rifle')) this.ammoByWeapon.rifle = Math.max(this.ammoByWeapon.rifle, 180);
    if (this.ownedWeapons.has('rpg')) this.ammoByWeapon.rpg = Math.min(24, this.ammoByWeapon.rpg + 4);
  }

  public spawnTracer(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    fromPolice: boolean
  ): void {
    const bolt = this.tracerPool[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracerCount;
    const speed = 135;
    bolt.active = true;
    bolt.x = ox;
    bolt.y = oy;
    bolt.z = oz;
    bolt.vx = dx * speed;
    bolt.vy = dy * speed;
    bolt.vz = dz * speed;
    bolt.age = 0;
    bolt.maxAge = 0.4;
    bolt.fromPolice = fromPolice;
  }

  public launchRocket(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): void {
    const r = this.rockets[this.rocketCursor];
    this.rocketCursor = (this.rocketCursor + 1) % this.rockets.length;
    const speed = 44;
    r.active = true;
    r.fromJet = false;
    r.homingHit = false;
    r.x = ox + dx * 0.9;
    r.y = oy + dy * 0.9;
    r.z = oz + dz * 0.9;
    r.vx = dx * speed;
    r.vy = dy * speed;
    r.vz = dz * speed;
    r.age = 0;
    r.mesh.visible = true;
    r.mesh.position.set(r.x, r.y, r.z);
    r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
  }

  public launchJetRocket(
    ox: number,
    oy: number,
    oz: number,
    isDirectHit: boolean,
    targetX: number,
    targetY: number,
    targetZ: number
  ): void {
    const r = this.rockets[this.rocketCursor];
    this.rocketCursor = (this.rocketCursor + 1) % this.rockets.length;
    let aimX = targetX;
    let aimY = targetY + 0.7;
    let aimZ = targetZ;

    if (!isDirectHit) {
      // Near-miss explosion outside 12..24m blast danger zone so ONLY exact hit probability destroys player's car
      const angle = Math.random() * Math.PI * 2;
      const missRadius = 12 + Math.random() * 12;
      aimX = targetX + Math.cos(angle) * missRadius;
      aimZ = targetZ + Math.sin(angle) * missRadius;
      aimY = groundHeightAt(aimX, aimZ) + 0.2;
    }

    const dx = aimX - ox;
    const dy = aimY - oy;
    const dz = aimZ - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const speed = isDirectHit ? 68 : 60;

    r.active = true;
    r.fromJet = true;
    r.homingHit = isDirectHit;
    r.targetX = aimX;
    r.targetY = aimY;
    r.targetZ = aimZ;
    r.x = ox + (dx / len) * 1.4;
    r.y = oy + (dy / len) * 1.4;
    r.z = oz + (dz / len) * 1.4;
    r.vx = (dx / len) * speed;
    r.vy = (dy / len) * speed;
    r.vz = (dz / len) * speed;
    r.age = 0;
    r.mesh.visible = true;
    r.mesh.position.set(r.x, r.y, r.z);
    r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
  }

  public fireRobotInfiniteRpg(
    ox: number,
    oy: number,
    oz: number,
    aimDirX: number,
    aimDirY: number,
    aimDirZ: number,
    targets: Array<{ id: string; x: number; y: number; z: number; radius: number }>,
    onSound: () => void
  ): boolean {
    if (this.fireCooldown > 0) return false;
    this.fireCooldown = 0.56;
    onSound();

    const horizLen = Math.hypot(aimDirX, aimDirZ) || 1;
    const hAimX = aimDirX / horizLen;
    const hAimZ = aimDirZ / horizLen;

    let bestScore = Infinity;
    let bestTarget: { x: number; y: number; z: number } | null = null;
    for (const t of targets) {
      const tx = t.x - ox;
      const tz = t.z - oz;
      const dist = Math.hypot(tx, tz);
      if (dist > 140 || dist < 1.2) continue;
      const dot = (tx / dist) * hAimX + (tz / dist) * hAimZ;
      if (dot < 0.78) continue;
      const score = dist * (1.2 - dot);
      if (score < bestScore) {
        bestScore = score;
        bestTarget = t;
      }
    }

    let dirX = aimDirX;
    let dirY = aimDirY;
    let dirZ = aimDirZ;
    if (bestTarget) {
      const dx = bestTarget.x - ox;
      const dy = bestTarget.y + 0.9 - oy;
      const dz = bestTarget.z - oz;
      const len = Math.hypot(dx, dy, dz) || 1;
      dirX = dx / len;
      dirY = dy / len;
      dirZ = dz / len;
    } else {
      const len = Math.hypot(dirX, dirY, dirZ) || 1;
      dirX /= len;
      dirY /= len;
      dirZ /= len;
    }

    this.launchRocket(ox, oy, oz, dirX, dirY, dirZ);
    return true;
  }

  public tryPlayerFire(
    ox: number,
    oy: number,
    oz: number,
    aimDirX: number,
    aimDirZ: number,
    targets: Array<{ id: string; x: number; y: number; z: number; radius: number }>,
    onHitTarget: (id: string, damage: number, rayDirX: number, rayDirY: number, rayDirZ: number) => void,
    onSound: (kind: WeaponId) => void
  ): boolean {
    if (this.fireCooldown > 0) return false;
    const spec = this.getSpec();

    if (!spec.isMelee && this.ammoByWeapon[spec.id] <= 0) {
      this.currentWeapon = 'fists';
      return false;
    }

    this.fireCooldown = spec.cooldown;
    if (!spec.isMelee) {
      this.ammoByWeapon[spec.id]--;
    }

    onSound(spec.id);

    // Smart 3rd-person aim assist: find best target in forward cone
    let bestId: string | null = null;
    let bestScore = Infinity;
    let bestTarget: { x: number; y: number; z: number } | null = null;

    for (const t of targets) {
      const tx = t.x - ox;
      const tz = t.z - oz;
      const dist = Math.hypot(tx, tz);
      if (dist > spec.range || dist < 0.2) continue;

      const dot = (tx / dist) * aimDirX + (tz / dist) * aimDirZ;
      const minCone = spec.isMelee ? 0.35 : spec.id === 'shotgun' ? 0.58 : 0.72;
      if (dot < minCone) continue;

      const score = dist * (1.2 - dot);
      if (score < bestScore) {
        bestScore = score;
        bestId = t.id;
        bestTarget = t;
      }
    }

    if (spec.id === 'rpg') {
      let dirX = aimDirX;
      let dirY = -0.025;
      let dirZ = aimDirZ;
      if (bestTarget) {
        const dx = bestTarget.x - ox;
        const dy = bestTarget.y + 0.85 - oy;
        const dz = bestTarget.z - oz;
        const len = Math.hypot(dx, dy, dz) || 1;
        dirX = dx / len;
        dirY = dy / len;
        dirZ = dz / len;
      }
      this.launchRocket(ox, oy + 0.15, oz, dirX, dirY, dirZ);
      return true;
    }

    let rayDirX = aimDirX;
    let rayDirY = -0.04;
    let rayDirZ = aimDirZ;

    if (!spec.isMelee) {
      if (bestTarget) {
        const dx = bestTarget.x - ox;
        const dy = bestTarget.y + 0.85 - oy;
        const dz = bestTarget.z - oz;
        const len = Math.hypot(dx, dy, dz) || 1;
        rayDirX = dx / len;
        rayDirY = dy / len;
        rayDirZ = dz / len;
      }

      if (spec.id === 'shotgun') {
        // 5 spread pellets
        for (let p = -2; p <= 2; p++) {
          const angOff = p * 0.065;
          const cos = Math.cos(angOff);
          const sin = Math.sin(angOff);
          const sx = rayDirX * cos - rayDirZ * sin;
          const sz = rayDirX * sin + rayDirZ * cos;
          this.spawnTracer(ox, oy, oz, sx, rayDirY + (Math.random() - 0.5) * 0.04, sz, false);
        }
      } else {
        this.spawnTracer(ox, oy, oz, rayDirX, rayDirY, rayDirZ, false);
      }
    }

    if (bestId) {
      onHitTarget(bestId, spec.damage, rayDirX, rayDirY, rayDirZ);
    }
    return true;
  }

  public update(
    dt: number,
    colliders: ColliderBox[],
    dynamicTargets: Array<{ x: number; y: number; z: number; radius: number }>,
    onRocketTrail: (x: number, y: number, z: number) => void,
    onRocketDetonate: (x: number, y: number, z: number, fromJet?: boolean, homingHit?: boolean) => void,
    playerTarget?: { x: number; y: number; z: number }
  ): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    // Update RPG flying rockets
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.age += dt;
      if (r.fromJet && r.homingHit && playerTarget) {
        // Steer rolled-hit jet RPG onto moving player vehicle so rolled hit chance stays accurate
        const tx = playerTarget.x - r.x;
        const ty = playerTarget.y + 0.7 - r.y;
        const tz = playerTarget.z - r.z;
        const len = Math.hypot(tx, ty, tz) || 1;
        const speed = 72;
        r.vx = THREE.MathUtils.damp(r.vx, (tx / len) * speed, 9, dt);
        r.vy = THREE.MathUtils.damp(r.vy, (ty / len) * speed, 9, dt);
        r.vz = THREE.MathUtils.damp(r.vz, (tz / len) * speed, 9, dt);
      } else if (!r.fromJet) {
        r.vy -= 1.4 * dt; // Slight gravity arc
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
      r.mesh.rotation.z += dt * 12;

      if (Math.random() < 0.85) {
        onRocketTrail(r.x, r.y, r.z);
      }

      const maxLifetime = r.fromJet ? 4.2 : 2.8;
      let hit = r.age >= maxLifetime || r.y <= groundHeightAt(r.x, r.z) + 0.25;

      if (!hit && r.fromJet && r.homingHit && playerTarget) {
        const pdx = playerTarget.x - r.x;
        const pdy = playerTarget.y + 0.7 - r.y;
        const pdz = playerTarget.z - r.z;
        if (pdx * pdx + pdy * pdy + pdz * pdz <= 2.6 * 2.6) {
          hit = true;
        }
      }

      if (!hit && !r.fromJet) {
        const col = resolveCircleColliders(r.x, r.z, r.y, 0.35, colliders);
        if (col.hit) hit = true;
      }
      if (!hit && !r.fromJet) {
        for (const t of dynamicTargets) {
          const dx = t.x - r.x;
          const dy = t.y + 0.9 - r.y;
          const dz = t.z - r.z;
          const rad = Math.max(1.2, t.radius);
          if (dx * dx + dy * dy + dz * dz <= rad * rad) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        const fromJet = r.fromJet;
        const homingHit = r.homingHit;
        r.active = false;
        r.fromJet = false;
        r.homingHit = false;
        r.mesh.visible = false;
        onRocketDetonate(r.x, Math.max(groundHeightAt(r.x, r.z), r.y), r.z, fromJet, homingHit);
      }
    }

    let dirtyColor = false;
    for (let i = 0; i < this.tracerCount; i++) {
      const b = this.tracerPool[i];
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.maxAge) {
        b.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.01);
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        this._dummy.position.set(b.x, b.y, b.z);
        this._dummy.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
        this._dummy.scale.setScalar(1);
        this._color.setHex(b.fromPolice ? 0xf87171 : 0xfde047);
        this.tracersMesh.setColorAt(i, this._color);
        dirtyColor = true;
      }
      this._dummy.updateMatrix();
      this.tracersMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.tracersMesh.instanceMatrix.needsUpdate = true;
    if (dirtyColor && this.tracersMesh.instanceColor) {
      this.tracersMesh.instanceColor.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.tracersMesh.geometry.dispose();
    (this.tracersMesh.material as THREE.Material).dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
