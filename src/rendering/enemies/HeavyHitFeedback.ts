import { ART } from '../../art/ArtDirection';
import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
export const HEAVY_HIT_FLASH_MS = 100;
export const HEAVY_HIT_GAP_MS = 250;
const SPARK_MS = 170;
export const GIANT_SPARK_MS = 300;
const MAX_BURSTS = 12;
// Defender-facing chest plate only. Authored variation never consumes gameplay RNG.
const GIANT_ARMOR_HITS = [[.04,.82],[-.18,.87],[.18,.72],[-.10,.65],[.16,.90],[-.17,.74],[.08,.67]] as const;
// Ordinary surviving-hit presentation only. Death has separate timing
// and materials. These styles are selected by explicit archetype, never IDs.
export const SURVIVING_HIT_STYLES = {
  heavy: { overlayColor: ART.fx.core, overlayOpacity: .72, sparkColor: ART.fx.impact, sparkCount: 4, sparkScale: 1, sparkOpacity: 1, sparkSpread: .32 },
  giant: { overlayColor: '#ffe34f', overlayOpacity: .24, sparkColor: '#ffe34f', sparkCount: 6, sparkScale: 2.8, sparkOpacity: 1, sparkSpread: .85,
    emissivePeak: .10 },
} as const;
interface Burst { id: number; startedAt: number; body: THREE.Mesh; sparks: THREE.Group; core: THREE.Mesh;
  material: THREE.MeshBasicMaterial; giant: boolean; anchored: boolean; armorPoint: number; x: number; y: number; z: number }
