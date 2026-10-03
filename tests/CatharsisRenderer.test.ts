import { enemyFamilies } from './characterModel';
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
  const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(), runFrames(), grayBodyModel()));
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


it('preserves coral health semantics and Heavy dimensions while Giant clips a fixed frame quad', () => {
  const scene = new THREE.Scene();
  const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(), runFrames(), grayBodyModel()));
  const enemies = [
    {id:1,tier:1,archetype:'heavy' as const,hp:10,maxHp:15,x:1.4,z:10},
    {id:2,tier:1,archetype:'giant' as const,hp:86,maxHp:172,x:-1.4,z:30,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:5.04}];
  renderer.update(enemies, 0); renderer.update(enemies, 1600);
  const fills = scene.children.filter(child => child.name === 'heavy-hp-fill') as THREE.Sprite[];
  expect(fills).toHaveLength(2);
  expect(fills.map(fill => fill.material.color.getHexString())).toEqual([ART.enemyHealth.heavy.slice(1), ART.enemyHealth.giant.slice(1)]);
  expect(fills[0].scale.x).toBeCloseTo(1.1 * 10/15);
  const before = fills[1].scale.x;
  renderer.update([enemies[0], {...enemies[1], hp:172}], 1700);
  expect(fills[1].scale.x).toBeCloseTo(before);
  const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '#include <map_fragment>' };
  fills[1].material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  expect(shader.uniforms.giantBarFraction.value).toBe(1);
  expect(shader.uniforms.giantBarEnabled.value).toBe(1);
  expect(enemies.map(enemy => enemy.hp)).toEqual([10,86]);
  renderer.dispose();
});

it('punches only the damaged elite health bar for 100ms, rate limits repeats and settles without changing HP', () => {
  const scene=new THREE.Scene(), renderer=new EnemyRenderer(scene,enemyFamilies(bodyModel(),helmetModel(),vestModel(),runFrames(),grayBodyModel()));
  const enemies=[1,2].map(id=>({id,tier:1,archetype:'heavy' as const,hp:15,maxHp:15,x:id*1.4,z:10}));
  renderer.update(enemies,0); renderer.update([{...enemies[0],hp:14},enemies[1]],100);
  const bars=scene.children.filter(c=>c.name==='heavy-hp-fill') as THREE.Sprite[];
  expect(bars[0].material.color.getHexString()).toBe(ART.enemyHealth.hit.slice(1));
  expect(bars[1].material.color.getHexString()).toBe(ART.enemyHealth.heavy.slice(1));
  expect(bars[0].scale.y).toBeGreaterThan(.14);
  renderer.update([{...enemies[0],hp:13},enemies[1]],150);
  expect(bars[0].material.color.getHexString()).not.toBe(ART.enemyHealth.hit.slice(1));
  renderer.update([{...enemies[0],hp:13},enemies[1]],201);
  expect(bars[0].material.color.getHexString()).toBe(ART.enemyHealth.heavy.slice(1));
  expect(bars[0].scale.x).toBeCloseTo(1.1*13/15); expect(bars[0].scale.y).toBe(.14);
  expect(enemies[0].hp).toBe(15); renderer.dispose();
});
