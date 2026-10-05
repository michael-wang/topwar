import * as THREE from 'three';
import { expect, it } from 'vitest';
import { HERO_FRONT_BIAS, HERO_RIBBON_COUNTS, splashShapes } from '../src/rendering/enemies/FluidBloodSplash';
import { IntegratedDeathBlood } from '../src/rendering/enemies/IntegratedDeathBlood';
import { ENEMY_DEATH_TIMING, ENEMY_SHELL_OPENING, enemyBodyOpening, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';

it('keeps hero roots within the front inner torso shell and launches sideways/upward/toward the defenders', () => {
  expect(HERO_RIBBON_COUNTS).toEqual({ grunt: 0, heavy: 2, giant: 2 });
  expect(HERO_FRONT_BIAS.giant).toBeGreaterThan(HERO_FRONT_BIAS.heavy);
  for (const role of ['heavy', 'giant'] as const) {
    const root = new THREE.Matrix4().makeRotationY(Math.PI);
    for (const shapes of splashShapes[role]) {
      for (const hero of shapes.slice(0, 2)) {
        const radii = role === 'heavy' ? [.34, .275] : [.42, .29];
        expect((hero.origin.x / radii[0]) ** 2 + (hero.origin.z / radii[1]) ** 2).toBeLessThan(1);
        expect(hero.origin.y).toBeGreaterThan(role === 'heavy' ? .20 : .40);
        expect(hero.origin.y).toBeLessThan(role === 'heavy' ? .50 : .85);
        expect(hero.direction.clone().transformDirection(root).z).toBeCloseTo(-HERO_FRONT_BIAS[role]);
        expect(hero.direction.y).toBeGreaterThan(.35);
        expect(Math.abs(hero.direction.x)).toBeGreaterThan(.65);
        expect(hero.extensionRate).toBe(role === 'giant' ? 1.20 : 1.15);
      }
      expect(shapes[0].direction.x * shapes[1].direction.x).toBeLessThan(0);
      expect(shapes.slice(2).some(s => s.direction.z < 0)).toBe(true);
    }
  }
});
it('opens a narrow blood seam after the collapsed hold while keeping the original world separation/fade caps', () => {
  for (const role of ['heavy', 'giant'] as const) {
    const family = role === 'heavy' ? createChibiHeavyFamily() : createChibiGiantFamily();
    expect(family.lethalReaction!.transition.geometry.hasAttribute('deathPieceDirection')).toBe(true);
    const opening = ENEMY_SHELL_OPENING[role], timing = ENEMY_DEATH_TIMING[role];
    expect(enemyBodyOpening(opening.startMs, role, 0)).toBe(0);
    expect(enemyBodyOpening(opening.readyMs, role, 0)).toBeCloseTo(timing.breakupDistance * .28);
    expect(opening.startMs).toBeGreaterThanOrEqual(timing.breakupStartMs);
    for (let age = 0; age <= timing.totalMs; age += 10) {
      expect(enemyBodyOpening(age, role, enemyDeathPose(age, timing).breakup)).toBeLessThanOrEqual(timing.breakupDistance);
    }
    family.dispose();
  }
});
it('preserves Grunt V2.2 splash composition exactly and keeps blood depth testing with no forced layer', () => {
  const data = splashShapes.grunt.map(shapes => shapes.map(s => [s.origin.toArray(), s.direction.toArray(), s.length, s.width, s.bend, s.delay]));
  // Recorded from the accepted V2.2 baseline, excluding the new unit extension-rate field.
  const serialized = JSON.stringify(data, (_, value) => typeof value === 'number' ? Number(value.toFixed(10)) : value);
  // Ignore last-bit sin/cos differences across Node/browser engines.
  let checksum = 2166136261;
  for (let i = 0; i < serialized.length; i++) checksum = Math.imul(checksum ^ serialized.charCodeAt(i), 16777619);
  expect(checksum >>> 0).toBe(3991010272);
  expect(splashShapes.grunt.flat().every(s => s.extensionRate === 1)).toBe(true);
  const scene = new THREE.Scene(), blood = new IntegratedDeathBlood(scene);
  for (const mesh of scene.children as THREE.Mesh[]) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.depthTest).toBe(true); expect(mesh.renderOrder).toBe(0);
    expect(material.emissive.getHex()).toBe(0);
    expect(mesh.geometry.hasAttribute('uv')).toBe(false);
  }
  blood.dispose(); expect(scene.children).toHaveLength(0);
});
