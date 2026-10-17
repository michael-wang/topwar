import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { GiantDebris, GIANT_DEBRIS } from '../src/rendering/enemies/GiantDebris';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';

it.each([0, 1, 2])('keeps all eleven original-colored pieces airborne then exactly grounded before fading (variant %s)', variant => {
  const family=createChibiGiantFamily(),scene=new THREE.Scene(),r=new GiantRenderer(scene,family),hits=new HeavyHitFeedback(scene);
  const enemy={id:1,tier:1,archetype:'giant' as const,hp:1,x:1.3,z:14,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:4.2};
  r.update(enemy,1700,hits); const group=r.die(enemy,1710,variant);
  const debris=(r as unknown as {debris:GiantDebris}).debris;
  const meshes=[group.children[0],group.children[1],group.getObjectByName('giant-maul')!.children[0]] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
  const colors=meshes.map(m=>Float32Array.from(m.geometry.getAttribute('color').array));
  const matrices=debris.matrices.value,refs=matrices.slice(),point=new THREE.Vector3();
  const centers=(debris as unknown as {centers:THREE.Vector3[]}).centers;
  const destruction=(r as unknown as {destruction:{wreckSources:THREE.Vector3[];wreckStarts:Float64Array}}).destruction;
  for(let source=0;source<2;source++){
    debris.landingCenter(3+source,point);expect(destruction.wreckSources[source]).toEqual(point);
    expect(point.y).toBeGreaterThan(GIANT_DEBRIS.groundY);
    expect(destruction.wreckStarts[source]).toBeCloseTo(debris.landingAgeMs(3+source)/1000);
  }
  let flying=false; const floors=new Float64Array(11);
  for(const age of [0,120,250,500,750,1000,1200,1500,1900,2200,2599]){
    r.update(undefined,1710+age,hits);group.updateMatrixWorld(true);floors.fill(Infinity);
    for(let part=0;part<meshes.length;part++){
      const mesh=meshes[part],p=mesh.geometry.getAttribute('position'),ids=mesh.geometry.getAttribute('deathPieceId');
      expect(Array.from(mesh.geometry.getAttribute('color').array).every((v,i)=>v===colors[part][i])).toBe(true);
      expect(mesh.material.color.getHexString()).toBe('ffffff');
      const shader={uniforms:{},vertexShader:'#include <defaultnormal_vertex>\n#include <project_vertex>',fragmentShader:'#include <color_fragment>'} as Parameters<typeof mesh.material.onBeforeCompile>[0];
      mesh.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.fragmentShader).not.toContain('pale');expect(shader.uniforms).not.toHaveProperty('deathPale');
      for(let i=0;i<p.count;i++){
        const id=ids.getX(i);point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(matrices[id]);
        floors[id]=Math.min(floors[id],point.y);
      }
      if(age<=GIANT_DEBRIS.fadeStartMs)expect(mesh.material.opacity).toBe(1);
    }
    for(let id=0;id<11;id++){
      expect(Number.isFinite(floors[id])).toBe(true);expect(floors[id]).toBeGreaterThanOrEqual(GIANT_DEBRIS.groundY-1e-6);
      if(age>=debris.landingAgeMs(id))expect(floors[id]).toBeCloseTo(GIANT_DEBRIS.groundY,5);
      if(age>=1500){
        const landed=centers[id].clone().applyMatrix4(matrices[id]);
        expect(Math.abs(landed.x-centers[id].x)).toBeLessThan(.75);
        expect(Math.abs(landed.z-centers[id].z)).toBeLessThan(.5);
      }
      if(age===500&&floors[id]>.1)flying=true;
      expect(debris.landingAgeMs(id)).toBeLessThan(GIANT_DEBRIS.fadeStartMs-500);
      expect(matrices[id]).toBe(refs[id]);
    }
  }
  expect(flying).toBe(true);expect(meshes[0].material.opacity).toBeLessThan(.001);
  r.update(undefined,2210,hits);const seek=matrices.map(m=>m.elements.slice());
  r.update(undefined,2600,hits);r.update(undefined,2210,hits);expect(matrices.map(m=>m.elements)).toEqual(seek);
  r.update(undefined,4310,hits);expect(group.visible).toBe(false);
  r.reset();expect(debris.enabled.value).toBe(0);r.update(enemy,5000,hits);expect(meshes[0].material.opacity).toBe(1);
  r.dispose();hits.dispose();family.dispose();expect(scene.children).toHaveLength(0);
});
