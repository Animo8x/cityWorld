import * as THREE from 'three';
import { ColliderBox, GpsPoint } from '../types';
import { getBridgeDeckHeight, groundHeightAt, ROAD_SEGMENTS, RoadSegment } from './worldLayout';

interface GraphNode {
  id: number;
  x: number;
  z: number;
  edges: Array<{ to: number; dist: number }>;
}

const ROAD_NODES: GraphNode[] = [];
const SEG_NODES = new Map<string, number[]>();

function initRoadGraph(): void {
  if (ROAD_NODES.length > 0) return;

  const rawPoints: Array<{ x: number; z: number }> = [];
  for (const s of ROAD_SEGMENTS) {
    rawPoints.push({ x: s.x1, z: s.z1 }, { x: s.x2, z: s.z2 });
  }

  // Find intersections between orthogonal segments
  for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
    const a = ROAD_SEGMENTS[i];
    const aHoriz = Math.abs(a.z1 - a.z2) < 0.1;
    for (let j = i + 1; j < ROAD_SEGMENTS.length; j++) {
      const b = ROAD_SEGMENTS[j];
      const bHoriz = Math.abs(b.z1 - b.z2) < 0.1;
      if (aHoriz === bHoriz) continue;
      const h = aHoriz ? a : b;
      const v = aHoriz ? b : a;
      const minHx = Math.min(h.x1, h.x2);
      const maxHx = Math.max(h.x1, h.x2);
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);
      if (v.x1 >= minHx - 0.5 && v.x1 <= maxHx + 0.5 && h.z1 >= minVz - 0.5 && h.z1 <= maxVz + 0.5) {
        rawPoints.push({ x: v.x1, z: h.z1 });
      }
    }
  }

  // Deduplicate into ROAD_NODES
  for (const pt of rawPoints) {
    const existing = ROAD_NODES.find((n) => Math.hypot(n.x - pt.x, n.z - pt.z) < 1.0);
    if (!existing) {
      ROAD_NODES.push({ id: ROAD_NODES.length, x: pt.x, z: pt.z, edges: [] });
    }
  }

  // Link consecutive nodes along every RoadSegment
  for (const seg of ROAD_SEGMENTS) {
    const isHoriz = Math.abs(seg.z1 - seg.z2) < 0.1;
    const minCoord = isHoriz ? Math.min(seg.x1, seg.x2) : Math.min(seg.z1, seg.z2);
    const maxCoord = isHoriz ? Math.max(seg.x1, seg.x2) : Math.max(seg.z1, seg.z2);
    const fixed = isHoriz ? seg.z1 : seg.x1;

    const onSeg = ROAD_NODES.filter((n) => {
      const perp = isHoriz ? Math.abs(n.z - fixed) : Math.abs(n.x - fixed);
      const along = isHoriz ? n.x : n.z;
      return perp < 1.0 && along >= minCoord - 1.0 && along <= maxCoord + 1.0;
    }).sort((a, b) => (isHoriz ? a.x - b.x : a.z - b.z));

    SEG_NODES.set(
      seg.id,
      onSeg.map((n) => n.id)
    );

    for (let k = 0; k < onSeg.length - 1; k++) {
      const u = onSeg[k];
      const v = onSeg[k + 1];
      const dist = Math.hypot(u.x - v.x, u.z - v.z);
      if (dist < 0.5) continue;
      if (!u.edges.some((e) => e.to === v.id)) u.edges.push({ to: v.id, dist });
      if (!v.edges.some((e) => e.to === u.id)) v.edges.push({ to: u.id, dist });
    }
  }
}

function segmentHitsCollider(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  colliders: ColliderBox[]
): boolean {
  const steps = Math.max(4, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 3));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY < 1.5) continue;
      if (px >= c.minX - 0.6 && px <= c.maxX + 0.6 && pz >= c.minZ - 0.6 && pz <= c.maxZ + 0.6) {
        return true;
      }
    }
  }
  return false;
}

function projectToNearestRoad(
  x: number,
  z: number,
  colliders: ColliderBox[]
): { seg: RoadSegment; x: number; z: number; dist: number } {
  let bestClear: { seg: RoadSegment; x: number; z: number; dist: number } | null = null;
  let bestAny: { seg: RoadSegment; x: number; z: number; dist: number } | null = null;

  for (const seg of ROAD_SEGMENTS) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - seg.x1) * dx + (z - seg.z1) * dz) / lenSq));
    const px = seg.x1 + dx * t;
    const pz = seg.z1 + dz * t;
    const d = Math.hypot(x - px, z - pz);

    if (!bestAny || d < bestAny.dist) {
      bestAny = { seg, x: px, z: pz, dist: d };
    }
    if (!segmentHitsCollider(x, z, px, pz, colliders)) {
      if (!bestClear || d < bestClear.dist) {
        bestClear = { seg, x: px, z: pz, dist: d };
      }
    }
  }

  return bestClear ?? bestAny!;
}

