import * as THREE from 'three';
import { expect, it } from 'vitest';
import { DeathReadEcho, DEATH_ECHO_CAPACITY, DEATH_ECHO_MS } from '../src/rendering/enemies/DeathReadEcho';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';

it('bounds the one-pass pale echo, never writes depth, and ends before breakup', () => {
  const scene = new THREE.Scene(), family = createChibiGruntFamily(), echo = new DeathReadEcho(scene, family);
  const mesh = scene.getObjectByName('enemy-death-read-echo') as THREE.InstancedMesh;
  const material = mesh.material as THREE.MeshBasicMaterial;
  expect(mesh.geometry.attributes.position.count / 3).toBeLessThanOrEqual(3000);
  expect(material.depthTest).toBe(false); expect(material.depthWrite).toBe(false);
  expect(DEATH_ECHO_MS).toBe(100); expect(DEATH_ECHO_CAPACITY).toBe(48);
  for (const age of [0, 70, 90, 99, 100, 130]) {
    echo.begin(); for (let i = 0; i < 90; i++) echo.submit(new THREE.Matrix4(), i % 4, age); echo.finish();
    expect(mesh.count).toBe(age < 100 ? 48 : 0);
    if (age < 100) expect(mesh.geometry.getAttribute('echoOpacity').getX(0)).toBeLessThanOrEqual(.300001);
  }
  echo.reset(); expect(mesh.visible).toBe(false); echo.dispose(); family.dispose(); expect(scene.children).toHaveLength(0);
});
it('selects the short fallback only for a surviving close follower, deterministically across reset', () => {
  const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, families);
  const lead = { id: 23, tier: 1, archetype: 'grunt' as const, hp: 1, x: 0, z: 8 };
  const behind = { ...lead, id: 24, z: 8.22 };
  const mesh = scene.getObjectByName('enemy-death-read-echo') as THREE.InstancedMesh;
  for (let restart = 0; restart < 2; restart++) {
    renderer.reset(); renderer.update([lead, behind], 0, true); renderer.update([lead, behind], 2000, true);
    renderer.update([behind], 2010, true); expect(mesh.count).toBe(1);
    renderer.update([behind], 2109, true); expect(mesh.count).toBe(1);
    renderer.update([behind], 2110, true); expect(mesh.count).toBe(0);
  }
  renderer.reset(); renderer.update([lead, behind], 0, true); renderer.update([], 10, true); expect(mesh.count).toBe(0);
  renderer.reset(); renderer.update([lead, { ...behind, z: 9 }], 0, true); renderer.update([{ ...behind, z: 9 }], 10, true); expect(mesh.count).toBe(0);
  renderer.dispose(); Object.values(families).forEach(f => f.dispose());
});
