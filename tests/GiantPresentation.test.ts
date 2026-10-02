import * as THREE from 'three';
import { expect, it } from 'vitest';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { DeathBurst } from '../src/rendering/enemies/DeathBurst';

it('adds an armored silhouette, heavier rate-limited sparks and a stronger disposable death beat', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(.5, 1, .5);
  const gray = new THREE.BoxGeometry(.5, 1, .5), material = new THREE.MeshStandardMaterial();
  const source = new THREE.Mesh(geometry, material);
  const renderer = new GiantRenderer(scene, source, source, source, [source,source,source,source], new THREE.Mesh(gray,material));
  const hits = new HeavyHitFeedback(scene);
  const enemy = { id: 1, tier: 1, archetype: 'giant' as const, hp: 28, maxHp: 28, x: 0, z: 14,
    visualScaleX: 2.856, visualScaleY: 3.36, visualScaleZ: 3.36, gaitCycleMs: 850 };
  renderer.update(enemy, 0, hits);
  const group = scene.getObjectByName('giant-assault-soldier')!;
  expect(group.children.length).toBeGreaterThan(3);
  expect(group.scale.y).toBeCloseTo(3.36);
  expect(hits.observe(enemy, 1)).toBe(true);
  expect(hits.observe(enemy, 146)).toBe(false);
  hits.update(new Set([1]), 1); renderer.update(enemy, 1, hits);
  expect(scene.getObjectByName('heavy-hit-sparks')!.children.filter(s => s.visible)).toHaveLength(6);
  expect(group.position.z).toBeCloseTo(14.11);
  hits.update(new Set([1]), 120); renderer.update(enemy, 120, hits);
  expect(group.position.z).toBe(14);
  const burst = new DeathBurst(scene, true); burst.spawn(enemy, 200);
  expect(burst.activeCount).toBe(24);
  renderer.die(enemy, 200); renderer.update(undefined, 320, hits);
  expect(scene.getObjectByName('giant-death-impact')!.visible).toBe(true);
  expect((group.children[0] as THREE.Mesh).geometry).toBe(gray);
  burst.update(500); expect(burst.activeCount).toBe(24);
  burst.update(651); expect(burst.activeCount).toBe(0);
  renderer.update(undefined, 851, hits); expect(group.visible).toBe(false);
  let borrowedDisposed = false; geometry.addEventListener('dispose', () => { borrowedDisposed = true; });
  renderer.reset(); renderer.dispose(); hits.dispose(); burst.dispose();
  expect(scene.children).toHaveLength(0); expect(borrowedDisposed).toBe(false);
  geometry.dispose(); gray.dispose(); material.dispose();
});
