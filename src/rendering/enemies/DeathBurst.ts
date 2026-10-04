import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { PALE_DEATH_COLORS } from './PaleDeathMaterial';
import { ENEMY_FRAGMENT_MS } from '../../presentation/EnemyDeathTiming';
import { fragmentLandingSeconds } from './GroundedFragments';

export const DEATH_FRAGMENT_CAPACITY = 384; // 48 simultaneous eight-piece Heavy shatters.
export const DEATH_FRAGMENT_LIFETIME_MS = ENEMY_FRAGMENT_MS;
export const DEATH_FRAGMENT_FADE_MS = 180;
const GRAVITY = 32;
const COLORS = PALE_DEATH_COLORS.map(color => new THREE.Color(color));
const PIECES = [
  [0, .82, 0, .17, .12, .15], [-.12, .47, 0, .13, .14, .12], [.12, .42, 0, .12, .13, .13],
  [0, .23, 0, .15, .09, .12], [-.15, .08, .06, .13, .07, .10], [.15, .08, .06, .13, .07, .10],
  [-.43, .35, 0, .11, .10, .10], [.43, .35, 0, .11, .10, .10],
] as const;
function hash(value: number): number {
  let bits = value >>> 0;
  bits ^= bits >>> 16; bits = Math.imul(bits, 0x7feb352d);
  bits ^= bits >>> 15; bits = Math.imul(bits, 0x846ca68b);
  return (bits ^ (bits >>> 16)) >>> 0;
}
export function deathFragmentVelocity(enemyId: number, index: number) {
  const seed = hash(enemyId ^ Math.imul(index + 1, 0x9e3779b9));
  const angle = seed / 0x100000000 * Math.PI * 2;
  const speed = .75 + hash(seed ^ 0x517cc1b7) / 0x100000000 * .7;
  return { x: Math.cos(angle) * speed, y: 1.35 + hash(seed ^ 0x68bc21eb) / 0x100000000 * .6,
    z: Math.sin(angle) * speed };
}

// One shared bounded instanced pool. Scheduled births also survive corpse-slot reuse.
export class DeathBurst {
  private readonly births = new Float64Array(DEATH_FRAGMENT_CAPACITY).fill(-Infinity);
  private readonly origins = new Float32Array(DEATH_FRAGMENT_CAPACITY * 3);
  private readonly velocities = new Float32Array(DEATH_FRAGMENT_CAPACITY * 3);
  private readonly sizes = new Float32Array(DEATH_FRAGMENT_CAPACITY * 3);
  private readonly landingSeconds = new Float64Array(DEATH_FRAGMENT_CAPACITY);
  private readonly landings = new Float32Array(DEATH_FRAGMENT_CAPACITY * 3);
  private readonly phases = new Float32Array(DEATH_FRAGMENT_CAPACITY);
  private readonly fade = new THREE.InstancedBufferAttribute(new Float32Array(DEATH_FRAGMENT_CAPACITY), 1);
  private readonly geometry = new THREE.SphereGeometry(1, 8, 5);
  private readonly material = new THREE.MeshStandardMaterial({ color: 'white', roughness: 1, metalness: 0,
    emissiveIntensity: 0, transparent: true, depthWrite: false });
  readonly fragments = new THREE.InstancedMesh(this.geometry, this.material, DEATH_FRAGMENT_CAPACITY);
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('fragmentFade', this.fade);
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float fragmentFade; varying float vFragmentFade;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFragmentFade = fragmentFade;');
      shader.fragmentShader = `varying float vFragmentFade;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFragmentFade;');
    };
    this.material.customProgramCacheKey = () => 'pale-fragment-fade-v1';
    this.fragments.name = 'enemy-pale-shatter'; this.fragments.count = 0; this.fragments.visible = false;
    this.fragments.frustumCulled = false; this.fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fade.setUsage(THREE.DynamicDrawUsage); scene.add(this.fragments);
  }
  spawn(enemy: EnemyRenderState, atMs: number, scaleY = 1): void {
    const heavy = enemy.archetype === 'heavy', base = enemy.visualScale ?? .82;
    const sx = enemy.visualScaleX ?? base, sy = (enemy.visualScaleY ?? base) * scaleY, sz = enemy.visualScaleZ ?? base;
    for (let index = 0; index < (heavy ? 8 : 6); index++) {
      const slot = this.cursor, offset = slot * 3, piece = PIECES[index], velocity = deathFragmentVelocity(enemy.id, index);
      this.cursor = (this.cursor + 1) % DEATH_FRAGMENT_CAPACITY; this.births[slot] = atMs;
      this.origins.set([-enemy.x + piece[0] * sx, piece[1] * sy, enemy.z + piece[2] * sz], offset);
      this.velocities.set([velocity.x * sx, velocity.y * sy, velocity.z * sz], offset);
      this.sizes.set([piece[3] * sx * (heavy ? 1.2 : 1), piece[4] * sy, piece[5] * sz], offset);
      // At rest pitch/roll are zero, so the sphere's scaled vertical radius is its floor.
      const seconds = fragmentLandingSeconds(this.origins[offset + 1], this.velocities[offset + 1], this.sizes[offset + 1], GRAVITY);
      this.landingSeconds[slot] = seconds;
      this.landings.set([this.origins[offset] + this.velocities[offset] * seconds, this.sizes[offset + 1],
        this.origins[offset + 2] + this.velocities[offset + 2] * seconds], offset);
      this.phases[slot] = enemy.id * .71 + index * 2.399963;
    }
  }
  update(nowMs: number): void {
    let count = 0;
    for (let slot = 0; slot < DEATH_FRAGMENT_CAPACITY; slot++) {
      const age = nowMs - this.births[slot];
      if (age >= DEATH_FRAGMENT_LIFETIME_MS) { this.births[slot] = -Infinity; continue; }
      if (age < 0) continue;
      const offset = slot * 3, contact = this.landingSeconds[slot], seconds = Math.min(age / 1000, contact);
      const fade = Math.min(1, (DEATH_FRAGMENT_LIFETIME_MS - age) / DEATH_FRAGMENT_FADE_MS);
      if (age / 1000 >= contact) this.transform.position.fromArray(this.landings, offset);
      else this.transform.position.set(this.origins[offset] + this.velocities[offset] * seconds,
        this.origins[offset + 1] + this.velocities[offset + 1] * seconds - GRAVITY * .5 * seconds * seconds,
        this.origins[offset + 2] + this.velocities[offset + 2] * seconds);
      const settle = Math.pow(Math.max(0, 1 - seconds / contact), 2), phase = this.phases[slot];
      this.transform.rotation.set((Math.sin(phase) + seconds * 4) * settle, phase + seconds * 1.5, Math.cos(phase) * settle);
      this.transform.scale.fromArray(this.sizes, offset); // Opacity fades; physical pieces never shrink.
      this.transform.updateMatrix(); this.fragments.setMatrixAt(count, this.transform.matrix);
      this.fragments.setColorAt(count, COLORS[slot % COLORS.length]); this.fade.setX(count++, fade);
    }
    this.fragments.count = count; this.fragments.visible = count > 0;
    this.fragments.instanceMatrix.needsUpdate = true;
    if (this.fragments.instanceColor) this.fragments.instanceColor.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
  reset(): void { this.births.fill(-Infinity); this.cursor = 0; this.fragments.count = 0; this.fragments.visible = false; }
  get activeCount(): number { return this.births.reduce((count, birth) => count + Number(Number.isFinite(birth)), 0); }
  dispose(): void { this.scene.remove(this.fragments); this.fragments.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
