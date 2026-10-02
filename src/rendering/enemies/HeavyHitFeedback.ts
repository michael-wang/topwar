import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
export const HEAVY_HIT_FLASH_MS = 100;
export const HEAVY_HIT_GAP_MS = 250;
const SPARK_MS = 170;
const MAX_BURSTS = 12;
interface Burst { id: number; startedAt: number; body: THREE.Mesh; sparks: THREE.Group; material: THREE.MeshBasicMaterial; giant: boolean; x: number; z: number }
export class HeavyHitFeedback {
  private readonly lastHit = new Map<number, number>();
  private readonly bursts: Burst[] = [];
  private readonly flash = new THREE.MeshBasicMaterial({ color: '#fff2ce', transparent: true, opacity: .72,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  private readonly geometry = new THREE.SphereGeometry(.035, 5, 3);
  constructor(private readonly scene: THREE.Scene) {}
  observe(enemy: EnemyRenderState, nowMs: number): boolean {
    if ((enemy.archetype !== 'heavy' && enemy.archetype !== 'giant') || nowMs - (this.lastHit.get(enemy.id) ?? -Infinity) < HEAVY_HIT_GAP_MS) return false;
    this.lastHit.set(enemy.id, nowMs);
    let burst = this.bursts.find(b => !b.body.visible && !b.sparks.visible);
    if (!burst && this.bursts.length < MAX_BURSTS) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffe4a2', transparent: true, depthWrite: false, toneMapped: false });
      const body = new THREE.Mesh(this.geometry, this.flash); body.name = 'heavy-hit-body'; body.matrixAutoUpdate = false;
      const sparks = new THREE.Group(); sparks.name = 'heavy-hit-sparks';
      for (let index = 0; index < 6; index++) sparks.add(new THREE.Mesh(this.geometry, material));
      this.scene.add(body, sparks);
      burst = { id: 0, startedAt: 0, body, sparks, material, giant: false, x: 0, z: 0 }; this.bursts.push(burst);
    }
    burst ??= this.bursts.reduce((oldest, b) => b.startedAt < oldest.startedAt ? b : oldest);
    // HP deltas carry no impact coordinates: use the defender-facing Rifle-height surface.
    burst.giant = enemy.archetype === 'giant';
    burst.sparks.children.forEach((spark, index) => spark.visible = burst!.giant || index < 4);
    burst.id = enemy.id; burst.startedAt = nowMs; burst.x = -enemy.x; burst.z = enemy.z - .25;
    burst.body.visible = true; burst.sparks.visible = true;
    return true;
  }
  strength(id: number, nowMs: number): number {
    return Math.max(0, Math.min(1, 1 - (nowMs - (this.lastHit.get(id) ?? -Infinity)) / HEAVY_HIT_FLASH_MS));
  }
  setBody(id: number, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, nowMs: number): void {
    const burst = this.bursts.find(b => b.id === id && b.body.visible);
    if (burst && this.strength(id, nowMs) > 0) { burst.body.geometry = geometry; burst.body.matrix.copy(matrix); }
  }
  update(ids: ReadonlySet<number>, nowMs: number): void {
    for (const id of this.lastHit.keys()) if (!ids.has(id)) this.lastHit.delete(id);
    for (const burst of this.bursts) {
      const age = nowMs - burst.startedAt;
      burst.body.visible = ids.has(burst.id) && age >= 0 && age < HEAVY_HIT_FLASH_MS;
      burst.sparks.visible = ids.has(burst.id) && age >= 0 && age < SPARK_MS;
      if (!burst.sparks.visible) continue;
      const progress = age / SPARK_MS; burst.material.opacity = 1 - progress;
      burst.sparks.children.forEach((spark, index) => {
        const angle = index * 2.4;
        spark.position.set(burst.x + Math.cos(angle) * (burst.giant ? .5 : .32) * progress,
          .7 + Math.sin(angle) * .2 * progress + .15 * progress, burst.z - .35 * progress);
        spark.scale.setScalar((burst.giant ? 1.8 : 1) * (1 - .5 * progress));
      });
    }
  }
  reset(): void { this.lastHit.clear(); for (const burst of this.bursts) { burst.body.visible = false; burst.sparks.visible = false; burst.id = 0; } }
  dispose(): void {
    for (const burst of this.bursts) { this.scene.remove(burst.body, burst.sparks); burst.material.dispose(); }
    // Body overlays borrow the renderer's baked pose geometry; only sparks own geometry here.
    this.bursts.length = 0; this.lastHit.clear(); this.flash.dispose(); this.geometry.dispose();
  }
}
