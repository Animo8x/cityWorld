import * as THREE from 'three';
import { getSnowSurfaceY, isPointOnRoad, WATER_LEVEL } from '../world/worldLayout';

interface FootprintEntry {
  active: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  age: number;
  maxAge: number;
}

const MAX_FOOTPRINTS = 180;
const STEP_SPACING = 0.66;
const FOOT_OFFSET_X = 0.14;

export class SnowFootprintSystem {
  private mesh: THREE.InstancedMesh;
  private entries: FootprintEntry[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();

  private hasAnchor = false;
  private wasOnGround = true;
  private lastStepX = 0;
  private lastStepZ = 0;
  private stepSide = 1;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.19, 0.036, 0.34);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.92,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FOOTPRINTS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);

    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
      this.entries.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        age: 0,
        maxAge: 22,
      });
    }
  }

  private placeSinglePrint(fx: number, fz: number, playerY: number, heading: number): void {
    if (isPointOnRoad(fx, fz)) return;
    const sy = getSnowSurfaceY(fx, fz);
    if (sy <= WATER_LEVEL + 0.05) return;
    if (Math.abs(playerY - sy) > 0.85) return;

    const slot = this.entries[this.cursor];
    slot.active = true;
    slot.x = fx;
    slot.y = sy + 0.022;
    slot.z = fz;
    slot.heading = heading;
    slot.age = 0;
    slot.maxAge = 22;

    this.cursor = (this.cursor + 1) % MAX_FOOTPRINTS;
  }

  public stampLandingPair(px: number, py: number, pz: number, heading: number, snowAmount: number): void {
    if (snowAmount < 0.25) return;
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    this.placeSinglePrint(px - rightX * FOOT_OFFSET_X, pz - rightZ * FOOT_OFFSET_X, py, heading);
    this.placeSinglePrint(px + rightX * FOOT_OFFSET_X, pz + rightZ * FOOT_OFFSET_X, py, heading);
  }

  public clear(): void {
    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
      this.entries[i].active = false;
    }
    this.hasAnchor = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  public update(
    dt: number,
    player: {
      x: number;
      y: number;
      z: number;
      heading: number;
      onGround: boolean;
      inInterior: boolean;
      isSwimming: boolean;
      inVehicle: boolean;
    },
    snowAmount: number
  ): void {
    const canTrack =
      snowAmount > 0.25 &&
      !player.inVehicle &&
      !player.inInterior &&
      !player.isSwimming &&
      player.onGround;

    if (canTrack) {
      if (!this.wasOnGround) {
        this.stampLandingPair(player.x, player.y, player.z, player.heading, snowAmount);
        this.lastStepX = player.x;
        this.lastStepZ = player.z;
        this.hasAnchor = true;
      } else if (!this.hasAnchor) {
        this.lastStepX = player.x;
        this.lastStepZ = player.z;
        this.hasAnchor = true;
      } else {
        const dist = Math.hypot(player.x - this.lastStepX, player.z - this.lastStepZ);
        if (dist >= STEP_SPACING) {
          this.lastStepX = player.x;
          this.lastStepZ = player.z;
          this.stepSide = -this.stepSide;
          const rightX = Math.cos(player.heading);
          const rightZ = -Math.sin(player.heading);
          const fx = player.x + rightX * (this.stepSide * FOOT_OFFSET_X);
          const fz = player.z + rightZ * (this.stepSide * FOOT_OFFSET_X);
          this.placeSinglePrint(fx, fz, player.y, player.heading);
        }
      }
    } else {
      this.hasAnchor = false;
    }
    this.wasOnGround = player.onGround;

    // Age and render active snow footprints
    let activeIdx = 0;
    const meltSpeed = snowAmount < 0.2 ? 6.0 : 1.0;
    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
      const e = this.entries[i];
      if (!e.active) continue;
      e.age += dt * meltSpeed;
      if (e.age >= e.maxAge) {
        e.active = false;
        continue;
      }

      const lifeLeft = e.maxAge - e.age;
      const fadeScale = lifeLeft < 3.0 ? Math.max(0.05, lifeLeft / 3.0) : 1.0;
      const snowScale = Math.min(1, snowAmount * 1.4);
      const s = fadeScale * snowScale;

      this.dummy.position.set(e.x, e.y, e.z);
      this.dummy.rotation.set(0, e.heading, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(activeIdx++, this.dummy.matrix);
    }

    this.mesh.count = activeIdx;
    this.mesh.visible = activeIdx > 0;
    if (activeIdx > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
