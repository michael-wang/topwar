import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DeathBurst, DEATH_PARTICLE_CAPACITY, DEATH_PARTICLE_LIFETIME_MS,
  deathParticleColor, deathParticleVelocity } from '../src/rendering/enemies/DeathBurst';
import { SquadRenderer, soldierSpawnScale, tierUpScale } from '../src/rendering/squad/SquadRenderer';

describe('enemy death burst', () => {
  it('uses deterministic directions and distinct tier colors', () => {
    expect(deathParticleVelocity(42, 0)).toEqual(deathParticleVelocity(42, 0));
    expect(deathParticleVelocity(42, 0)).not.toEqual(deathParticleVelocity(42, 1));
    expect(new Set(['grunt', 'brute', 'tier3'].map((type) =>
      deathParticleColor(type as 'grunt' | 'brute' | 'tier3').getHexString())).size).toBe(3);
  });

  it('shares one Points object, caps mass kills, expires particles, and resets', () => {
    const scene = new THREE.Scene();
    const burst = new DeathBurst(scene);
    expect(scene.children).toEqual([burst.points]);
    for (let id = 1; id <= 50; id++) burst.spawn({ id, type: 'grunt', x: 0, z: id, hp: 0 }, 100);
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

describe('squad payoff', () => {
  const state = (count: number, tier2RifleCount = 0) => ({ player: { x: 0.3, z: 2 },
    squad: { count, tier2RifleCount, rocketCount: 0, formationSpacing: 0.45 },
    track: { halfWidth: 2.5, defenseLineZ: 0 }, enemies: [], streamRewards: [],
    gates: [], pickups: [], projectiles: [] });
  const soldiers = (scene: THREE.Scene) => scene.children.filter(
    (child): child is THREE.Group => child instanceof THREE.Group);
  const ring = (scene: THREE.Scene) => scene.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
      && child.geometry instanceof THREE.RingGeometry)!;

  it('pops only newly visible soldiers and settles without moving their anchors', () => {
    expect(soldierSpawnScale(0)).toBeCloseTo(1.35);
    expect(soldierSpawnScale(190)).toBe(1);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    renderer.update(state(1), 100);
    const [first] = soldiers(scene);
    const x = first.position.x;
    const z = first.position.z;
    expect(first.scale.x).toBeCloseTo(1.35);
    renderer.update(state(1), 300);
    expect(first.scale.x).toBe(1);
    expect([first.position.x, first.position.z]).toEqual([x, z]);
    renderer.update(state(2), 400);
    const [, second] = soldiers(scene);
    expect(first.scale.x).toBe(1);
    expect(second.scale.x).toBeCloseTo(1.35);
    renderer.update(state(2), 600);
    expect(second.scale.x).toBe(1);
    renderer.dispose();
  });

  it('highlights a Tier-2 increase, expands one ground ring, then clears on reset', () => {
    expect(tierUpScale(0)).toBeCloseTo(1.25);
    expect(tierUpScale(360)).toBe(1);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    renderer.update(state(9), 0);
    expect(ring(scene).visible).toBe(false);
    renderer.update(state(1, 1), 500);
    const [heavy] = soldiers(scene);
    expect(heavy.scale.x).toBeGreaterThan(1.85);
    expect(heavy.scale.x).toBeLessThan(2.4);
    expect(ring(scene).visible).toBe(true);
    const startingRingScale = ring(scene).scale.x;
    const glowMaterial = (heavy.children[0] as THREE.Mesh).material;
    renderer.update(state(1, 1), 600);
    expect(ring(scene).scale.x).toBeGreaterThan(startingRingScale);
    expect((heavy.children[0] as THREE.Mesh).material).toBe(glowMaterial);
    renderer.update(state(1, 1), 700);
    expect((heavy.children[0] as THREE.Mesh).material).not.toBe(glowMaterial);
    renderer.update(state(1, 1), 870);
    expect(heavy.scale.x).toBe(1.85);
    expect(ring(scene).visible).toBe(false);
    renderer.reset();
    expect(ring(scene).visible).toBe(false);
    expect(heavy.visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
