export interface TransformSnapshot {
  t: number; // local receive timestamp (ms)
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch?: number;
  roll?: number;
  vx?: number;
  vz?: number;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class SnapshotInterpolator {
  private buffer: TransformSnapshot[] = [];
  private readonly renderDelayMs: number;
  private readonly maxBuffer = 16;

  constructor(renderDelayMs = 95) {
    this.renderDelayMs = renderDelayMs;
  }

  public reset(initial: TransformSnapshot): void {
    this.buffer = [{ ...initial }];
  }

  public push(snap: TransformSnapshot): void {
    const last = this.buffer[this.buffer.length - 1];
    // Snap cleanly on teleports > 42m so players/vehicles never rubber-band across districts
    if (last && Math.hypot(snap.x - last.x, snap.z - last.z) > 42) {
      this.buffer = [{ ...snap }];
      return;
    }
    this.buffer.push({ ...snap });
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  public sample(nowMs: number): TransformSnapshot | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0];

    const targetTime = nowMs - this.renderDelayMs;

    // Trim older snapshots while keeping one before targetTime
    while (this.buffer.length >= 3 && this.buffer[1].t <= targetTime) {
      this.buffer.shift();
    }

    const a = this.buffer[0];
    const b = this.buffer[1];

    if (targetTime <= a.t) {
      return a;
    }

    if (targetTime <= b.t) {
      const span = Math.max(1, b.t - a.t);
      const alpha = Math.max(0, Math.min(1, (targetTime - a.t) / span));
      return {
        t: targetTime,
        x: a.x + (b.x - a.x) * alpha,
        y: a.y + (b.y - a.y) * alpha,
        z: a.z + (b.z - a.z) * alpha,
        heading: lerpAngle(a.heading, b.heading, alpha),
        pitch:
          a.pitch !== undefined && b.pitch !== undefined
            ? a.pitch + (b.pitch - a.pitch) * alpha
            : b.pitch ?? 0,
        roll:
          a.roll !== undefined && b.roll !== undefined
            ? a.roll + (b.roll - a.roll) * alpha
            : b.roll ?? 0,
      };
    }

    // Gentle capped dead-reckoning beyond newest packet (max 140ms)
    const latest = this.buffer[this.buffer.length - 1];
    const extraSec = Math.min(0.14, Math.max(0, (targetTime - latest.t) / 1000));
    return {
      t: targetTime,
      x: latest.x + (latest.vx ?? 0) * extraSec,
      y: latest.y,
      z: latest.z + (latest.vz ?? 0) * extraSec,
      heading: latest.heading,
      pitch: latest.pitch ?? 0,
      roll: latest.roll ?? 0,
    };
  }
}
