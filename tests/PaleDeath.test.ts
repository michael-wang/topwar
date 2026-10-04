import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { characterFamilies } from './characterModel';
import { preparePaleDeathMaterial, PALE_DEATH_COLORS } from '../src/rendering/enemies/PaleDeathMaterial';

it('freezes each role last drawn run geometry, uses role-specific clocks and resets all shatter pieces', () => {
  const grunt=createChibiGruntFamily(), heavy=createChibiHeavyFamily(), scene=new THREE.Scene();
  const renderer=new EnemyRenderer(scene,{...characterFamilies(),grunt,heavy});
  for(const [role,family,id,start] of [['grunt',grunt,0,1000],['heavy',heavy,1,2000]] as const){
    const enemy={id,tier:1,archetype:role,x:0,z:8,hp:1};
    renderer.update([enemy],start);renderer.update([],start+10);
    const corpse=scene.getObjectByName('enemy-pale-death-body')!;
    expect((corpse.children[0] as THREE.Mesh).geometry).toBe(family.runFrames[enemyRunFrame(id,start,family.gaitCycleMs)].geometry);
    const position=corpse.position.clone();renderer.update([],start+90);
    expect(corpse.visible).toBe(true);expect(corpse.position).toEqual(position);
    expect((corpse.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.emissiveIntensity).toBe(0);
    renderer.update([],start+120);expect(corpse.visible).toBe(role==='grunt');
    const pieces=scene.getObjectByName('enemy-pale-shatter') as THREE.InstancedMesh;
    expect(pieces.count).toBe(role==='heavy'?8:0);
    renderer.update([],start+400);expect(corpse.visible).toBe(false);
    expect(pieces.visible).toBe(role==='heavy');
    renderer.update([],start+1020);expect(pieces.visible).toBe(false);
  }
  renderer.reset();expect(scene.getObjectByName('enemy-pale-shatter')!.visible).toBe(false);
  renderer.dispose();grunt.dispose();heavy.dispose();expect(scene.children).toHaveLength(0);
});
it('drains authored color to naturally lit warm plaster without textures or emissive white', () => {
  const material=new THREE.MeshStandardMaterial({vertexColors:true}), pale=preparePaleDeathMaterial(material);
  const shader={uniforms:{},fragmentShader:'#include <color_fragment>',vertexShader:''} as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);pale.value=1;
  expect(shader.uniforms.deathPale).toBe(pale);
  expect((shader.uniforms.deathTint.value as THREE.Color).getHexString()).toBe(PALE_DEATH_COLORS[0].slice(1));
  expect(shader.fragmentShader).toContain('mix(diffuseColor.rgb, deathTint, deathPale)');
  expect(material.emissiveIntensity).toBe(0);expect(material.map).toBeNull();material.dispose();
});
