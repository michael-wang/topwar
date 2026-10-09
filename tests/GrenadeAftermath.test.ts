import { expect, it } from 'vitest';
import * as THREE from 'three';
import { GroundScorchMarks, SCORCH } from '../src/rendering/GroundScorchMarks';
import { GrenadeRenderer } from '../src/rendering/GrenadeRenderer';
import { GRENADE_DEBRIS_COUNT, grenadeDebrisPose } from '../src/presentation/GrenadeMotion';

it('sprays a fixed number of deterministic fragments radially, with mixed heights and gravity', () => {
  const heights = new Set<number>();
  for (let i = 0; i < GRENADE_DEBRIS_COUNT; i++) {
    const early = grenadeDebrisPose(i, 100, 4), later = grenadeDebrisPose(i, 250, 4), landed = grenadeDebrisPose(i, 1000, 4);
    expect(Math.hypot(later.x, later.z)).toBeGreaterThan(Math.hypot(early.x, early.z));
    expect(early.x * later.x + early.z * later.z).toBeGreaterThan(0);
    expect(landed.y).toBeCloseTo(.06); heights.add(later.y);
    expect(grenadeDebrisPose(i, 250, 4)).toEqual(later);
  }
  expect(heights.size).toBe(5);
});

it('caps scorch marks, recycles the oldest, fades on the presentation clock and resets/disposes', () => {
  const scene = new THREE.Scene(), marks = new GroundScorchMarks(scene);
  const mesh = scene.getObjectByName('grenade-ground-scorch') as THREE.InstancedMesh;
  const resources = [mesh, mesh.geometry, mesh.material];
  for (let i = 0; i < 30; i++) { marks.present(i, 14, 4, i * 100); marks.update(i * 100, 0); expect(marks.active).toBeLessThanOrEqual(SCORCH.capacity); }
  const positions: number[] = [], matrix = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); positions.push(-matrix.elements[12]); }
  expect(positions.sort((a,b) => a-b)).toEqual([22,23,24,25,26,27,28,29]);
  marks.update(16000, 2); const alpha = Array.from(mesh.geometry.getAttribute('scorchOpacity').array);
  expect(alpha.every(a => a > 0 && a < .72)).toBe(true);
  const transforms = Array.from(mesh.instanceMatrix.array);
  marks.update(16000, 2); expect(Array.from(mesh.instanceMatrix.array)).toEqual(transforms);
  expect(Array.from(mesh.geometry.getAttribute('scorchOpacity').array)).toEqual(alpha);
  expect([mesh, mesh.geometry, mesh.material]).toEqual(resources);
  marks.update(21000, 0); expect(marks.active).toBe(0);
  marks.present(0,14,4,21000); marks.update(21000,0); marks.reset(); expect(mesh.visible).toBe(false); expect(marks.active).toBe(0);
  marks.dispose(); expect(scene.children).toEqual([]);
});

it('reuses debris and scorch resources across repeated blasts without changing render input or authoritative events', () => {
  const scene = new THREE.Scene(), renderer = new GrenadeRenderer(scene);
  const state = { supply:null, flight:null, originZ:0, elapsedSeconds:0 };
  const event = { kind:'grenadeDetonated' as const, x:1,z:14,radius:4,victims:[] };
  const before = JSON.stringify({state,event}), children = [...scene.children];
  for (let i = 0; i < 60; i++) {
    renderer.present([event],i*650); renderer.update(state,i*650+300);
    expect(renderer.getDebugStats().activeScorches).toBeLessThanOrEqual(8);
    for(const mesh of scene.children.filter(m=>m.name.startsWith('grenade-debris')) as THREE.InstancedMesh[]) expect(mesh.count).toBe(GRENADE_DEBRIS_COUNT);
    expect(scene.children).toEqual(children);
  }
  expect(JSON.stringify({state,event})).toBe(before);
  renderer.reset(); expect(scene.children.every(m=>!m.visible)).toBe(true);
  renderer.dispose(); expect(scene.children).toEqual([]);
});
