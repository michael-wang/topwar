import type { CollisionDiagnostics } from '../simulation/Simulation';

export function perfEnabled(search: string): boolean {
  return new URLSearchParams(search).get('perf') === '1';
}

export class RollingMetric {
  private readonly values: Float64Array;
  private cursor = 0;
  private used = 0;

  constructor(capacity = 120) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid metric capacity');
    this.values = new Float64Array(capacity);
  }

  add(value: number): void {
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.used = Math.min(this.used + 1, this.values.length);
  }

  get count(): number { return this.used; }
  get capacity(): number { return this.values.length; }
  average(): number {
    if (!this.used) return 0;
    let sum = 0;
    for (let i = 0; i < this.used; i++) sum += this.values[i];
    return sum / this.used;
  }
  p95(): number {
    if (!this.used) return 0;
    const sorted = Array.from(this.values.subarray(0, this.used)).sort((a, b) => a - b);
    return sorted[Math.ceil(this.used * .95) - 1];
  }
  reset(): void { this.cursor = 0; this.used = 0; }
}

export interface HighWater {
  enemies: number;
  projectiles: number;
  drawCalls: number;
  triangles: number;
  projectilePool: number;
}

export class PerfDiagnostics {
  readonly frame = new RollingMetric();
  readonly sim = new RollingMetric();
  readonly render = new RollingMetric();
  readonly audio = new RollingMetric();
  readonly collision = new RollingMetric();
  readonly collisionCalls = new RollingMetric();
  readonly projectilePasses = new RollingMetric();
  readonly penetrationPasses = new RollingMetric();
  readonly counters: CollisionDiagnostics = {
    findFirstHitCalls: 0, enemyCandidateChecks: 0, projectilePasses: 0, penetrationPasses: 0,
  };
  readonly highWater: HighWater = {
    enemies: 0, projectiles: 0, drawCalls: 0, triangles: 0, projectilePool: 0,
  };

  beginFrame(): void {
    this.counters.findFirstHitCalls = 0;
    this.counters.enemyCandidateChecks = 0;
    this.counters.projectilePasses = 0;
    this.counters.penetrationPasses = 0;
  }

  record(frameMs: number, simMs: number, renderMs: number, audioMs: number,
    counts: { enemies: number; projectiles: number; drawCalls: number; triangles: number;
      projectilePool: number }): void {
    this.frame.add(frameMs);
    this.sim.add(simMs);
    this.render.add(renderMs);
    this.audio.add(audioMs);
    this.collision.add(this.counters.enemyCandidateChecks);
    this.collisionCalls.add(this.counters.findFirstHitCalls);
    this.projectilePasses.add(this.counters.projectilePasses);
    this.penetrationPasses.add(this.counters.penetrationPasses);
    for (const key of Object.keys(this.highWater) as (keyof HighWater)[]) {
      this.highWater[key] = Math.max(this.highWater[key], counts[key]);
    }
  }

  reset(): void {
    for (const metric of [this.frame, this.sim, this.render, this.audio, this.collision,
      this.collisionCalls, this.projectilePasses, this.penetrationPasses]) metric.reset();
    this.beginFrame();
    for (const key of Object.keys(this.highWater) as (keyof HighWater)[]) this.highWater[key] = 0;
  }
}
