import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { BloodSplat, GroundBloodStains, bloodSplatTexture, BLOOD_SPLAT_CAPACITY, BLOOD_STAIN_CAPACITY, BLOOD_STAIN_COLOR, BLOOD_STAIN_OPACITY } from '../src/rendering/enemies/BloodSplat';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
import { HIT_BLOOD_TIMING } from '../src/rendering/enemies/EnemyHitImpulse';

it('generates a deterministic irregular blot and satellites with normal alpha',()=>{
  const a=bloodSplatTexture(),b=bloodSplatTexture();expect(a.image.width).toBe(96);expect(a.image.data).toEqual(b.image.data);
  const alpha=(x:number,y:number)=>a.image.data[(y*96+x)*4+3];
  expect(alpha(48,48)).toBe(255);expect(alpha(0,0)).toBe(0);
  expect(Array.from(a.image.data).filter((_,i)=>i%4===3&&a.image.data[i]>0).length).toBeGreaterThan(2000);
  const scene=new THREE.Scene(),burst=new BloodSplat(scene,a),stains=new GroundBloodStains(scene,a);
  for(const mesh of scene.children as THREE.InstancedMesh[]){const mat=mesh.material as THREE.MeshBasicMaterial;expect(mat.blending).toBe(THREE.NormalBlending);expect(mat.depthWrite).toBe(false);}
  const mat=(scene.getObjectByName('enemy-blood-splats') as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const shader={vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <color_fragment>',uniforms:{}} as Parameters<typeof mat.onBeforeCompile>[0];
  mat.onBeforeCompile(shader,{} as THREE.WebGLRenderer);expect(shader.vertexShader).toContain('mvPosition.xy +=');expect(shader.vertexShader).toContain('vec4(0.,0.,0.,1.)');
  burst.dispose();stains.dispose();expect(scene.children).toHaveLength(0);a.dispose();b.dispose();
});
it('keeps 8/24/48 splats in one bounded draw and clears each role completely',()=>{
  const scene=new THREE.Scene(),texture=bloodSplatTexture(),burst=new BloodSplat(scene,texture);
  const mesh=scene.getObjectByName('enemy-blood-splats') as THREE.InstancedMesh;
  for(const count of [8,24,48,100]){burst.reset();for(let id=0;id<count;id++)burst.spawnStyled(id,HIT_BLOOD_TIMING.grunt,0,new THREE.Vector3(id,1,8),1);burst.update(60);expect(mesh.count).toBe(Math.min(count,BLOOD_SPLAT_CAPACITY));}
  for(const role of ['grunt','heavy','giant'] as const){burst.reset();burst.spawnStyled(0,HIT_BLOOD_TIMING[role],0,new THREE.Vector3(0,1,8),1);burst.update(HIT_BLOOD_TIMING[role].bloodStartMs+10);expect(mesh.count).toBe(1);burst.update(ENEMY_DEATH_TIMING[role].totalMs);expect(mesh.count).toBe(0);}
  burst.reset();burst.spawnStyled(999,{bloodStartMs:0,bloodEndMs:2600,bloodPulseCount:1,bloodScale:1},0,new THREE.Vector3(99,2,8),1);
  for(let id=1;id<=90;id++)burst.spawnStyled(id,HIT_BLOOD_TIMING.grunt,id*10,new THREE.Vector3(0,1,8),1);
  burst.update(900);let giantPresent=false;
  for(let index=0;index<mesh.count;index++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);if(matrix.elements[12]===99)giantPresent=true;}
  expect(giantPresent).toBe(true);
  const owned=[vi.spyOn(mesh.geometry,'dispose'),vi.spyOn(mesh.material as THREE.Material,'dispose')],shared=vi.spyOn(texture,'dispose');
  burst.dispose();owned.forEach(spy=>expect(spy).toHaveBeenCalledOnce());expect(shared).not.toHaveBeenCalled();texture.dispose();
});
it('persists small deterministic stains, reuses oldest at bounded capacity, and clears on reset',()=>{
  const scene=new THREE.Scene(),texture=bloodSplatTexture(),stains=new GroundBloodStains(scene,texture);
  const mesh=scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  for(const role of ['grunt','heavy','giant'] as const){stains.reset();stains.spawn(17,role,.4,8);const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);expect(matrix.elements[13]).toBeCloseTo(.025);const width=Math.hypot(...matrix.elements.slice(0,3));expect(width).toBeGreaterThan(ENEMY_DEATH_TIMING[role].stainDiameter*.89);expect(width).toBeLessThan(ENEMY_DEATH_TIMING[role].stainDiameter*1.11);stains.reset();stains.spawn(17,role,.4,8);const repeat=new THREE.Matrix4();mesh.getMatrixAt(0,repeat);expect(repeat).toEqual(matrix);}
  stains.reset();for(let id=0;id<512;id++)stains.spawn(id,'grunt',id,8);expect(mesh.count).toBe(512);
  for(let id=512;id<BLOOD_STAIN_CAPACITY+1;id++)stains.spawn(id,'grunt',id,8);expect(mesh.count).toBe(BLOOD_STAIN_CAPACITY);
  const first=new THREE.Matrix4();mesh.getMatrixAt(0,first);expect(first.elements[12]).toBe(BLOOD_STAIN_CAPACITY);
  const material=mesh.material as THREE.MeshBasicMaterial;expect(material.color.getHexString()).toBe(BLOOD_STAIN_COLOR.slice(1));expect(material.opacity).toBe(BLOOD_STAIN_OPACITY);
  stains.reset();expect(mesh.count).toBe(0);expect(mesh.visible).toBe(false);stains.dispose();texture.dispose();
});
