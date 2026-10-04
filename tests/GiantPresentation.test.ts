import { createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';

it('uses the dedicated crest/maul silhouette, bounded sparks and the shared frozen intact phase and no crash resources', () => {
  const scene = new THREE.Scene(), family = createChibiGiantFamily();
  const renderer = new GiantRenderer(scene, family);
  const hits = new HeavyHitFeedback(scene);
  const enemy = { id: 1, tier: 1, archetype: 'giant' as const, hp: 210, maxHp: 210, x: 0, z: 14,
    visualScaleX: 3.4272, visualScaleY: 5.04, visualScaleZ: 5.04, gaitCycleMs: 850 };
  renderer.update(enemy, 0, hits);
  const group = scene.getObjectByName('giant-assault-soldier')!;
  expect(group.getObjectByName('giant-maul')).toBeDefined();
  expect(group.children).toHaveLength(4);
  const dimensions = renderer.getModelDimensions(), bar = renderer.healthBarLayout(enemy);
  expect(dimensions.width).toBeGreaterThan(1);
  expect(bar.width).toBeCloseTo(dimensions.width * enemy.visualScaleX * .75);
  expect(bar.y).toBeGreaterThan(dimensions.height * enemy.visualScaleY);
  expect(group.scale.y).toBeGreaterThan(4.9);
  expect(hits.observe(enemy, 1)).toBe(true);
  expect(hits.observe(enemy, 146)).toBe(false);
  hits.update(new Set([1]), 1); renderer.update(enemy, 1, hits);
  expect(scene.getObjectByName('heavy-hit-sparks')!.children.filter(s => s.visible)).toHaveLength(3);
  expect(group.position.z).toBeCloseTo(14.11);
  hits.update(new Set([1]), 120); renderer.update(enemy, 120, hits);
  expect(group.position.z).toBe(14);
  renderer.die(enemy, 200); renderer.update(undefined, 320, hits);
  expect(scene.getObjectByName('giant-death-impact')).toBeUndefined();
  expect(group.visible).toBe(true);
  const weapon=group.getObjectByName('giant-maul')!, localGrip=weapon.matrix.clone();
  renderer.update(undefined, 200+ENEMY_DEATH_TIMING.giant.totalMs-1, hits);
  expect(group.rotation.x).toBeCloseTo(-.12);
  expect(family.runFrames.map(frame => frame.geometry)).toContain((group.children[0] as THREE.Mesh).geometry);
  expect(scene.getObjectByName('giant-armor-wreckage')).toBeUndefined();
  expect(group.visible).toBe(true);expect(weapon.matrix.equals(localGrip)).toBe(true);
  renderer.update(undefined, 200+ENEMY_DEATH_TIMING.giant.totalMs, hits);expect(group.visible).toBe(false);
  let borrowedDisposed = false; family.body.geometry.addEventListener('dispose', () => { borrowedDisposed = true; });
  renderer.reset(); renderer.dispose(); hits.dispose();
  expect(scene.children).toHaveLength(0); expect(borrowedDisposed).toBe(false);
  family.dispose();
});


it('settles between impacts throughout a 30-second LV6 Giant fight without growing the effect pool', () => {
  const scene = new THREE.Scene(), hits = new HeavyHitFeedback(scene);
  const enemy = { id: 1, tier: 1, archetype: 'giant' as const, hp: 210, maxHp: 210, x: 0, z: 30,
    visualScaleX: 3.4272, visualScaleY: 5.04, visualScaleZ: 5.04 };
  let reactions = 0;
  for (let shot = 0; shot < 210; shot++) {
    const now = shot * 1000 / 6.9;
    hits.update(new Set([1]), now);
    if (hits.observe({ ...enemy, hp: 210 - shot }, now)) reactions++;
    expect(hits.strength(1, now + 110)).toBe(0);
  }
  expect(reactions).toBe(105);
  expect(scene.children.length).toBeLessThanOrEqual(4);
  hits.update(new Set([1]), 31000);
  expect(scene.children.every(child => !child.visible)).toBe(true);
  hits.reset(); hits.dispose(); expect(scene.children).toHaveLength(0);
});
