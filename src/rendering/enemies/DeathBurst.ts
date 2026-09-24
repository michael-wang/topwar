import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export const DEATH_PARTICLE_CAPACITY = 192;
export const DEATH_PARTICLE_LIFETIME_MS = 260;
const PARTICLES_PER_DEATH = 6;
const PALETTE: Record<EnemyRenderState['type'], THREE.Color> = {
  grunt: new THREE.Color('#d99581'),
  brute: new THREE.Color('#ff6050'),
  tier3: new THREE.Color('#ff79cf'),
};

function hash(value: number): number {
  let bits = value >>> 0;
  bits ^= bits >>> 16;
  bits = Math.imul(bits, 0x7feb352d);
  bits ^= bits >>> 15;
  bits = Math.imul(bits, 0x846ca68b);
  return (bits ^ (bits >>> 16)) >>> 0;
}

export function deathParticleVelocity(enemyId: number, particleIndex: number):
  { x: number; y: number; z: number } {
  const seed = hash(enemyId ^ Math.imul(particleIndex + 1, 0x9e3779b9));
  const angle = (seed / 0x100000000) * Math.PI * 2;
  const speed = 0.55 + ((hash(seed ^ 0x517cc1b7) / 0x100000000) * 0.6);
  return { x: Math.cos(angle) * speed, y: 1.15 + (hash(seed ^ 0x68bc21eb) / 0x100000000) * 0.8,
    z: Math.sin(angle) * speed };
}

export function deathParticleColor(type: EnemyRenderState['type']): THREE.Color {
  return PALETTE[type];
}

export class DeathBurst {
  private readonly positions = new Float32Array(DEATH_PARTICLE_CAPACITY * 3);
  private readonly colors = new Float32Array(DEATH_PARTICLE_CAPACITY * 3);
  private readonly origins = new Float32Array(DEATH_PARTICLE_CAPACITY * 3);
  private readonly velocities = new Float32Array(DEATH_PARTICLE_CAPACITY * 3);
  private readonly births = new Float64Array(DEATH_PARTICLE_CAPACITY).fill(-Infinity);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.PointsMaterial({ size: 0.085, vertexColors: true,
    depthWrite: false, sizeAttenuation: true });
  readonly points = new THREE.Points(this.geometry, this.material);
  private cursor = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.positions.fill(-1000);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.points.name = 'enemy-death-burst';
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  spawn(enemy: EnemyRenderState, nowMs: number): void {
    const color = deathParticleColor(enemy.type);
    for (let index = 0; index < PARTICLES_PER_DEATH; index++) {
      const slot = this.cursor;
      const offset = slot * 3;
      this.cursor = (this.cursor + 1) % DEATH_PARTICLE_CAPACITY;
      const velocity = deathParticleVelocity(enemy.id, index);
      this.births[slot] = nowMs;
      this.origins[offset] = this.positions[offset] = -enemy.x;
      this.origins[offset + 1] = this.positions[offset + 1] = 0.58;
      this.origins[offset + 2] = this.positions[offset + 2] = enemy.z;
      this.velocities[offset] = velocity.x;
      this.velocities[offset + 1] = velocity.y;
      this.velocities[offset + 2] = velocity.z;
      this.colors[offset] = color.r;
      this.colors[offset + 1] = color.g;
      this.colors[offset + 2] = color.b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  update(nowMs: number): void {
    for (let slot = 0; slot < DEATH_PARTICLE_CAPACITY; slot++) {
      const ageMs = nowMs - this.births[slot];
      if (ageMs < 0 || ageMs >= DEATH_PARTICLE_LIFETIME_MS) {
        this.positions[slot * 3 + 1] = -1000;
        if (ageMs >= DEATH_PARTICLE_LIFETIME_MS) this.births[slot] = -Infinity;
        continue;
      }
      const seconds = ageMs / 1000;
      const offset = slot * 3;
      this.positions[offset] = this.origins[offset] + this.velocities[offset] * seconds;
      this.positions[offset + 1] = this.origins[offset + 1] + this.velocities[offset + 1] * seconds
        - 4.5 * seconds * seconds;
      this.positions[offset + 2] = this.origins[offset + 2] + this.velocities[offset + 2] * seconds;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  reset(): void {
    this.births.fill(-Infinity);
    this.positions.fill(-1000);
    this.cursor = 0;
    this.geometry.attributes.position.needsUpdate = true;
  }

  get activeCount(): number {
    let count = 0;
    for (const birth of this.births) if (birth !== -Infinity) count++;
    return count;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
