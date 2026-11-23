import * as THREE from 'three';
import { ColliderBox } from '../types';
import { buildVehicleMesh, VehicleRig } from '../vehicles/vehicleMesh';
import { groundHeightAt, resolveCircleColliders } from '../world/worldLayout';

interface PoliceOfficer {
  id: string;
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  heading: number;
  hp: number;
  deployed: boolean;
  fireCooldown: number;
  walkPhase: number;
}

export interface PoliceUnit {
  id: string;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  hp: number;
  exploded: boolean;
  active: boolean;
  stolen: boolean;
  lastKnownX: number;
  lastKnownZ: number;
  ramCooldown: number;
  officer: PoliceOfficer;
}

export class WantedSystem {
  public stars = 0;
  public heatScore = 0;
  public evadeTimer = 0;
  public evadeDuration = 20; // 20 seconds escape timer when distanced from police
  public isSearching = false;
  public nearestPoliceDist = 9999;

  public units: PoliceUnit[] = [];
  private scene: THREE.Scene;
  private strobeTimer = 0;
  private poolSize = 3; // Balanced max 3 active police cruisers so gameplay stays intense & smooth
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Shared police officer geometries & materials
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.56, 0.24);
    const headGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const capGeo = new THREE.BoxGeometry(0.27, 0.09, 0.28);
    const limbGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    const legGeo = new THREE.BoxGeometry(0.17, 0.72, 0.18);
    const gunGeo = new THREE.BoxGeometry(0.08, 0.09, 0.26);

    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.65 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfb18b, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
    this.disposables.push(torsoGeo, headGeo, capGeo, limbGeo, legGeo, gunGeo, uniformMat, skinMat, darkMat);

    for (let i = 0; i < this.poolSize; i++) {
      const rig = buildVehicleMesh('police', 0x0f172a, false);
      rig.root.visible = false;
      scene.add(rig.root);

      // Build articulated CWPD Police Officer
      const officerRoot = new THREE.Group();
      const torso = new THREE.Mesh(torsoGeo, uniformMat);
      torso.position.set(0, 1.02, 0);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.45, 0);
      const cap = new THREE.Mesh(capGeo, uniformMat);
      cap.position.set(0, 1.59, 0.02);

      const leftArm = new THREE.Mesh(limbGeo, uniformMat);
      leftArm.position.set(-0.3, 0.98, 0);
      const rightArm = new THREE.Mesh(limbGeo, uniformMat);
      rightArm.position.set(0.3, 1.15, 0.2);
      rightArm.rotation.x = -Math.PI / 2;

      const gun = new THREE.Mesh(gunGeo, darkMat);
      gun.position.set(0, -0.26, 0.14);
      rightArm.add(gun);

      const leftLeg = new THREE.Mesh(legGeo, darkMat);
      leftLeg.position.set(-0.1, 0.36, 0);
      const rightLeg = new THREE.Mesh(legGeo, darkMat);
      rightLeg.position.set(0.1, 0.36, 0);

      officerRoot.add(torso, head, cap, leftArm, rightArm, leftLeg, rightLeg);
      officerRoot.visible = false;
      scene.add(officerRoot);

      this.units.push({
        id: `cop_car_${i}`,
        rig,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vz: 0,
        heading: 0,
        speed: 0,
        hp: 100,
        exploded: false,
        active: false,
        stolen: false,
        lastKnownX: 0,
        lastKnownZ: 0,
        ramCooldown: 0,
        officer: {
          id: `cop_officer_${i}`,
          root: officerRoot,
          leftLeg,
          rightLeg,
          rightArm,
          x: 0,
          y: -50,
          z: 0,
          heading: 0,
          hp: 70,
          deployed: false,
          fireCooldown: 1.0,
          walkPhase: 0,
        },
      });
    }
  }

  public addCrimeHeat(amount: number): void {
    this.heatScore = Math.min(500, this.heatScore + amount);
    const nextStars = Math.min(5, Math.ceil(this.heatScore / 95));
    if (nextStars > this.stars) {
      this.stars = nextStars;
    }
    if (this.stars > 0) {
      this.evadeTimer = 0;
      this.isSearching = false;
    }
  }

  public reportMinorAssault(): void {
    // Non-lethal punch: very low heat -> 1 star if clean, does NOT escalate to 2-5 stars
    if (this.stars === 0) {
      this.stars = 1;
      this.heatScore = 50;
    } else {
      this.heatScore = Math.min(500, this.heatScore + 8);
    }
    this.evadeTimer = 0;
    this.isSearching = false;
  }

  public setMinimumStars(minStars: number): void {
    const targetHeat = minStars * 95;
    if (this.heatScore < targetHeat) {
      this.heatScore = targetHeat;
      this.stars = minStars;
    }
    this.evadeTimer = 0;
    this.isSearching = false;
  }

  public clearWanted(): void {
    this.stars = 0;
    this.heatScore = 0;
    this.evadeTimer = 0;
    this.isSearching = false;
    for (const u of this.units) {
      u.active = false;
      u.stolen = false;
      u.exploded = false;
      u.rig.resetDamage();
      u.rig.root.visible = false;
      u.officer.deployed = false;
      u.officer.root.visible = false;
    }
  }

  public findNearestPoliceCruiser(x: number, z: number, maxDist = 5.0): PoliceUnit | null {
    let best: PoliceUnit | null = null;
    let bestSq = maxDist * maxDist;
    for (const u of this.units) {
      if (!u.active || u.stolen) continue;
      const dx = u.x - x;
      const dz = u.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestSq) {
        bestSq = d2;
        best = u;
      }
    }
    return best;
  }

  public hijackPoliceCruiser(u: PoliceUnit): { x: number; z: number; heading: number } {
    const snap = { x: u.x, z: u.z, heading: u.heading };
    // Eject officer on foot right beside the stolen cruiser & hide pooled car
    u.officer.deployed = true;
    u.officer.hp = 70;
    u.officer.x = u.x + Math.cos(u.heading) * 2.2;
    u.officer.z = u.z - Math.sin(u.heading) * 2.2;
    u.officer.y = groundHeightAt(u.officer.x, u.officer.z);
    u.officer.root.visible = true;
    u.stolen = true;
    u.rig.root.visible = false;
    return snap;
  }

  public getCombatTargets(): Array<{ id: string; x: number; y: number; z: number; radius: number }> {
    const list: Array<{ id: string; x: number; y: number; z: number; radius: number }> = [];
    for (const u of this.units) {
      if (!u.active) continue;
      if (u.officer.deployed && u.officer.hp > 0) {
        list.push({ id: u.officer.id, x: u.officer.x, y: u.officer.y, z: u.officer.z, radius: 0.9 });
      }
      if (!u.stolen && u.hp > 0) {
        list.push({ id: u.id, x: u.x, y: u.y, z: u.z, radius: 2.2 });
      }
    }
    return list;
  }

  public damageTarget(
    id: string,
    dmg: number,
    onCruiserExploded?: (x: number, y: number, z: number) => void
  ): { killedOfficer: boolean } {
    for (const u of this.units) {
      if (u.officer.id === id && u.officer.deployed && u.officer.hp > 0) {
        u.officer.hp -= dmg;
        if (u.officer.hp <= 0) {
          u.officer.deployed = false;
          u.officer.root.visible = false;
          this.addCrimeHeat(75);
          return { killedOfficer: true };
        }
        return { killedOfficer: false };
      }
      if (u.id === id && !u.stolen && !u.exploded && u.hp > 0) {
        u.hp = Math.max(0, u.hp - dmg);
        this.addCrimeHeat(35);
        if (u.hp <= 0) {
          u.exploded = true;
          u.speed = 0;
          u.rig.setCharred(true);
          if (onCruiserExploded) onCruiserExploded(u.x, u.y, u.z);
        } else if (!u.officer.deployed) {
          u.officer.deployed = true;
          u.officer.x = u.x + Math.cos(u.heading) * 2.2;
          u.officer.z = u.z - Math.sin(u.heading) * 2.2;
          u.officer.y = groundHeightAt(u.officer.x, u.officer.z);
          u.officer.root.visible = true;
          u.speed = 0;
        }
        return { killedOfficer: false };
      }
    }
    return { killedOfficer: false };
  }

  private getDesiredPoliceCount(): number {
    // 1 Star -> 1 car | 2-3 Stars -> 2 cars | 4-5 Stars -> 3 cars (balanced!)
    if (this.stars <= 0) return 0;
    if (this.stars === 1) return 1;
    if (this.stars <= 3) return 2;
    return 3;
  }

  private spawnUnitOutOfView(u: PoliceUnit, px: number, pz: number, camDirX: number, camDirZ: number): void {
    const side = Math.random() > 0.5 ? 1 : -1;
    const spawnDist = 88 + Math.random() * 35;
    const rawX = px - camDirX * spawnDist + -camDirZ * side * 32;
    const rawZ = pz - camDirZ * spawnDist + camDirX * side * 32;

    const snappedX = Math.round(rawX / 40) * 40;
    const snappedZ = Math.round(rawZ / 40) * 40;
    const useXRoad = Math.random() > 0.5;
    u.x = THREE.MathUtils.clamp(useXRoad ? rawX : snappedX, -340, 340);
    u.z = THREE.MathUtils.clamp(useXRoad ? snappedZ : rawZ, -265, 290);
    u.y = groundHeightAt(u.x, u.z);
    u.heading = Math.atan2(px - u.x, pz - u.z);
    u.speed = 18;
    u.vx = Math.sin(u.heading) * u.speed;
    u.vz = Math.cos(u.heading) * u.speed;
    u.hp = 100;
    u.exploded = false;
    u.stolen = false;
    u.rig.resetDamage();
    u.lastKnownX = px;
    u.lastKnownZ = pz;
    u.active = true;
    u.rig.root.visible = true;
    u.officer.deployed = false;
    u.officer.hp = 70;
    u.officer.root.visible = false;
  }

  public applyCruiserDamage(
    u: PoliceUnit,
    amount: number,
    onExploded: (x: number, y: number, z: number) => void
  ): void {
    if (u.exploded || u.stolen || amount <= 0) return;
    u.hp = Math.max(0, u.hp - amount);
    if (u.hp <= 0) {
      u.exploded = true;
      u.speed = 0;
      u.rig.setCharred(true);
      onExploded(u.x, u.y, u.z);
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerInVehicle: boolean,
    camDirX: number,
    camDirZ: number,
    colliders: ColliderBox[],
    isNight: boolean,
    onPlayerRamDamage: (dmg: number) => void,
    onOfficerFire: (
      ox: number,
      oy: number,
      oz: number,
      dx: number,
      dy: number,
      dz: number,
      hitPlayer: boolean
    ) => void,
    onWantedEvaded?: () => void
  ): void {
    this.strobeTimer += dt;
    this.nearestPoliceDist = 9999;

    if (this.stars === 0) {
      return;
    }

    const desiredCount = this.getDesiredPoliceCount();
    let anyUnitHasSight = false;

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (i < desiredCount) {
        if (!u.active) {
          this.spawnUnitOutOfView(u, playerX, playerZ, camDirX, camDirZ);
        }
      } else if (u.active) {
        u.active = false;
        u.rig.root.visible = false;
        u.officer.deployed = false;
        u.officer.root.visible = false;
        continue;
      }

      if (!u.active) continue;

      const dx = playerX - u.x;
      const dz = playerZ - u.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this.nearestPoliceDist) this.nearestPoliceDist = dist;

      const sightRange = 70 + this.stars * 10;
      if (dist < sightRange) {
        anyUnitHasSight = true;
        u.lastKnownX = playerX;
        u.lastKnownZ = playerZ;
      } else if (dist > 260 && !this.isSearching) {
        this.spawnUnitOutOfView(u, playerX, playerZ, camDirX, camDirZ);
      }

      // Deploy officer on foot if cruiser gets close to an on-foot player (or cruiser disabled)
      if (!u.stolen && !u.officer.deployed && u.officer.hp > 0) {
        if ((!playerInVehicle && dist < 21) || u.hp <= 25) {
          u.officer.deployed = true;
          u.officer.x = u.x + Math.cos(u.heading) * 2.1;
          u.officer.z = u.z - Math.sin(u.heading) * 2.1;
          u.officer.y = groundHeightAt(u.officer.x, u.officer.z);
          u.officer.heading = Math.atan2(playerX - u.officer.x, playerZ - u.officer.z);
          u.officer.root.visible = true;
          u.officer.fireCooldown = 0.8 + Math.random() * 0.5;
          u.speed = 0;
        }
      }

      // Officer on-foot AI: pursue & shoot back!
      if (u.officer.deployed && u.officer.hp > 0) {
        const odx = playerX - u.officer.x;
        const odz = playerZ - u.officer.z;
        const oDist = Math.hypot(odx, odz);
        if (oDist < this.nearestPoliceDist) this.nearestPoliceDist = oDist;
        if (oDist < sightRange) anyUnitHasSight = true;

        u.officer.heading = Math.atan2(odx, odz);
        // Re-board cruiser if player speeds away
        if (!u.stolen && oDist > 42 && u.hp > 25) {
          u.officer.deployed = false;
          u.officer.root.visible = false;
        } else {
          // Move closer if > 13m away, stop and shoot if within 28m
          if (oDist > 13) {
            const moveSpd = 4.6;
            const nx = u.officer.x + (odx / (oDist || 1)) * moveSpd * dt;
            const nz = u.officer.z + (odz / (oDist || 1)) * moveSpd * dt;
            const oCol = resolveCircleColliders(nx, nz, u.officer.y, 0.4, colliders);
            u.officer.x = oCol.x;
            u.officer.z = oCol.z;
            u.officer.y = groundHeightAt(u.officer.x, u.officer.z);
            u.officer.walkPhase += dt * 10;
            const sw = Math.sin(u.officer.walkPhase) * 0.5;
            u.officer.leftLeg.rotation.x = sw;
            u.officer.rightLeg.rotation.x = -sw;
          } else {
            u.officer.leftLeg.rotation.x = 0;
            u.officer.rightLeg.rotation.x = 0;
          }

          u.officer.root.position.set(u.officer.x, u.officer.y, u.officer.z);
          u.officer.root.rotation.y = u.officer.heading;

          u.officer.fireCooldown -= dt;
          if (u.officer.fireCooldown <= 0 && oDist < 34) {
            u.officer.fireCooldown = Math.max(0.75, 1.65 - this.stars * 0.16);
            const len = Math.hypot(odx, playerY - u.officer.y, odz) || 1;
            const spread = 0.08;
            const dirX = odx / len + (Math.random() - 0.5) * spread;
            const dirY = (playerY + 1.0 - (u.officer.y + 1.2)) / len;
            const dirZ = odz / len + (Math.random() - 0.5) * spread;
            const hitChance = playerInVehicle ? 0.25 : 0.52;
            onOfficerFire(
              u.officer.x,
              u.officer.y + 1.2,
              u.officer.z,
              dirX,
              dirY,
              dirZ,
              Math.random() < hitChance
            );
          }
        }
      }

      if (u.stolen) continue;

      // Vehicle driving pursuit when officer is inside and cruiser is intact
      if (!u.officer.deployed && !u.exploded) {
        const desiredHeading = Math.atan2(u.lastKnownX - u.x, u.lastKnownZ - u.z);
        let angleDiff = desiredHeading - u.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        u.heading += THREE.MathUtils.clamp(angleDiff, -2.6 * dt, 2.6 * dt);

        const maxChaseSpeed = 20 + this.stars * 3.4;
        const desiredSpeed = dist > 9 ? maxChaseSpeed : 0;
        u.speed = THREE.MathUtils.damp(u.speed, desiredSpeed, 3.4, dt);
        u.vx = Math.sin(u.heading) * u.speed;
        u.vz = Math.cos(u.heading) * u.speed;

        const nextX = THREE.MathUtils.clamp(u.x + u.vx * dt, -380, 380);
        const nextZ = THREE.MathUtils.clamp(u.z + u.vz * dt, -460, 325);
        const col = resolveCircleColliders(nextX, nextZ, u.y, 1.35, colliders);
        if (col.hit) {
          u.heading += 0.9 * dt * 10;
          u.speed *= 0.55;
        }
        u.x = col.x;
        u.z = col.z;
        u.y = groundHeightAt(u.x, u.z);

        u.ramCooldown = Math.max(0, u.ramCooldown - dt);
        if (dist < 3.4 && Math.abs(playerY - u.y) < 3 && u.ramCooldown <= 0 && u.speed > 5) {
          u.ramCooldown = 1.8;
          onPlayerRamDamage(6 + this.stars * 2);
        }
      } else {
        u.speed = THREE.MathUtils.damp(u.speed, 0, 7, dt);
        u.vx = 0;
        u.vz = 0;
      }

      u.rig.root.position.set(u.x, u.y, u.z);
      u.rig.root.rotation.y = u.heading;
      const spin = (u.speed * dt) / u.rig.spec.wheelRadius;
      u.rig.wheelSpinMeshes.forEach((w) => {
        w.rotation.x += spin;
      });
      u.rig.headlightMeshes.forEach((h) => {
        (h.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 2.5 : 1.1;
      });
      const strobe = Math.floor(this.strobeTimer * 8 + i) % 2 === 0;
      if (u.rig.lightbarRed) {
        (u.rig.lightbarRed.material as THREE.MeshStandardMaterial).emissiveIntensity = strobe ? 4.0 : 0.2;
      }
      if (u.rig.lightbarBlue) {
        (u.rig.lightbarBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = !strobe ? 4.0 : 0.2;
      }
    }

    if (anyUnitHasSight) {
      this.isSearching = false;
      this.evadeTimer = Math.max(0, this.evadeTimer - dt * 2);
    } else {
      this.isSearching = true;
      this.evadeTimer += dt;
      if (this.evadeTimer >= this.evadeDuration) {
        this.clearWanted();
        if (onWantedEvaded) onWantedEvaded();
      }
    }
  }

  public dispose(): void {
    this.units.forEach((u) => {
      this.scene.remove(u.rig.root);
      this.scene.remove(u.officer.root);
      u.rig.dispose();
    });
    this.disposables.forEach((d) => d.dispose());
  }
}