function getNeighborNodesOnSeg(
  seg: RoadSegment,
  px: number,
  pz: number
): Array<{ nodeId: number; dist: number }> {
  const ids = SEG_NODES.get(seg.id) ?? [];
  const isHoriz = Math.abs(seg.z1 - seg.z2) < 0.1;
  const val = isHoriz ? px : pz;

  let prevId: number | null = null;
  let nextId: number | null = null;
  for (const nid of ids) {
    const n = ROAD_NODES[nid];
    const nVal = isHoriz ? n.x : n.z;
    if (nVal <= val + 0.5) prevId = nid;
    if (nVal >= val - 0.5 && nextId === null) nextId = nid;
  }

  const out: Array<{ nodeId: number; dist: number }> = [];
  if (prevId !== null) {
    const n = ROAD_NODES[prevId];
    out.push({ nodeId: prevId, dist: Math.hypot(n.x - px, n.z - pz) });
  }
  if (nextId !== null && nextId !== prevId) {
    const n = ROAD_NODES[nextId];
    out.push({ nodeId: nextId, dist: Math.hypot(n.x - px, n.z - pz) });
  }
  return out;
}

export function computeRoadGpsPath(
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number,
  colliders: ColliderBox[]
): GpsPoint[] {
  initRoadGraph();
  const totalDirect = Math.hypot(targetX - startX, targetZ - startZ);
  if (totalDirect < 22 && !segmentHitsCollider(startX, startZ, targetX, targetZ, colliders)) {
    return [
      { x: startX, z: startZ },
      { x: targetX, z: targetZ },
    ];
  }

  const sProj = projectToNearestRoad(startX, startZ, colliders);
  const gProj = projectToNearestRoad(targetX, targetZ, colliders);

  if (sProj.seg.id === gProj.seg.id) {
    const pts: GpsPoint[] = [{ x: startX, z: startZ }];
    if (sProj.dist > 1.5) pts.push({ x: sProj.x, z: sProj.z });
    if (gProj.dist > 1.5) pts.push({ x: gProj.x, z: gProj.z });
    pts.push({ x: targetX, z: targetZ });
    return pts;
  }

  const nCount = ROAD_NODES.length;
  const START_ID = nCount;
  const GOAL_ID = nCount + 1;

  const dist = new Float64Array(nCount + 2).fill(Infinity);
  const prev = new Int32Array(nCount + 2).fill(-1);
  const visited = new Uint8Array(nCount + 2);

  dist[START_ID] = 0;

  const startAdj = getNeighborNodesOnSeg(sProj.seg, sProj.x, sProj.z);
  for (const a of startAdj) {
    dist[a.nodeId] = a.dist;
    prev[a.nodeId] = START_ID;
  }

  const goalAdj = getNeighborNodesOnSeg(gProj.seg, gProj.x, gProj.z);
  const goalAdjMap = new Map<number, number>();
  for (const a of goalAdj) {
    goalAdjMap.set(a.nodeId, a.dist);
  }

  // Dijkstra across ~65 nodes
  for (let iter = 0; iter < nCount + 2; iter++) {
    let u = -1;
    let bestD = Infinity;
    for (let i = 0; i < nCount + 2; i++) {
      if (!visited[i] && dist[i] < bestD) {
        bestD = dist[i];
        u = i;
      }
    }
    if (u === -1 || u === GOAL_ID) break;
    visited[u] = 1;

    if (u < nCount) {
      const node = ROAD_NODES[u];
      for (const e of node.edges) {
        const alt = dist[u] + e.dist;
        if (alt < dist[e.to]) {
          dist[e.to] = alt;
          prev[e.to] = u;
        }
      }
      const toGoal = goalAdjMap.get(u);
      if (toGoal !== undefined) {
        const altGoal = dist[u] + toGoal;
        if (altGoal < dist[GOAL_ID]) {
          dist[GOAL_ID] = altGoal;
          prev[GOAL_ID] = u;
        }
      }
    }
  }

  if (prev[GOAL_ID] === -1) {
    return [
      { x: startX, z: startZ },
      { x: sProj.x, z: sProj.z },
      { x: gProj.x, z: gProj.z },
      { x: targetX, z: targetZ },
    ];
  }

  const chainIds: number[] = [];
  let cur = prev[GOAL_ID];
  while (cur !== -1 && cur !== START_ID) {
    chainIds.push(cur);
    cur = prev[cur];
  }
  chainIds.reverse();

  const result: GpsPoint[] = [{ x: startX, z: startZ }];
  if (sProj.dist > 1.5) {
    result.push({ x: sProj.x, z: sProj.z });
  }
  for (const id of chainIds) {
    const n = ROAD_NODES[id];
    const last = result[result.length - 1];
    if (Math.hypot(n.x - last.x, n.z - last.z) > 1.0) {
      result.push({ x: n.x, z: n.z });
    }
  }
  if (gProj.dist > 1.5) {
    const last = result[result.length - 1];
    if (Math.hypot(gProj.x - last.x, gProj.z - last.z) > 1.0) {
      result.push({ x: gProj.x, z: gProj.z });
    }
  }
  const last = result[result.length - 1];
  if (Math.hypot(targetX - last.x, targetZ - last.z) > 0.8) {
    result.push({ x: targetX, z: targetZ });
  }
  return result;
}

