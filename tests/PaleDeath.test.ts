import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { characterFamilies } from './characterModel';
import { prepareEnemyDeathMaterial } from '../src/rendering/enemies/EnemyDeathMaterial';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
import { GRUNT_DEATH_BODY } from '../src/presentation/GruntDeathBody';
import { LETHAL_RECOIL } from '../src/rendering/enemies/EnemyLethalRecoil';

it('captures role-owned run geometry, lifts Grunts and holds Heavy recoil through pale fade', () => {
  const grunt=createChibiGruntFamily(), heavy=createChibiHeavyFamily(), scene=new THREE.Scene();
  const renderer=new EnemyRenderer(scene,{...characterFamilies(),grunt,heavy});
  for(const [role,family,id,start] of [['grunt',grunt,0,1000],['heavy',heavy,1,2000]] as const){
    const enemy={id,tier:1,archetype:role,x:0,z:8,hp:1};
    renderer.update([enemy],start);renderer.update([],start+10);
    const corpse=scene.getObjectByName('enemy-pale-death-body')!;
    expect((corpse.children[0] as THREE.Mesh).geometry).toBe(family.runFrames[enemyRunFrame(id,start,family.gaitCycleMs)].geometry);
    const scale=corpse.scale.clone();renderer.update([],start+90);
    expect(corpse.visible).toBe(true);expect(corpse.scale).toEqual(scale);
    expect((corpse.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.emissiveIntensity).toBe(0);
    const timing=ENEMY_DEATH_TIMING[role];renderer.update([],start+10+(role === 'grunt' ? GRUNT_DEATH_BODY.liftEndMs : LETHAL_RECOIL[role].peakMs));const matrix=corpse.matrix.clone();
    renderer.update([],start+10+(role==='grunt'?390:ENEMY_DEATH_TIMING.heavy.breakupEndMs));expect(corpse.visible).toBe(true);
    expect(corpse.matrix.equals(matrix)).toBe(true);expect(corpse.scale).toEqual(scale);
    renderer.update([],start+10+(role === 'grunt' ? 400 : timing.fadeStartMs));expect(corpse.visible).toBe(true);
    expect(corpse.matrix.equals(matrix)).toBe(true);
    renderer.update([],start+10+timing.totalMs);expect(corpse.visible).toBe(false);expect(scene.getObjectByName('enemy-ground-blood-stains')!.visible).toBe(true);
  }
  renderer.reset();expect(scene.getObjectByName('enemy-3d-blood-grunt')!.visible).toBe(false);
  renderer.dispose();grunt.dispose();heavy.dispose();expect(scene.children).toHaveLength(0);
});
it('mixes the lit authored albedo into one pale state without emissive white', () => {
  const material=new THREE.MeshStandardMaterial({vertexColors:true});prepareEnemyDeathMaterial(material);
  const shader={uniforms:{},fragmentShader:'#include <color_fragment>',vertexShader:''} as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  expect(shader.uniforms).not.toHaveProperty('deathGray');
  expect(shader.uniforms).not.toHaveProperty('deathGrayTint');
  expect(shader.uniforms).toHaveProperty('deathPale');
  expect(shader.fragmentShader).toContain('mix(diffuseColor.rgb, paleDeadColor, deathPale)');
  expect(material.emissiveIntensity).toBe(0);expect(material.map).toBeNull();material.dispose();
});
