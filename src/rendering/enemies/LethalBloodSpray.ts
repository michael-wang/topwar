import * as THREE from 'three';

export const BLOOD_DROPLETS_PER_DEATH = 8;
export const BLOOD_LIFETIME_MS = 210;
export const BLOOD_CAPACITY = 384; // 48 concurrent sprays, bounded circular reuse.
export const BLOOD_COLORS = ['#9f2734', '#c93443', '#e05258'] as const;
const colors = BLOOD_COLORS.map(color => new THREE.Color(color));
export function bloodVelocity(id: number, index: number, target = { x: 0, y: 0, z: 0 }) {
  const seed = Math.imul(id ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b) >>> 0;
  const angle = seed / 0x100000000 * Math.PI * 2;
  const radial = .80 + index * .03;
  target.x = Math.cos(angle) * radial; target.y = 2.6 + index * .2; target.z = Math.sin(angle) * radial;
  return target; // 76–80% upward travel before gravity, not a ground spray.
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
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly direction = new THREE.Vector3();
  private readonly velocity = { x: 0, y: 0, z: 0 };
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
  spawn(id: number, startsAtMs: number, origin: THREE.Vector3, adaptation = 1): void {
    for (let index = 0; index < BLOOD_DROPLETS_PER_DEATH; index++) {
      const slot = this.cursor, offset = slot * 3, velocity = bloodVelocity(id, index, this.velocity);
      this.cursor = (slot + 1) % BLOOD_CAPACITY; this.births[slot] = startsAtMs;
      // Small crown at birth keeps the eight splashes distinct, instead of one
      // overlapping red spike. Travel remains predominantly upward.
      const radial = Math.hypot(velocity.x, velocity.z), radius = (.06 + index % 3 * .015) * adaptation;
      this.origins[offset] = origin.x + velocity.x / radial * radius; this.origins[offset + 1] = origin.y;
      this.origins[offset + 2] = origin.z + velocity.z / radial * radius;
      this.velocities[offset] = velocity.x * adaptation;
      this.velocities[offset + 1] = velocity.y * adaptation;
      this.velocities[offset + 2] = velocity.z * adaptation;
      this.sizes[slot] = (.045 + index % 3 * .015) * adaptation;
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
        this.origins[offset + 1] + this.velocities[offset + 1] * seconds - 4 * seconds * seconds,
        this.origins[offset + 2] + this.velocities[offset + 2] * seconds);
      this.direction.set(this.velocities[offset], this.velocities[offset + 1] - 8 * seconds,
        this.velocities[offset + 2]).normalize();
      this.transform.quaternion.setFromUnitVectors(this.up, this.direction);
      this.transform.scale.set(size * .55, size * (1.6 + slot % 3 * .4), size * .55);
      this.transform.updateMatrix(); this.droplets.setMatrixAt(count, this.transform.matrix);
      this.droplets.setColorAt(count, colors[slot % colors.length]);
      this.fade.setX(count++, Math.min(1, (BLOOD_LIFETIME_MS - age) / 25));
    }
    this.droplets.count = count; this.droplets.visible = count > 0;
    this.droplets.instanceMatrix.needsUpdate = true;
    if (this.droplets.instanceColor) this.droplets.instanceColor.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
  reset(): void { this.births.fill(-Infinity); this.cursor = 0; this.droplets.count = 0; this.droplets.visible = false; }
  dispose(): void { this.scene.remove(this.droplets); this.droplets.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
