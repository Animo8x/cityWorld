import * as THREE from 'three';
import { VehicleClassId } from '../types';
import { TRAFFIC_VEHICLE_POOL_TYPES } from '../vehicles/vehicleCatalog';
import { buildVehicleMesh, VehicleRig } from '../vehicles/vehicleMesh';
import { isBicycleClass } from '../vehicles/vehiclePhysics';
import { getBridgeDeckHeight, groundHeightAt, TRAFFIC_INTERSECTIONS } from '../world/worldLayout';

interface TrafficLaneLoop {
  axis: 'x' | 'z';
  fixedCoord: number;
  dir: 1 | -1;
  min: number;
  max: number;
  speedLimit: number;
}

export interface TrafficAgent {
  id: string;
  classId: VehicleClassId;
  colorHex: number;
  rig: VehicleRig;
  lane: TrafficLaneLoop;
  posAlong: number;
  speed: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  spinVel: number;
  knockedTimer: number;
  hp: number;
  exploded: boolean;
  braking: boolean;
}

const LANE_LOOPS: TrafficLaneLoop[] = [
  // East-West avenues
  { axis: 'x', fixedCoord: -120 + 3.5, dir: 1, min: -340, max: 340, speedLimit: 15 },
  { axis: 'x', fixedCoord: -120 - 3.5, dir: -1, min: -340, max: 340, speedLimit: 15 },
  { axis: 'x', fixedCoord: -40 + 3.5, dir: 1, min: -340, max: 340, speedLimit: 13 },
  { axis: 'x', fixedCoord: -40 - 3.5, dir: -1, min: -340, max: 340, speedLimit: 13 },
  { axis: 'x', fixedCoord: 40 + 3.5, dir: 1, min: -340, max: 340, speedLimit: 13 },
  { axis: 'x', fixedCoord: 40 - 3.5, dir: -1, min: -340, max: 340, speedLimit: 13 },
  { axis: 'x', fixedCoord: 120 + 3.5, dir: 1, min: -340, max: 340, speedLimit: 14 },
  { axis: 'x', fixedCoord: 120 - 3.5, dir: -1, min: -340, max: 340, speedLimit: 14 },
  // North-South avenues
  { axis: 'z', fixedCoord: -120 - 3.5, dir: 1, min: -265, max: 285, speedLimit: 14 },
  { axis: 'z', fixedCoord: -120 + 3.5, dir: -1, min: -265, max: 285, speedLimit: 14 },
  { axis: 'z', fixedCoord: -40 - 3.5, dir: 1, min: -265, max: 285, speedLimit: 13 },
  { axis: 'z', fixedCoord: 40 + 3.5, dir: -1, min: -265, max: 285, speedLimit: 13 },
  { axis: 'z', fixedCoord: 120 - 3.5, dir: 1, min: -265, max: 285, speedLimit: 14 },
  { axis: 'z', fixedCoord: 240 + 3.5, dir: -1, min: -265, max: 285, speedLimit: 15 },
  // Fast Ring Expressway lanes (Highway with sports & supercars)
  { axis: 'x', fixedCoord: -265 + 4.5, dir: 1, min: -340, max: 350, speedLimit: 26 },
  { axis: 'x', fixedCoord: -265 - 4.5, dir: -1, min: -340, max: 350, speedLimit: 26 },
  { axis: 'x', fixedCoord: 290 + 4.0, dir: 1, min: -350, max: 350, speedLimit: 23 },
  { axis: 'x', fixedCoord: 290 - 4.0, dir: -1, min: -350, max: 350, speedLimit: 23 },
];

export class TrafficSystem {
  public agents: TrafficAgent[] = [];
  private scene: THREE.Scene;
  private activeLimit: number;

  constructor(scene: THREE.Scene, maxPool = 36) {
    this.scene = scene;
    this.activeLimit = maxPool;

    for (let i = 0; i < maxPool; i++) {
      const classId = TRAFFIC_VEHICLE_POOL_TYPES[i % TRAFFIC_VEHICLE_POOL_TYPES.length];
      const rig = buildVehicleMesh(classId, undefined, false);
      const colorHex = rig.paintMat.color.getHex();
      const lane = LANE_LOOPS[i % LANE_LOOPS.length];
      const posAlong = lane.min + ((i * 83) % Math.max(40, lane.max - lane.min));

      const x = lane.axis === 'x' ? posAlong : lane.fixedCoord;
      const z = lane.axis === 'z' ? posAlong : lane.fixedCoord;
      const heading =
        lane.axis === 'x'
          ? lane.dir > 0
            ? Math.PI / 2
            : -Math.PI / 2
          : lane.dir > 0
            ? 0
            : Math.PI;

      const y = groundHeightAt(x, z);
      rig.root.position.set(x, y, z);
      rig.root.rotation.y = heading;
      scene.add(rig.root);

      const isSport =
        classId === 'sports' ||
        classId === 'supercar' ||
        classId === 'muscle' ||
        classId === 'convertible' ||
        classId === 'coupe';
      const initialSpeed =
        classId === 'bicycle'
          ? 7.8
          : classId === 'speed_bicycle'
            ? 10.6
            : lane.speedLimit * (isSport ? 1.1 : 0.78);

      this.agents.push({
        id: `traffic_${i}`,
        classId,
        colorHex,
        rig,
        lane,
        posAlong,
        speed: initialSpeed,
        x,
        y,
        z,
        heading,
        vx: 0,
        vz: 0,
        spinVel: 0,
        knockedTimer: 0,
        hp: 100,
        exploded: false,
        braking: false,
      });
    }
  }

