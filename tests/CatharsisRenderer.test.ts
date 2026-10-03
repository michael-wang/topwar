import { expect, it } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import * as THREE from 'three';
import { AttackLaneRenderer } from '../src/rendering/AttackLaneRenderer';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { bodyModel, grayBodyModel, helmetModel, runFrames, vestModel } from './characterModel';

it('renders configured corridor positions and grows beyond the initial experiment count', () => {
  const scene = new THREE.Scene();
  const renderer = new AttackLaneRenderer(scene);
  renderer.update([-2.8, 0, 2.8], 10, 0);
  renderer.update([-2.8, -1.4, 0, 1.4, 2.8], 10, 1.4);
  const mesh = scene.getObjectByName('attack-corridors') as THREE.InstancedMesh;
  expect(mesh.count).toBe(5);
  const transform = new THREE.Matrix4();
  mesh.getMatrixAt(3, transform);
  expect(new THREE.Vector3().setFromMatrixPosition(transform).x).toBeCloseTo(-1.4);
  renderer.update([-3, -2, -1, 0, 1, 2, 3], 10, 0);
  expect((scene.getObjectByName('attack-corridors') as THREE.InstancedMesh).count).toBe(7);
  renderer.dispose();
  expect(scene.children).toHaveLength(0);
});

it('renders a larger amber Heavy and preserves configured scale through death', () => {
  const scene = new THREE.Scene();
  const renderer = new EnemyRenderer(scene, bodyModel(), helmetModel(), vestModel(), runFrames(), grayBodyModel());
  renderer.update([{ id: 1, tier: 1, archetype: 'grunt', x: 0, z: 4, hp: 1, visualScale: 1.4 },
    { id: 2, tier: 1, archetype: 'heavy', x: 2.8, z: 4, hp: 5, visualScale: 1.89 }], 0);
  const helmets = scene.getObjectByName('0-toy-soldier-helmet') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  helmets.getMatrixAt(1, matrix);
  matrix.decompose(position, rotation, scale);
  expect(scale.x).toBeCloseTo(1.89);
  const color = new THREE.Color();
  helmets.getColorAt(1, color);
  expect(color.getHexString()).toBe(new THREE.Color(ART.faction.heavy).getHexString());
  const bodies = scene.children.filter(mesh => mesh.name.startsWith('toy-soldier-run-')) as THREE.InstancedMesh[];
  const tunics = bodies.flatMap(mesh => Array.from({ length: mesh.count }, (_, index) => {
    mesh.getColorAt(index, color); return color.getHexString();
  }));
  expect(tunics.sort()).toEqual([ART.faction.grunt.slice(1), ART.faction.heavyBody.slice(1)].sort());
  renderer.update([], 100);
  const deaths = scene.children.filter((child) => child instanceof THREE.Group);
  expect(deaths.some((death) => Math.abs(death.scale.x - 1.89 * 1.07) < .001)).toBe(true);
  renderer.dispose();
});