export class HeavyHitFeedback {
  private readonly lastHit = new Map<number, number>();
  private readonly bursts: Burst[] = [];
  private readonly flash = new THREE.MeshBasicMaterial({ color: SURVIVING_HIT_STYLES.heavy.overlayColor,
    transparent: true, opacity: SURVIVING_HIT_STYLES.heavy.overlayOpacity,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  private readonly giantFlash = new THREE.MeshBasicMaterial({ color: SURVIVING_HIT_STYLES.giant.overlayColor,
    transparent: true, opacity: SURVIVING_HIT_STYLES.giant.overlayOpacity,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  private readonly geometry = new THREE.SphereGeometry(.035, 5, 3);
  private readonly hot = new THREE.MeshBasicMaterial({ color: '#fff8d9', depthWrite: false, toneMapped: false });
  private readonly anchor = new THREE.Vector3();
  private giantHitSequence = 0;
  constructor(private readonly scene: THREE.Scene) {
    // Fixed pool: ordinary hits only select/reuse resources, never construct them.
    for (let slot = 0; slot < MAX_BURSTS; slot++) {
      const material = new THREE.MeshBasicMaterial({ color: ART.fx.impact, transparent: true, depthWrite: false, toneMapped: false });
      const body = new THREE.Mesh(this.geometry, this.flash); body.name = 'heavy-hit-body'; body.matrixAutoUpdate = false;
      const sparks = new THREE.Group(); sparks.name = 'heavy-hit-sparks';
      for (let index = 0; index < 6; index++) sparks.add(new THREE.Mesh(this.geometry, material));
      const core = new THREE.Mesh(this.geometry, this.hot); core.name = 'giant-hit-hot-core'; sparks.add(core);
      body.visible = sparks.visible = core.visible = false;
      this.scene.add(body, sparks);
      this.bursts.push({ id: 0, startedAt: 0, body, sparks, core, material, giant: false, anchored: false, armorPoint: 0, x: 0, y: .7, z: 0 });
    }
  }
  observe(enemy: EnemyRenderState, nowMs: number): boolean {
    if ((enemy.archetype !== 'heavy' && enemy.archetype !== 'giant') || nowMs - (this.lastHit.get(enemy.id) ?? -Infinity) < HEAVY_HIT_GAP_MS) return false;
    this.lastHit.set(enemy.id, nowMs);
    let burst = this.bursts[0];
    for (const candidate of this.bursts) {
      if (!candidate.body.visible && !candidate.sparks.visible) { burst = candidate; break; }
      if (candidate.startedAt < burst.startedAt) burst = candidate;
    }
    burst.giant = enemy.archetype === 'giant';
    if (burst.giant) burst.armorPoint = this.giantHitSequence++ % GIANT_ARMOR_HITS.length;
    const style = SURVIVING_HIT_STYLES[burst.giant ? 'giant' : 'heavy'];
    burst.body.material = burst.giant ? this.giantFlash : this.flash;
    burst.material.color.set(style.sparkColor);
    for (let i = 0; i < 6; i++) burst.sparks.children[i].visible = i < style.sparkCount;
    burst.core.visible = burst.giant; burst.anchored = false;
    burst.id = enemy.id; burst.startedAt = nowMs; burst.x = -enemy.x; burst.z = enemy.z - (burst.giant ? (enemy.visualScaleZ ?? enemy.visualScale ?? 1) * .32 : .25);
    burst.y = burst.giant ? .82 * (enemy.visualScaleY ?? enemy.visualScale ?? 1) : .7;
    burst.body.visible = true; burst.sparks.visible = true;
    return true;
  }
  strength(id: number, nowMs: number): number {
    return Math.max(0, Math.min(1, 1 - (nowMs - (this.lastHit.get(id) ?? -Infinity)) / HEAVY_HIT_FLASH_MS));
  }
  setBody(id: number, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, nowMs: number): void {
    let burst: Burst | undefined;
    for (const candidate of this.bursts) if (candidate.id === id && candidate.body.visible) { burst = candidate; break; }
    if (burst && this.strength(id, nowMs) > 0) {
      burst.body.geometry = geometry; burst.body.matrix.copy(matrix);
      if (burst.giant && !burst.anchored) {
        // Actual scaled/rotated upper armor, on its defender-facing surface.
        const point = GIANT_ARMOR_HITS[burst.armorPoint];
        this.anchor.set(point[0], point[1], .41).applyMatrix4(matrix);
        burst.x = this.anchor.x; burst.y = this.anchor.y; burst.z = this.anchor.z; burst.anchored = true;
        this.poseSparks(burst, nowMs);
      }
    }
  }
  update(ids: ReadonlySet<number>, nowMs: number): void {
    for (const id of this.lastHit.keys()) if (!ids.has(id)) this.lastHit.delete(id);
    for (const burst of this.bursts) {
      const age = nowMs - burst.startedAt;
      burst.body.visible = ids.has(burst.id) && age >= 0 && age < HEAVY_HIT_FLASH_MS;
      burst.sparks.visible = ids.has(burst.id) && age >= 0 && age < (burst.giant ? GIANT_SPARK_MS : SPARK_MS);
      if (!burst.sparks.visible) continue;
      this.poseSparks(burst, nowMs);
    }
  }
  private poseSparks(burst: Burst, nowMs: number): void {
      const style = SURVIVING_HIT_STYLES[burst.giant ? 'giant' : 'heavy'];
      const age = nowMs - burst.startedAt, progress = age / (burst.giant ? GIANT_SPARK_MS : SPARK_MS);
      burst.material.opacity = style.sparkOpacity * (burst.giant ? Math.pow(1 - progress, .6) : 1 - progress);
      for (let index = 0; index < 6; index++) {
        const spark = burst.sparks.children[index];
        const angle = index * 2.4;
        spark.position.set(burst.x + Math.cos(angle) * style.sparkSpread * progress,
          burst.y + Math.sin(angle) * (burst.giant ? .55 : .2) * progress + .15 * progress, burst.z - .35 * progress);
        const scale = style.sparkScale * (1 - .5 * progress);
        spark.scale.set(scale * (burst.giant ? 4.2 : 1), scale * (burst.giant ? .7 : 1), scale);
        spark.rotation.z = burst.giant ? angle : 0;
      }
      burst.core.visible = burst.giant && age < 110;
      burst.core.position.set(burst.x, burst.y, burst.z - .035);
      burst.core.scale.setScalar(3.6 * Math.max(0, 1 - age / 150));
  }
  reset(): void { this.lastHit.clear(); this.giantHitSequence = 0; for (const burst of this.bursts) { burst.body.visible = false; burst.sparks.visible = false; burst.id = 0; } }
  dispose(): void {
    for (const burst of this.bursts) { this.scene.remove(burst.body, burst.sparks); burst.material.dispose(); }
    // Body overlays borrow the renderer's baked pose geometry; only sparks own geometry here.
    this.bursts.length = 0; this.lastHit.clear(); this.flash.dispose(); this.giantFlash.dispose(); this.hot.dispose(); this.geometry.dispose();
  }
}