  public setActiveCount(count: number): void {
    this.activeLimit = Math.min(this.agents.length, Math.max(8, count));
    for (let i = 0; i < this.agents.length; i++) {
      if (i >= this.activeLimit) {
        this.agents[i].rig.root.visible = false;
      }
    }
  }

  public findNearestAgent(x: number, z: number, maxDist = 5.2): TrafficAgent | null {
    let best: TrafficAgent | null = null;
    let bestSq = maxDist * maxDist;
    for (let i = 0; i < this.activeLimit; i++) {
      const a = this.agents[i];
      if (a.exploded) continue;
      const dx = a.x - x;
      const dz = a.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestSq) {
        bestSq = d2;
        best = a;
      }
    }
    return best;
  }

  public hijackAgent(agent: TrafficAgent): {
    classId: VehicleClassId;
    colorHex: number;
    x: number;
    z: number;
    heading: number;
    hp: number;
    damage: { front: number; rear: number; left: number; right: number };
  } {
    const snapshot = {
      classId: agent.classId,
      colorHex: agent.colorHex,
      x: agent.x,
      z: agent.z,
      heading: agent.heading,
      hp: agent.hp,
      damage: {
        front: agent.rig.damage.front,
        rear: agent.rig.damage.rear,
        left: agent.rig.damage.left,
        right: agent.rig.damage.right,
      },
    };
    this.resetAgentToLoopEnd(agent);
    return snapshot;
  }

  private resetAgentToLoopEnd(agent: TrafficAgent): void {
    agent.posAlong = agent.lane.dir > 0 ? agent.lane.min : agent.lane.max;
    agent.speed = agent.lane.speedLimit * 0.75;
    agent.heading =
      agent.lane.axis === 'x'
        ? agent.lane.dir > 0
          ? Math.PI / 2
          : -Math.PI / 2
        : agent.lane.dir > 0
          ? 0
          : Math.PI;
    agent.x = agent.lane.axis === 'x' ? agent.posAlong : agent.lane.fixedCoord;
    agent.z = agent.lane.axis === 'z' ? agent.posAlong : agent.lane.fixedCoord;
    agent.vx = 0;
    agent.vz = 0;
    agent.spinVel = 0;
    agent.knockedTimer = 0;
    agent.hp = 100;
    agent.exploded = false;
    agent.rig.bodyGroup.rotation.z = 0;
    agent.rig.resetDamage();
    agent.rig.root.position.set(agent.x, groundHeightAt(agent.x, agent.z), agent.z);
    agent.rig.root.rotation.y = agent.heading;
  }

  public applyDamage(agent: TrafficAgent, amount: number, onExploded: (x: number, y: number, z: number) => void): void {
    if (agent.exploded || amount <= 0) return;
    agent.hp = Math.max(0, agent.hp - amount);
    if (agent.hp <= 0) {
      agent.exploded = true;
      if (isBicycleClass(agent.classId)) {
        agent.rig.bodyGroup.rotation.z = 1.15;
      } else {
        agent.rig.setCharred(true);
      }
      agent.knockedTimer = 10;
      agent.speed = 0;
      onExploded(agent.x, agent.y, agent.z);
    }
  }

  public update(
    dt: number,
    simTime: number,
    isNight: boolean,
    playerX: number,
    playerZ: number,
    playerInVehicle: boolean,
    cullDist: number,
    onPlayerImpact: (intensity: number) => void
  ): void {
    const cullSq = cullDist * cullDist;

    for (let i = 0; i < this.activeLimit; i++) {
      const a = this.agents[i];

      // Handle knocked / crashed traffic physics before returning to lane
      if (a.knockedTimer > 0) {
        a.knockedTimer -= dt;
        a.x += a.vx * dt;
        a.z += a.vz * dt;
        a.heading += a.spinVel * dt;
        a.vx = THREE.MathUtils.damp(a.vx, 0, 2.8, dt);
        a.vz = THREE.MathUtils.damp(a.vz, 0, 2.8, dt);
        a.spinVel = THREE.MathUtils.damp(a.spinVel, 0, 4.5, dt);

        const terrainY = groundHeightAt(a.x, a.z);
        const bridgeY = getBridgeDeckHeight(a.x, a.z);
        a.y = bridgeY !== null ? Math.max(terrainY, bridgeY) : terrainY;

        const dSq = (a.x - playerX) ** 2 + (a.z - playerZ) ** 2;
        if (a.knockedTimer <= 0 && dSq > 95 * 95) {
          this.resetAgentToLoopEnd(a);
        }
        a.rig.root.visible = dSq < cullSq;
        if (a.rig.root.visible) {
          a.rig.root.position.set(a.x, a.y, a.z);
          a.rig.root.rotation.y = a.heading;
        }
        continue;
      }

      const isSport =
        a.classId === 'sports' ||
        a.classId === 'supercar' ||
        a.classId === 'muscle' ||
        a.classId === 'convertible' ||
        a.classId === 'coupe';
      let targetSpeed =
        a.classId === 'bicycle'
          ? 8.35
          : a.classId === 'speed_bicycle'
            ? 11.15
            : a.lane.speedLimit * (isSport ? 1.22 : 1.0);
      a.braking = false;

      // 1. Traffic lights ahead
      for (const inter of TRAFFIC_INTERSECTIONS) {
        const cyc = (simTime + inter.phaseOffset) % 12;
        const nsGo = cyc < 6;
        const mustStop = (a.lane.axis === 'z' && !nsGo) || (a.lane.axis === 'x' && nsGo);
        if (!mustStop) continue;

        const interCoord = a.lane.axis === 'x' ? inter.x : inter.z;
        const perpCoord = a.lane.axis === 'x' ? inter.z : inter.x;
        if (Math.abs(a.lane.fixedCoord - perpCoord) > 8) continue;

        const distAhead = (interCoord - a.posAlong) * a.lane.dir;
        if (distAhead > 7 && distAhead < 22) {
          targetSpeed = 0;
          a.braking = true;
          break;
        }
      }

      // 2. Yield to vehicle ahead in same lane
      for (let j = 0; j < this.activeLimit; j++) {
        if (i === j) continue;
        const other = this.agents[j];
        if (other.lane !== a.lane || other.knockedTimer > 0) continue;
        const dist = (other.posAlong - a.posAlong) * a.lane.dir;
        if (dist > 0 && dist < 14) {
          targetSpeed = Math.min(targetSpeed, dist < 8 ? 0 : other.speed * 0.6);
          a.braking = true;
        }
      }

      // 3. Yield / brake for player (on-foot hit check only; vehicle-to-vehicle resolved by rigid-body collider!)
      const pdx = playerX - a.x;
      const pdz = playerZ - a.z;
      const pDistSq = pdx * pdx + pdz * pdz;
      if (pDistSq < 225) {
        const fwdX = Math.sin(a.heading);
        const fwdZ = Math.cos(a.heading);
        const dot = pdx * fwdX + pdz * fwdZ;
        if (dot > 0 && dot < 12 && pDistSq < 144) {
          targetSpeed = 0;
          a.braking = true;
        }
        if (!playerInVehicle && pDistSq < 2.3 && a.speed > 3.5) {
          onPlayerImpact(Math.min(1, a.speed / 18));
          a.speed = 0;
        }
      }

      a.speed = THREE.MathUtils.damp(a.speed, targetSpeed, a.braking ? 7 : 3.5, dt);
      a.posAlong += a.lane.dir * a.speed * dt;

      if (a.lane.dir > 0 && a.posAlong > a.lane.max) {
        a.posAlong = a.lane.min;
      } else if (a.lane.dir < 0 && a.posAlong < a.lane.min) {
        a.posAlong = a.lane.max;
      }

      a.x = a.lane.axis === 'x' ? a.posAlong : a.lane.fixedCoord;
      a.z = a.lane.axis === 'z' ? a.posAlong : a.lane.fixedCoord;
      a.vx = Math.sin(a.heading) * a.speed;
      a.vz = Math.cos(a.heading) * a.speed;

      const terrainY = groundHeightAt(a.x, a.z);
      const bridgeY = getBridgeDeckHeight(a.x, a.z);
      a.y = bridgeY !== null ? Math.max(terrainY, bridgeY) : terrainY;

      const camDistSq = (a.x - playerX) ** 2 + (a.z - playerZ) ** 2;
      a.rig.root.visible = camDistSq < cullSq;
      if (!a.rig.root.visible) continue;

      a.rig.root.position.set(a.x, a.y, a.z);
      a.rig.root.rotation.y = a.heading;
      const spin = (a.speed * dt) / a.rig.spec.wheelRadius;
      a.rig.wheelSpinMeshes.forEach((w) => {
        w.rotation.x += spin;
      });
      a.rig.headlightMeshes.forEach((h) => {
        (h.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 2.2 : 0.15;
      });
      a.rig.taillightMeshes.forEach((t) => {
        (t.material as THREE.MeshStandardMaterial).emissiveIntensity = a.braking ? 2.6 : isNight ? 0.9 : 0.2;
      });
    }
  }

  public dispose(): void {
    this.agents.forEach((a) => {
      this.scene.remove(a.rig.root);
      a.rig.dispose();
    });
  }
}
