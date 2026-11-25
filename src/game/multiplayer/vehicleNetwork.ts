import * as THREE from 'three';
import { applyRobotTransformToRig, buildVehicleMesh, type VehicleRig } from '../vehicles/vehicleMesh';
import { isRobotCarClass } from '../vehicles/vehiclePhysics';
import { SnapshotInterpolator } from './networkInterpolation';
import type { SharedVehicleState } from './protocol';

export interface RemoteVehicleVisual {
  id: string;
  rig: VehicleRig;
  state: SharedVehicleState;
  interpolator: SnapshotInterpolator;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  wheelAngle: number;
  signalTimer: number;
}

export class VehicleNetworkSystem {
  private scene: THREE.Scene;
  private vehicles = new Map<string, RemoteVehicleVisual>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public getVehicle(id: string): RemoteVehicleVisual | undefined {
    return this.vehicles.get(id);
  }

  public getAllVehicles(): RemoteVehicleVisual[] {
    return Array.from(this.vehicles.values());
  }

  public syncAll(
    states: SharedVehicleState[],
    receiveTimeMs: number,
    localActiveVehicleId: string | null
  ): void {
    const seen = new Set<string>();
    for (const s of states) {
      // Do not overwrite/ghost a vehicle currently driven locally
      if (s.id === localActiveVehicleId && s.driverId !== null) {
        const existing = this.vehicles.get(s.id);
        if (existing) {
          existing.state = { ...s };
          existing.rig.root.visible = false;
        }
        seen.add(s.id);
        continue;
      }

      seen.add(s.id);
      let vis = this.vehicles.get(s.id);
      if (!vis || vis.state.classId !== s.classId) {
        if (vis) {
          this.scene.remove(vis.rig.root);
          vis.rig.dispose();
        }
        const rig = buildVehicleMesh(s.classId, s.colorHex, false);
        rig.root.position.set(s.x, s.y, s.z);
        rig.root.rotation.y = s.heading;
        this.scene.add(rig.root);

        const interpolator = new SnapshotInterpolator(95);
        interpolator.reset({
          t: receiveTimeMs,
          x: s.x,
          y: s.y,
          z: s.z,
          heading: s.heading,
          pitch: s.pitch,
          roll: s.roll,
          vx: s.vx,
          vz: s.vz,
        });

        vis = {
          id: s.id,
          rig,
          state: { ...s },
          interpolator,
          x: s.x,
          y: s.y,
          z: s.z,
          heading: s.heading,
          pitch: s.pitch,
          roll: s.roll,
          wheelAngle: 0,
          signalTimer: 0,
        };
        this.vehicles.set(s.id, vis);
      } else {
        vis.rig.root.visible = true;
        vis.state = { ...s };
        vis.interpolator.push({
          t: receiveTimeMs,
          x: s.x,
          y: s.y,
          z: s.z,
          heading: s.heading,
          pitch: s.pitch,
          roll: s.roll,
          vx: s.vx,
          vz: s.vz,
        });
      }
    }

    for (const id of Array.from(this.vehicles.keys())) {
      if (!seen.has(id)) {
        this.removeVehicle(id);
      }
    }
  }

  public removeVehicle(id: string): void {
    const v = this.vehicles.get(id);
    if (!v) return;
    this.vehicles.delete(id);
    this.scene.remove(v.rig.root);
    v.rig.dispose();
  }

  public clearAll(): void {
    for (const id of Array.from(this.vehicles.keys())) {
      this.removeVehicle(id);
    }
  }

  public update(dt: number, nowMs: number, isNight: boolean): void {
    for (const v of this.vehicles.values()) {
      if (!v.rig.root.visible) continue;
      const sampled = v.interpolator.sample(nowMs);
      if (sampled) {
        v.x = sampled.x;
        v.y = sampled.y;
        v.z = sampled.z;
        v.heading = sampled.heading;
        v.pitch = sampled.pitch ?? 0;
        v.roll = sampled.roll ?? 0;
      }

      v.rig.root.position.set(v.x, v.y, v.z);
      v.rig.root.rotation.order = 'YXZ';
      v.rig.root.rotation.y = v.heading;
      v.rig.root.rotation.x = v.pitch;
      v.rig.root.rotation.z = v.roll;

      // Wheel spin + front wheel steering (or Transforming Robot Car walking animation)
      const speed = v.state.forwardSpeed;
      if (isRobotCarClass(v.state.classId)) {
        const rp = v.state.wingProgress;
        const walkPhase = Math.abs(speed) > 0.6 ? v.signalTimer * (4.5 + Math.abs(speed) * 0.45) : 0;
        applyRobotTransformToRig(v.rig, rp, walkPhase, 0, false);
        if (rp <= 0.2) {
          const wr = Math.max(0.25, v.rig.spec.wheelRadius);
          v.wheelAngle += (speed / wr) * dt;
          for (let i = 0; i < v.rig.wheelSpinMeshes.length; i++) {
            v.rig.wheelSpinMeshes[i].rotation.x = v.wheelAngle;
          }
          if (v.rig.wheelPivots.length >= 2) {
            v.rig.wheelPivots[0].rotation.y = v.state.steerAngle;
            v.rig.wheelPivots[1].rotation.y = v.state.steerAngle;
          }
        }
      } else {
        const wr = Math.max(0.25, v.rig.spec.wheelRadius);
        v.wheelAngle += (speed / wr) * dt;
        for (let i = 0; i < v.rig.wheelSpinMeshes.length; i++) {
          v.rig.wheelSpinMeshes[i].rotation.x = v.wheelAngle;
        }
        if (v.rig.wheelPivots.length >= 2) {
          v.rig.wheelPivots[0].rotation.y = v.state.steerAngle;
          v.rig.wheelPivots[1].rotation.y = v.state.steerAngle;
        }
      }

      // Airplane propeller & deployable golden wings
      if (v.rig.propellerPivot) {
        v.rig.propellerPivot.rotation.z += dt * (4 + Math.abs(speed) * 0.75);
      }
      if (v.rig.wingLeftPivot && v.rig.wingRightPivot) {
        const wp = THREE.MathUtils.clamp(v.state.wingProgress, 0, 1);
        const foldAngle = 1.48 * (1 - wp);
        v.rig.wingLeftPivot.visible = true;
        v.rig.wingRightPivot.visible = true;
        v.rig.wingLeftPivot.scale.set(1, 1, 1);
        v.rig.wingRightPivot.scale.set(1, 1, 1);
        v.rig.wingLeftPivot.rotation.y = foldAngle;
        v.rig.wingLeftPivot.rotation.z = -wp * 0.07;
        v.rig.wingRightPivot.rotation.y = -foldAngle;
        v.rig.wingRightPivot.rotation.z = wp * 0.07;
      }
      if (v.rig.thrusterGlowMat) {
        v.rig.thrusterGlowMat.emissiveIntensity = v.state.wingsDeployed
          ? 2.2 + Math.min(1.5, Math.abs(speed) * 0.04)
          : 0.25;
      }

      // Headlights & turn signals
      const headOn = v.state.headlightsOn || isNight;
      for (const hm of v.rig.headlightMeshes) {
        (hm.material as THREE.MeshStandardMaterial).emissiveIntensity = headOn ? 2.2 : 0.15;
      }
      v.signalTimer += dt;
      const blink = Math.floor(v.signalTimer * 2.8) % 2 === 0;
      (v.rig.leftSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        v.state.turnSignal === -1 && blink ? 2.6 : 0;
      (v.rig.rightSignalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        v.state.turnSignal === 1 && blink ? 2.6 : 0;
    }
  }

  public dispose(): void {
    this.clearAll();
  }
}