export class GpsPathRenderer {
  private instMesh: THREE.InstancedMesh;
  private maxTiles = 180;
  private wpRing: THREE.Mesh;
  private wpBeam: THREE.Mesh;
  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(scene: THREE.Scene) {
    // Sleek arrow-chevron tile oriented along +Z
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.95);
    shape.lineTo(0.65, -0.25);
    shape.lineTo(0.28, -0.25);
    shape.lineTo(0.28, -0.85);
    shape.lineTo(-0.28, -0.85);
    shape.lineTo(-0.28, -0.25);
    shape.lineTo(-0.65, -0.25);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.instMesh = new THREE.InstancedMesh(geo, mat, this.maxTiles);
    this.instMesh.frustumCulled = false;
    this.instMesh.visible = false;

    for (let i = 0; i < this.maxTiles; i++) {
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.instMesh.setMatrixAt(i, this._dummy.matrix);
      this.instMesh.setColorAt(i, this._color.setHex(0x22d3ee));
    }
    this.instMesh.instanceMatrix.needsUpdate = true;
    if (this.instMesh.instanceColor) this.instMesh.instanceColor.needsUpdate = true;

    // Glowing purple/cyan waypoint destination marker
    const ringGeo = new THREE.TorusGeometry(2.0, 0.16, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.wpRing = new THREE.Mesh(ringGeo, ringMat);
    this.wpRing.rotation.x = Math.PI / 2;
    this.wpRing.visible = false;

    const beamGeo = new THREE.CylinderGeometry(0.45, 1.4, 28, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.wpBeam = new THREE.Mesh(beamGeo, beamMat);
    this.wpBeam.visible = false;

    this.disposables.push(geo, mat, ringGeo, ringMat, beamGeo, beamMat);
    scene.add(this.instMesh, this.wpRing, this.wpBeam);
  }

  public update(
    path: GpsPoint[],
    showCustomBeacon: GpsPoint | null,
    simTime: number
  ): void {
    if (showCustomBeacon) {
      const y = groundHeightAt(showCustomBeacon.x, showCustomBeacon.z);
      this.wpRing.visible = true;
      this.wpBeam.visible = true;
      this.wpRing.position.set(showCustomBeacon.x, y + 0.3 + Math.sin(simTime * 4) * 0.12, showCustomBeacon.z);
      this.wpBeam.position.set(showCustomBeacon.x, y + 14, showCustomBeacon.z);
    } else {
      this.wpRing.visible = false;
      this.wpBeam.visible = false;
    }

    if (path.length < 2) {
      this.instMesh.visible = false;
      return;
    }

    this.instMesh.visible = true;
    let cursor = 0;
    const spacing = 4.6;

    for (let s = 0; s < path.length - 1 && cursor < this.maxTiles; s++) {
      const p1 = path[s];
      const p2 = path[s + 1];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.8) continue;

      const yaw = Math.atan2(dx, dz);
      const count = Math.max(1, Math.floor(segLen / spacing));
      for (let k = 0; k < count && cursor < this.maxTiles; k++) {
        const t = (k + 0.5) / count;
        const wx = p1.x + dx * t;
        const wz = p1.z + dz * t;
        const terrainY = groundHeightAt(wx, wz);
        const bridgeY = getBridgeDeckHeight(wx, wz);
        const y = bridgeY !== null ? Math.max(terrainY, bridgeY) : terrainY;

        this._dummy.position.set(wx, y + 0.16, wz);
        this._dummy.rotation.set(0, yaw, 0);
        this._dummy.scale.setScalar(1.0);
        this._dummy.updateMatrix();
        this.instMesh.setMatrixAt(cursor, this._dummy.matrix);

        // Animated forward pulse along the GPS chevrons
        const wave = 0.5 + 0.5 * Math.sin(cursor * 0.65 - simTime * 7.5);
        this._color.setRGB(0.08 + wave * 0.45, 0.72 + wave * 0.28, 0.92 + wave * 0.08);
        this.instMesh.setColorAt(cursor, this._color);
        cursor++;
      }
    }

    for (let i = cursor; i < this.maxTiles; i++) {
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.instMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.instMesh.instanceMatrix.needsUpdate = true;
    if (this.instMesh.instanceColor) this.instMesh.instanceColor.needsUpdate = true;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
