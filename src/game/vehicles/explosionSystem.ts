import * as THREE from 'three';

interface ExplosionParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  baseScale: number;
  kind: 'fire' | 'smoke' | 'debris';
}

interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
  maxScale: number;
}

export class ExplosionSystem {
  private mesh: THREE.InstancedMesh;
  private particles: ExplosionParticle[] = [];
  private count = 140;
  private cursor = 0;

  private ringMesh: THREE.InstancedMesh;
  private rings: ShockwaveRing[] = [];
  private ringCount = 8;
  private ringCursor = 0;

  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.6, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.7,
        baseScale: 1,
        kind: 'fire',
      });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
      this.mesh.setColorAt(i, this._color.setHex(0xf97316));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);

    const ringGeo = new THREE.TorusGeometry(1.0, 0.14, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfdba74,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, this.ringCount);
    this.ringMesh.frustumCulled = false;
    for (let i = 0; i < this.ringCount; i++) {
      this.rings.push({ active: false, x: 0, y: -100, z: 0, age: 0, maxAge: 0.55, maxScale: 10 });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.01);
      this._dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    scene.add(this.ringMesh);
  }

  public triggerExplosion(x: number, y: number, z: number, scaleMult = 1): void {
    // Expanding shockwave ring
    const ring = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.ringCount;
    ring.active = true;
    ring.x = x;
    ring.y = y + 0.35;
    ring.z = z;
    ring.age = 0;
    ring.maxAge = 0.52 * scaleMult;
    ring.maxScale = 9.5 * scaleMult;

    for (let i = 0; i < 34; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;
      const kind: ExplosionParticle['kind'] = i < 16 ? 'fire' : i < 26 ? 'smoke' : 'debris';
      const angle = Math.random() * Math.PI * 2;
      const horiz = (kind === 'debris' ? 11.5 : kind === 'fire' ? 6.5 : 3.2) * Math.random() * scaleMult;

      p.active = true;
      p.kind = kind;
      p.x = x + (Math.random() - 0.5) * 1.4;
      p.y = y + 0.5 + Math.random() * 0.9;
      p.z = z + (Math.random() - 0.5) * 1.4;
      p.vx = Math.cos(angle) * horiz;
      p.vy =
        (kind === 'debris' ? 9.0 + Math.random() * 6 : kind === 'fire' ? 6.5 + Math.random() * 5 : 4.2 + Math.random() * 3.5) *
        scaleMult;
      p.vz = Math.sin(angle) * horiz;
      p.age = 0;
      p.maxAge = kind === 'smoke' ? 1.65 + Math.random() * 0.6 : kind === 'debris' ? 1.15 : 0.72 + Math.random() * 0.3;
      p.baseScale = (kind === 'smoke' ? 1.9 : kind === 'debris' ? 0.36 : 2.35) * scaleMult;
    }
  }

  public triggerDustBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 10; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;
      const angle = Math.random() * Math.PI * 2;
      p.active = true;
      p.kind = i < 4 ? 'debris' : 'smoke';
      p.x = x + (Math.random() - 0.5) * 0.5;
      p.y = y + 0.4;
      p.z = z + (Math.random() - 0.5) * 0.5;
      p.vx = Math.cos(angle) * (2.5 + Math.random() * 2.5);
      p.vy = 2.5 + Math.random() * 2.5;
      p.vz = Math.sin(angle) * (2.5 + Math.random() * 2.5);
      p.age = 0;
      p.maxAge = 0.55;
      p.baseScale = i < 4 ? 0.22 : 0.65;
    }
  }

  public update(dt: number): void {
    let anyColor = false;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.01);
      } else {
        const t = p.age / p.maxAge;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 0.96;
        p.vz *= 0.96;
        p.vy = p.kind === 'debris' ? p.vy - 16 * dt : p.kind === 'smoke' ? p.vy * 0.97 : p.vy - 4.5 * dt;

        this._dummy.position.set(p.x, Math.max(0.1, p.y), p.z);
        this._dummy.rotation.set(p.age * 4, p.age * 5, 0);
        const s =
          p.kind === 'smoke'
            ? p.baseScale * (0.8 + t * 2.1)
            : p.kind === 'debris'
              ? p.baseScale * (1 - t * 0.5)
              : p.baseScale * (1.35 - t * 0.95);
        this._dummy.scale.setScalar(Math.max(0.05, s));

        if (p.kind === 'smoke') {
          this._color.setHex(0x27272a);
        } else if (p.kind === 'debris') {
          this._color.setHex(t < 0.4 ? 0xf97316 : 0x1c1917);
        } else {
          this._color.setHex(t < 0.35 ? 0xfef08a : t < 0.7 ? 0xf97316 : 0xdc2626);
        }
        this.mesh.setColorAt(i, this._color);
        anyColor = true;
      }

      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (anyColor && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    // Shockwave rings
    for (let i = 0; i < this.ringCount; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.01);
      } else {
        const t = r.age / r.maxAge;
        const sc = 1 + t * r.maxScale;
        this._dummy.position.set(r.x, r.y, r.z);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(sc, Math.max(0.1, 1.4 * (1 - t)), sc);
      }
      this._dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.ringMesh.geometry.dispose();
    (this.ringMesh.material as THREE.Material).dispose();
  }
}
