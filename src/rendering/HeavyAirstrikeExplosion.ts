import type * as THREE from 'three';
import { BillowingExplosionPool } from './BillowingExplosionPool';

/** Accepted airstrike look. Twelve saved anchors each retain their full two-second visual clock. */
export class HeavyAirstrikeExplosion {
  private readonly pool: BillowingExplosionPool;
  constructor(scene: THREE.Scene) { this.pool = new BillowingExplosionPool(scene, 12, 'airstrike'); }
  present(index: number, x: number, z: number, at: number): void { this.pool.setImpact(index, x, z, at); }
  update(now: number, originZ: number): void { this.pool.update(now, originZ); }
  reset(): void { this.pool.reset(); }
  dispose(): void { this.pool.dispose(); }
}
