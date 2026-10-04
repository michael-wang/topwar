import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export const BLOOD_DROPLETS_PER_DEATH = 6;
export const BLOOD_LIFETIME_MS = 150;
export const BLOOD_CAPACITY = 384; // 64 concurrent sprays, bounded circular reuse.
export const BLOOD_COLORS = ['#b93e45', '#d95652'] as const;
const colors = BLOOD_COLORS.map(color => new THREE.Color(color));
export function bloodVelocity(id: number, index: number) {
  const seed = Math.imul(id ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b) >>> 0;
  const angle = seed / 0x100000000 * Math.PI * 2;
  return { x: Math.cos(angle) * (1.2 + index * .08), y: .5 + index * .13,
    z: Math.sin(angle) * 1.8 }; // Deterministic outward spray, without combat input.
}

// Shared lethal-only matte droplets, with no decals or ground residue.
export class LethalBloodSpray {
  private readonly births = new Float64Array(BLOOD_CAPACITY).fill(-Infinity);
  private readonly origins = new Float32Array(BLOOD_CAPACITY * 3);
  private readonly velocities = new Float32Array(BLOOD_CAPACITY * 3);
  private readonly sizes = new Float32Array(BLOOD_CAPACITY);
  private readonly fade = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_CAPACITY), 1);
  private readonly geometry = new THREE.SphereGeometry(1, 6, 3);
  private readonly material = new THREE.MeshStandardMaterial({ color: 'white', roughness: 1, metalness: 0,
    transparent: true, depthWrite: false, emissiveIntensity: 0 });
  readonly droplets = new THREE.InstancedMesh(this.geometry, this.material, BLOOD_CAPACITY);
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('bloodFade', this.fade);
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float bloodFade; varying float vBloodFade;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBloodFade = bloodFade;');
      shader.fragmentShader = `varying float vBloodFade;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vBloodFade;');
    };
    this.material.customProgramCacheKey = () => 'lethal-blood-fade-v1';
    this.droplets.name = 'enemy-lethal-blood'; this.droplets.count = 0; this.droplets.visible = false;
    this.droplets.frustumCulled = false; this.droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fade.setUsage(THREE.DynamicDrawUsage); scene.add(this.droplets);
  }
  spawn(enemy: EnemyRenderState, nowMs: number, scaleY = 1): void {
    const sy = (enemy.visualScaleY ?? enemy.visualScale ?? .82) * scaleY;
    const spread = Math.sqrt(enemy.visualScale ?? .82);
    for (let index = 0; index < BLOOD_DROPLETS_PER_DEATH; index++) {
      const slot = this.cursor, offset = slot * 3, velocity = bloodVelocity(enemy.id, index);
      this.cursor = (slot + 1) % BLOOD_CAPACITY; this.births[slot] = nowMs;
      const sz = enemy.visualScaleZ ?? enemy.visualScale ?? .82;
      this.origins.set([-enemy.x, .43 * sy, enemy.z - .28 * sz], offset);
      this.velocities.set([velocity.x * spread, velocity.y * spread, velocity.z * spread], offset);
      this.sizes[slot] = (.035 + index % 3 * .008) * spread;
    }
  }
  update(nowMs: number): void {
    let count = 0;
    for (let slot = 0; slot < BLOOD_CAPACITY; slot++) {
      const age = nowMs - this.births[slot];
      if (age >= BLOOD_LIFETIME_MS) { this.births[slot] = -Infinity; continue; }
      if (age < 0) continue;
      const offset = slot * 3, seconds = age / 1000, size = this.sizes[slot];
      this.transform.position.set(this.origins[offset] + this.velocities[offset] * seconds,
        this.origins[offset + 1] + this.velocities[offset + 1] * seconds - 8 * seconds * seconds,
        this.origins[offset + 2] + this.velocities[offset + 2] * seconds);
      this.transform.rotation.set(0, slot * 2.399963, .45);
      this.transform.scale.set(size, size * .7, size * 1.35);
      this.transform.updateMatrix(); this.droplets.setMatrixAt(count, this.transform.matrix);
      this.droplets.setColorAt(count, colors[slot % colors.length]);
      this.fade.setX(count++, Math.min(1, (BLOOD_LIFETIME_MS - age) / 50));
    }
    this.droplets.count = count; this.droplets.visible = count > 0;
    this.droplets.instanceMatrix.needsUpdate = true;
    if (this.droplets.instanceColor) this.droplets.instanceColor.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
  reset(): void { this.births.fill(-Infinity); this.cursor = 0; this.droplets.count = 0; this.droplets.visible = false; }
  dispose(): void { this.scene.remove(this.droplets); this.droplets.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
