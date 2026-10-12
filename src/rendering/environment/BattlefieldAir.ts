import { ART } from '../../art/ArtDirection';
import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export const FOOT_DUST_CAPACITY = 24;
const DUST_MS = 420;
// One Giant foot-dust batch with fixed buffers; no emitter per soldier.
export class BattlefieldAir {
  private readonly dustPositions = new Float32Array(FOOT_DUST_CAPACITY * 3);
  private readonly starts = new Float64Array(FOOT_DUST_CAPACITY).fill(-Infinity);
  private readonly origins = new Float32Array(FOOT_DUST_CAPACITY * 3);
  private readonly dustGeometry = new THREE.BufferGeometry();
  private readonly dustMaterial = new THREE.PointsMaterial({ color: ART.fx.dust, size: .10, transparent: true,
    opacity: .22, depthWrite: false });
  private readonly dust: THREE.Points;
  private lastFoot = -Infinity;
  private lastGiantId = -1;
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene) {
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.dust = new THREE.Points(this.dustGeometry, this.dustMaterial); this.dust.name = 'giant-foot-dust';
    this.dust.frustumCulled = false;
    scene.add(this.dust); this.reset();
  }
  update(enemies: readonly EnemyRenderState[], nowMs: number, defenseMode: boolean): void {
    const giant = enemies.find(enemy => enemy.archetype === 'giant');
    if (giant) {
      const foot = Math.floor(nowMs * 2 / (giant.gaitCycleMs ?? 850) + giant.id * 2.399963 / Math.PI);
      if (giant.id === this.lastGiantId && foot === this.lastFoot + 1) {
        const side = foot % 2 ? -1 : 1;
        for (let i = 0; i < 4; i++) {
          const slot = this.cursor++ % FOOT_DUST_CAPACITY;
          this.starts[slot] = nowMs;
          this.origins[slot * 3] = -giant.x + side * .13 * (giant.visualScaleX ?? 1);
          this.origins[slot * 3 + 2] = giant.z - .15;
        }
      }
      this.lastGiantId = giant.id; this.lastFoot = foot;
    } else { this.lastGiantId = -1; this.lastFoot = -Infinity; }
    let active = false;
    for (let i = 0; i < FOOT_DUST_CAPACITY; i++) {
      const age = (nowMs - this.starts[i]) / DUST_MS, visible = age >= 0 && age < 1;
      const p = visible ? age : 0;
      active ||= visible;
      this.dustPositions[i * 3] = this.origins[i * 3] + Math.cos(i * 2.4) * .7 * p;
      this.dustPositions[i * 3 + 1] = visible ? .04 + .16 * Math.sin(Math.PI * p) : -100;
      this.dustPositions[i * 3 + 2] = this.origins[i * 3 + 2] + Math.sin(i * 2.4) * .4 * p;
    }
    this.dust.visible = defenseMode && active;
    this.dustGeometry.attributes.position.needsUpdate = true;
  }
  reset(): void {
    this.lastGiantId = -1; this.lastFoot = -Infinity; this.cursor = 0;
    this.starts.fill(-Infinity); this.dust.visible = false;
  }
  dispose(): void {
    this.scene.remove(this.dust); this.dustGeometry.dispose();
    this.dustMaterial.dispose();
  }
}
