import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DeathBurst, DEATH_PARTICLE_CAPACITY, DEATH_PARTICLE_LIFETIME_MS,
  deathParticleColor, deathParticleVelocity } from '../src/rendering/enemies/DeathBurst';
describe('enemy death burst', () => {
  it('uses deterministic directions and distinct tier colors', () => {
    expect(deathParticleVelocity(42, 0)).toEqual(deathParticleVelocity(42, 0));
    expect(deathParticleVelocity(42, 0)).not.toEqual(deathParticleVelocity(42, 1));
    expect(new Set([1, 2, 3, 4, 7].map((tier) =>
      deathParticleColor(tier).getHexString())).size).toBe(4);
  });

  it('shares one Points object, caps mass kills, expires particles, and resets', () => {
    const scene = new THREE.Scene();
    const burst = new DeathBurst(scene);
    expect(scene.children).toEqual([burst.points]);
    for (let id = 1; id <= 50; id++) burst.spawn({ id, tier: 1, x: 0, z: id, hp: 0 }, 100);
    expect(burst.activeCount).toBe(DEATH_PARTICLE_CAPACITY);
    const positions = burst.points.geometry.attributes.position as THREE.BufferAttribute;
    burst.update(150);
    expect(positions.getY(0)).toBeGreaterThan(-1000);
    burst.update(100 + DEATH_PARTICLE_LIFETIME_MS);
    expect(positions.getY(0)).toBe(-1000);
    expect(burst.activeCount).toBe(0);
    burst.reset();
    expect(burst.activeCount).toBe(0);
    const disposeGeometry = vi.spyOn(burst.points.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(burst.points.material as THREE.Material, 'dispose');
    burst.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
