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

export interface PoliceJet {
  id: string;
  root: THREE.Group;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  beaconMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  active: boolean;
  fireCooldown: number;
  orbitSign: number;
  altitudeOffset: number;
  breakingAway: boolean;
}

export class WantedSystem {
  public stars = 0;
  public heatScore = 0;
  public evadeTimer = 0;
  public evadeDuration = 20; // 20 seconds escape timer when distanced from police
  public isSearching = false;
  public nearestPoliceDist = 9999;

  public units: PoliceUnit[] = [];
  public jets: PoliceJet[] = [];
  private scene: THREE.Scene;
  private strobeTimer = 0;
  private poolSize = 6; // Supports 1 (1★), 4 (2★ = 2x), 5 (3-4★ realistic), 6 (5★)
  private jetPoolSize = 3; // Supports 2 Fighter Jets at 4★ and 3 at 5★
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

    // Shared Military Fighter Jet geometries & materials (4-5 Stars Air Support)
    const jetBodyGeo = new THREE.BoxGeometry(1.35, 0.95, 7.6);
    const jetNoseGeo = new THREE.ConeGeometry(0.68, 2.8, 6);
    jetNoseGeo.rotateX(Math.PI / 2);
    const jetCanopyGeo = new THREE.BoxGeometry(0.76, 0.55, 2.2);
    const jetWingGeo = new THREE.BoxGeometry(8.6, 0.14, 2.6);
    const jetTailWingGeo = new THREE.BoxGeometry(4.0, 0.12, 1.3);
    const jetFinGeo = new THREE.BoxGeometry(0.14, 1.45, 1.4);
    const jetPodGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.7, 6);
    jetPodGeo.rotateX(Math.PI / 2);
    const jetNozzleGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.85, 8);
    jetNozzleGeo.rotateX(Math.PI / 2);
    const jetFlameGeo = new THREE.ConeGeometry(0.32, 1.8, 8);
    jetFlameGeo.rotateX(-Math.PI / 2);
    const jetBeaconGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);

    const jetHullMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 });
    const jetTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 });
    const jetCanopyMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.7,
    });
    const jetMissileMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
    const jetFlameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const jetBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.5,
    });

    this.disposables.push(
      jetBodyGeo,
      jetNoseGeo,
      jetCanopyGeo,
      jetWingGeo,
      jetTailWingGeo,
      jetFinGeo,
      jetPodGeo,
      jetNozzleGeo,
      jetFlameGeo,
      jetBeaconGeo,
      jetHullMat,
      jetTrimMat,
      jetCanopyMat,
      jetMissileMat,
      jetFlameMat,
      jetBeaconMat
    );

    for (let i = 0; i < this.jetPoolSize; i++) {
      const jetRoot = new THREE.Group();
      const body = new THREE.Mesh(jetBodyGeo, jetHullMat);
      const nose = new THREE.Mesh(jetNoseGeo, jetTrimMat);
      nose.position.set(0, -0.05, 5.1);

      const canopy = new THREE.Mesh(jetCanopyGeo, jetCanopyMat);
      canopy.position.set(0, 0.62, 1.5);

      const wings = new THREE.Mesh(jetWingGeo, jetHullMat);
      wings.position.set(0, -0.08, -0.4);

      const tailWing = new THREE.Mesh(jetTailWingGeo, jetTrimMat);
      tailWing.position.set(0, 0.05, -3.2);

      const finL = new THREE.Mesh(jetFinGeo, jetTrimMat);
      finL.position.set(-0.55, 0.85, -3.1);
      finL.rotation.z = 0.24;

      const finR = new THREE.Mesh(jetFinGeo, jetTrimMat);
      finR.position.set(0.55, 0.85, -3.1);
      finR.rotation.z = -0.24;

      const podL = new THREE.Mesh(jetPodGeo, jetMissileMat);
      podL.position.set(-2.35, -0.24, 0.1);
      const podR = new THREE.Mesh(jetPodGeo, jetMissileMat);
      podR.position.set(2.35, -0.24, 0.1);

      const nozzleL = new THREE.Mesh(jetNozzleGeo, darkMat);
      nozzleL.position.set(-0.36, -0.05, -4.0);
      const nozzleR = new THREE.Mesh(jetNozzleGeo, darkMat);
      nozzleR.position.set(0.36, -0.05, -4.0);

      const thrusterLeft = new THREE.Mesh(jetFlameGeo, jetFlameMat);
      thrusterLeft.position.set(-0.36, -0.05, -5.25);
      const thrusterRight = new THREE.Mesh(jetFlameGeo, jetFlameMat);
      thrusterRight.position.set(0.36, -0.05, -5.25);

      const beaconMesh = new THREE.Mesh(jetBeaconGeo, jetBeaconMat);
      beaconMesh.position.set(0, 0.6, -2.5);

      jetRoot.add(
        body,
        nose,
        canopy,
        wings,
        tailWing,
        finL,
        finR,
        podL,
        podR,
        nozzleL,
        nozzleR,
        thrusterLeft,
        thrusterRight,
        beaconMesh
      );
      jetRoot.visible = false;
      scene.add(jetRoot);

      this.jets.push({
        id: `military_jet_${i}`,
        root: jetRoot,
        thrusterLeft,
        thrusterRight,
        beaconMesh,
        x: 0,
        y: 60,
        z: 0,
        heading: 0,
        speed: 58,
        active: false,
        fireCooldown: 2.2 + i * 1.1,
        orbitSign: i % 2 === 0 ? 1 : -1,
        altitudeOffset: 38 + i * 6,
        breakingAway: false,
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
    for (const j of this.jets) {
      j.active = false;
      j.root.visible = false;
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

  public getDesiredPoliceCount(): number {
    // 1★ -> 1 car (same as classic)
    // 2★ -> 4 cars (2x classic 2-star count)
    // 3★ -> 5 cars (balanced realistic escalation)
    // 4★ -> 5 cars (+ 2 military fighter jets)
    // 5★ -> 6 cars (+ 3 military fighter jets)
    if (this.stars <= 0) return 0;
    if (this.stars === 1) return 1;
    if (this.stars === 2) return 4;
    if (this.stars <= 4) return 5;
    return 6;
  }

  public getDesiredJetCount(): number {
    if (this.stars < 4) return 0;
    if (this.stars === 4) return 2;
    return 3;
  }

  public getChaseMaxSpeed(): number {
    // 1★ & 2★ keep exact classic speed; 3★+ starts realistic faster pursuit
    if (this.stars <= 1) return 23.4;
    if (this.stars === 2) return 26.8;
    if (this.stars === 3) return 35.5;
    if (this.stars === 4) return 39.0;
    return 42.5;
  }

  public getJetRpgHitProbability(): number {
    if (this.stars < 4) return 0;
    return this.stars >= 5 ? 0.02 : 0.012;
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

  private spawnJetInSky(j: PoliceJet, idx: number, px: number, py: number, pz: number): void {
    const angle = (idx / this.jetPoolSize) * Math.PI * 2 + Math.random() * 0.6;
    const spawnDist = 145 + idx * 24;
    j.x = px + Math.cos(angle) * spawnDist;
    j.z = pz + Math.sin(angle) * spawnDist;
    j.y = Math.max(groundHeightAt(j.x, j.z), py) + j.altitudeOffset;
    j.heading = Math.atan2(px - j.x, pz - j.z);
    j.speed = this.stars >= 5 ? 62 : 56;
    j.fireCooldown = 1.6 + idx * 1.15;
    j.breakingAway = false;
    j.active = true;
    j.root.visible = true;
    j.root.position.set(j.x, j.y, j.z);
    j.root.rotation.set(0, j.heading, 0);
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
    onWantedEvaded?: () => void,
    onJetFireRpg?: (
      ox: number,
      oy: number,
      oz: number,
      isDirectHit: boolean,
      targetX: number,
      targetY: number,
      targetZ: number
    ) => void
  ): void {
    this.strobeTimer += dt;
    this.nearestPoliceDist = 9999;

    if (this.stars === 0) {
      return;
    }

    const desiredCount = this.getDesiredPoliceCount();
    const desiredJetCount = this.getDesiredJetCount();
    const maxChaseSpeed = this.getChaseMaxSpeed();
    const steerRate = this.stars >= 3 ? 3.15 : 2.6;
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
        u.heading += THREE.MathUtils.clamp(angleDiff, -steerRate * dt, steerRate * dt);

        const desiredSpeed = dist > 9 ? maxChaseSpeed : 0;
        u.speed = THREE.MathUtils.damp(u.speed, desiredSpeed, this.stars >= 3 ? 4.0 : 3.4, dt);
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
          u.ramCooldown = this.stars >= 3 ? 1.45 : 1.8;
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

    // Military Fighter Jets (Stars 4 & 5 Air Strikes with RPG Missiles)
    const jetHitProb = this.getJetRpgHitProbability();
    for (let i = 0; i < this.jets.length; i++) {
      const jet = this.jets[i];
      if (i < desiredJetCount) {
        if (!jet.active) {
          this.spawnJetInSky(jet, i, playerX, playerY, playerZ);
        }
      } else if (jet.active) {
        jet.active = false;
        jet.root.visible = false;
        continue;
      }

      if (!jet.active) continue;

      const jdx = playerX - jet.x;
      const jdz = playerZ - jet.z;
      const jDist = Math.hypot(jdx, jdz);

      // Jets maintain air visual lock if within 190m; speeding beyond lets evade timer tick
      if (jDist < 190) {
        anyUnitHasSight = true;
      } else if (jDist > 360 && !this.isSearching) {
        this.spawnJetInSky(jet, i, playerX, playerY, playerZ);
      }

      // Approach -> Fire RPG Pass -> Breakaway to 125m -> Turn back for next attack pass
      if (!jet.breakingAway && jDist < 34) {
        jet.breakingAway = true;
      } else if (jet.breakingAway && jDist >= 125) {
        jet.breakingAway = false;
      }

      const baseTargetHeading = Math.atan2(jdx, jdz);
      const desiredHeading = jet.breakingAway
        ? baseTargetHeading + Math.PI + jet.orbitSign * 0.35
        : baseTargetHeading;
      let angleDiff = desiredHeading - jet.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const turn = THREE.MathUtils.clamp(angleDiff, -2.0 * dt, 2.0 * dt);
      jet.heading += turn;

      jet.speed = THREE.MathUtils.damp(jet.speed, this.stars >= 5 ? 62 : 56, 2.5, dt);
      jet.x += Math.sin(jet.heading) * jet.speed * dt;
      jet.z += Math.cos(jet.heading) * jet.speed * dt;

      const targetAlt = Math.max(groundHeightAt(jet.x, jet.z), playerY) + jet.altitudeOffset;
      const diveDip = !jet.breakingAway && jDist < 120 && jDist > 34 ? -6.5 : 0;
      jet.y = THREE.MathUtils.damp(jet.y, targetAlt + diveDip, 2.4, dt);

      jet.root.position.set(jet.x, jet.y, jet.z);
      const bankRoll = THREE.MathUtils.clamp(-turn / Math.max(0.001, dt) * 0.42, -0.68, 0.68);
      const pitch = diveDip < 0 ? 0.14 : -0.04;
      jet.root.rotation.set(pitch, jet.heading, bankRoll, 'YXZ');

      const flamePulse = 0.85 + Math.sin(this.strobeTimer * 35 + i) * 0.25;
      jet.thrusterLeft.scale.set(1, flamePulse, 1);
      jet.thrusterRight.scale.set(1, flamePulse, 1);
      const strobe = Math.floor(this.strobeTimer * 6 + i) % 2 === 0;
      (jet.beaconMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = strobe ? 3.2 : 0.3;

      // Fire RPG missile during approach attack passes (1.2% hit chance at 4★, 2% hit chance at 5★)
      jet.fireCooldown -= dt;
      if (!jet.breakingAway && jet.fireCooldown <= 0 && jDist >= 34 && jDist <= 155) {
        const fwdDot =
          (Math.sin(jet.heading) * jdx + Math.cos(jet.heading) * jdz) / Math.max(1, jDist);
        if (fwdDot > 0.45) {
          jet.fireCooldown = this.stars >= 5 ? 2.5 + Math.random() * 1.2 : 3.3 + Math.random() * 1.4;
          const isDirectHit = Math.random() < jetHitProb;
          if (onJetFireRpg) {
            onJetFireRpg(jet.x, jet.y - 1.1, jet.z, isDirectHit, playerX, playerY, playerZ);
          }
        } else {
          jet.fireCooldown = 0.35;
        }
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
    this.jets.forEach((j) => {
      this.scene.remove(j.root);
    });
    this.disposables.forEach((d) => d.dispose());
  }
}
