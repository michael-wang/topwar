import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { characterFamilies } from './characterModel';
import type { EnemyRenderState } from '../src/rendering/RenderState';

it.each(['heavy', 'giant'] as const)('%s hides full HP, shows any real damage, and clears dead, despawned and reused bars', role => {
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, characterFamilies());
  const enemy: EnemyRenderState = { id: 1, archetype: role, tier: 1, hp: 100, maxHp: 100, x: 0, z: 15 };
  const visible = () => scene.children.filter(o => o.name.startsWith('heavy-hp-') && o.visible);
  renderer.update([enemy], 0); renderer.update([{ ...enemy, z: 14 }], 100);
  expect(visible()).toHaveLength(0);
  for (const [time, hp] of [[200, 99], [400, 90], [1000, 90]] as const) {
    renderer.update([{ ...enemy, hp }], time); expect(visible()).toHaveLength(2);
  }
  const backing = scene.getObjectByName('heavy-hp-backing');
  renderer.update([{ ...enemy, hp: 0 }], 1100); expect(visible()).toHaveLength(0);
  renderer.update([], 1200); expect(visible()).toHaveLength(0);
  renderer.update([{ ...enemy, id: 2 }], 1300); expect(visible()).toHaveLength(0);
  expect(scene.getObjectByName('heavy-hp-backing')).toBe(backing);
  renderer.update([{ ...enemy, id: 2, hp: 91 }], 1400); expect(visible()).toHaveLength(2);
  renderer.reset(); expect(visible()).toHaveLength(0);
  renderer.update([enemy], 0); expect(visible()).toHaveLength(0); // Retry reuses IDs and GPU slots.
  renderer.dispose();
});

it.each(['heavy', 'giant'] as const)('%s reconstructs injured Continue state immediately without hit events or extra saved fields', role => {
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, characterFamilies());
  const restored: EnemyRenderState = { id: 42, archetype: role, tier: 1, hp: 50, maxHp: 100, x: 1, z: 18 };
  const before = structuredClone(restored);
  renderer.update([restored], 0);
  expect(scene.getObjectByName('heavy-hp-backing')?.visible).toBe(true);
  expect(scene.getObjectByName('heavy-hp-fill')?.visible).toBe(true);
  renderer.reset(); renderer.update([restored], 0);
  expect(scene.getObjectByName('heavy-hp-fill')?.visible).toBe(true);
  renderer.update([{ ...restored, archetype: 'grunt' }], 50);
  expect(scene.children.filter(o => o.name.startsWith('heavy-hp-') && o.visible)).toHaveLength(0);
  expect(restored).toEqual(before); renderer.dispose();
});
