import * as THREE from 'three';
import { expect, it } from 'vitest';
import { PaleShatterFragments, DEATH_FRAGMENT_CAPACITY, DEATH_FRAGMENT_LIFETIME_MS } from '../src/rendering/enemies/PaleShatterFragments';
import { fragmentLandingSeconds } from '../src/rendering/enemies/GroundedFragments';
import { createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { GIANT_CRASH_MS, GIANT_DEATH_MS } from '../src/presentation/GiantDrama';

function matrices(mesh: THREE.InstancedMesh) {
  return Array.from({ length: mesh.count }, (_, index) => {
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    mesh.getMatrixAt(index, matrix); matrix.decompose(position, rotation, scale);
    return { position, rotation, scale };
  });
}
it('solves repeatable contact at the fragment floor and stops all movement after contact', () => {
  const contact = fragmentLandingSeconds(1.426, 3.1, .209, 32);
  expect(contact).toBe(fragmentLandingSeconds(1.426, 3.1, .209, 32));
  expect(1.426 + 3.1 * contact - 16 * contact * contact).toBeCloseTo(.209, 10);
  expect(contact).toBeGreaterThan(.35); expect(contact).toBeLessThan(.45);
  const scene = new THREE.Scene(), burst = new PaleShatterFragments(scene);
  burst.spawn({ id: 42, tier: 1, x: 0, z: 8, hp: 0, archetype: 'heavy', visualScaleX: 1.89, visualScaleY: 2.1735, visualScaleZ: 1.89 }, 110, .8);
  burst.update(210); const flight = matrices(burst.fragments);
  burst.update(560); const rest = matrices(burst.fragments);
  burst.update(600); const stillRest = matrices(burst.fragments);
  burst.update(660); const fading = matrices(burst.fragments);
  for (let i = 0; i < 8; i++) {
    expect(rest[i].position.y).toBeCloseTo(rest[i].scale.y, 5);
    expect(rest[i].position).toEqual(stillRest[i].position);
    expect(rest[i].rotation).toEqual(stillRest[i].rotation);
    expect(rest[i].position).toEqual(fading[i].position);
    expect(flight[i].scale.distanceTo(rest[i].scale)).toBeLessThan(.000001);
    expect(fading[i].scale.distanceTo(rest[i].scale)).toBeLessThan(.000001);
  }
  const fade = burst.fragments.geometry.getAttribute('fragmentFade');
  expect(fade.getX(0)).toBeCloseTo(50 / 160);
  expect(DEATH_FRAGMENT_LIFETIME_MS).toBe(600);
  burst.update(1010); expect(burst.fragments.visible).toBe(false); burst.dispose();
});
it('keeps landed debris fully visible through 440 ms and handles 48 Heavy deaths in one unchanged bounded draw', () => {
  const scene = new THREE.Scene(), burst = new PaleShatterFragments(scene);
  for (let id = 0; id < 48; id++) burst.spawn({ id, tier: 1, archetype: 'heavy', x: 0, z: 8, hp: 0 }, 110, .8);
  burst.update(549);
  expect(DEATH_FRAGMENT_CAPACITY).toBe(384); expect(burst.fragments.count).toBe(384);
  expect(scene.children).toEqual([burst.fragments]);
  const fade = burst.fragments.geometry.getAttribute('fragmentFade');
  for (let i = 0; i < 384; i++) expect(fade.getX(i)).toBe(1);
  burst.update(660); expect(burst.fragments.count).toBe(384);
  expect(fade.getX(0)).toBeCloseTo(50 / 160);
  burst.update(1010); expect(burst.activeCount).toBe(0); burst.dispose();
});
it('grounds Giant chunks individually without changing fall/crash/clear clocks or shrinking them during fade', () => {
  const family = createChibiGiantFamily(), scene = new THREE.Scene(), renderer = new GiantRenderer(scene, family), hits = new HeavyHitFeedback(scene);
  const enemy = { id: 100, tier: 1, archetype: 'giant' as const, x: 0, z: 16, hp: 0, visualScaleX: 2.5004, visualScaleY: 2.66, visualScaleZ: 2.66 };
  renderer.update({ ...enemy, hp: 172 }, 0, hits); renderer.die(enemy, 1000);
  renderer.update(undefined, 1000 + GIANT_CRASH_MS + 700, hits);
  const chunks = scene.getObjectByName('giant-armor-wreckage') as THREE.InstancedMesh;
  const landed = matrices(chunks);
  renderer.update(undefined, 1000 + GIANT_CRASH_MS + 1000, hits); const rest = matrices(chunks);
  renderer.update(undefined, 2800, hits); const fade = matrices(chunks);
  expect(landed).toHaveLength(12);
  for (let i = 0; i < 12; i++) {
    expect(landed[i].position.y).toBeCloseTo(landed[i].scale.y * .5, 5);
    expect(landed[i].position).toEqual(rest[i].position); expect(landed[i].rotation).toEqual(rest[i].rotation);
    expect(fade[i].scale.distanceTo(rest[i].scale)).toBeLessThan(.000001);
  }
  expect(GIANT_CRASH_MS).toBe(520); expect(GIANT_DEATH_MS).toBe(2400);
  renderer.update(undefined, 1000 + GIANT_DEATH_MS, hits); expect(chunks.visible).toBe(false);
  renderer.dispose(); hits.dispose(); family.dispose();
});
