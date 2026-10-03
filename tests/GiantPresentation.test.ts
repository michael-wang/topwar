import { giantFamily } from './characterModel';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { DeathBurst } from '../src/rendering/enemies/DeathBurst';

it('adds an armored silhouette, heavier rate-limited sparks and a stronger disposable death beat', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(.5, 1, .5);
  const gray = new THREE.BoxGeometry(.5, 1, .5), material = new THREE.MeshStandardMaterial();
  const source = new THREE.Mesh(geometry, material);
  const renderer = new GiantRenderer(scene, giantFamily(source, source, source, [source,source,source,source], new THREE.Mesh(gray,material)));
  const hits = new HeavyHitFeedback(scene);
  const enemy = { id: 1, tier: 1, archetype: 'giant' as const, hp: 210, maxHp: 210, x: 0, z: 14,
    visualScaleX: 3.4272, visualScaleY: 5.04, visualScaleZ: 5.04, gaitCycleMs: 850 };
  renderer.update(enemy, 0, hits);
  const group = scene.getObjectByName('giant-assault-soldier')!;
  expect(group.getObjectByName('giant-mace')).toBeDefined();
  expect(group.children.filter(child => child.name === 'giant-arm')).toHaveLength(2);
  const dimensions = renderer.getModelDimensions(), bar = renderer.healthBarLayout(enemy);
  expect(dimensions.width).toBeGreaterThan(1);
  expect(bar.width).toBeCloseTo(dimensions.width * enemy.visualScaleX * .75);
  expect(bar.y).toBeGreaterThan(dimensions.height * enemy.visualScaleY);
  expect(group.scale.y).toBeCloseTo(5.04);
  expect(hits.observe(enemy, 1)).toBe(true);
  expect(hits.observe(enemy, 146)).toBe(false);
  hits.update(new Set([1]), 1); renderer.update(enemy, 1, hits);
  expect(scene.getObjectByName('heavy-hit-sparks')!.children.filter(s => s.visible)).toHaveLength(6);
  expect(group.position.z).toBeCloseTo(14.11);
  hits.update(new Set([1]), 120); renderer.update(enemy, 120, hits);
  expect(group.position.z).toBe(14);
  const burst = new DeathBurst(scene, true); burst.spawn(enemy, 200);
  expect(burst.activeCount).toBe(36);
  renderer.die(enemy, 200); renderer.update(undefined, 320, hits);
  expect(scene.getObjectByName('giant-death-impact')!.visible).toBe(false);
  expect(group.visible).toBe(true);
  renderer.update(undefined, 750, hits);
  expect(scene.getObjectByName('giant-death-impact')!.visible).toBe(true);
  expect((group.children[0] as THREE.Mesh).geometry).toBe(geometry);
  burst.update(500); expect(burst.activeCount).toBe(36);
  burst.update(651); expect(burst.activeCount).toBe(0);
  renderer.update(undefined, 851, hits); expect(group.visible).toBe(false);
  expect(scene.getObjectByName('giant-armor-wreckage')!.visible).toBe(true);
  renderer.update(undefined, 2601, hits); expect(scene.getObjectByName('giant-armor-wreckage')!.visible).toBe(false);
  let borrowedDisposed = false; geometry.addEventListener('dispose', () => { borrowedDisposed = true; });
  renderer.reset(); renderer.dispose(); hits.dispose(); burst.dispose();
  expect(scene.children).toHaveLength(0); expect(borrowedDisposed).toBe(false);
  geometry.dispose(); gray.dispose(); material.dispose();
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
