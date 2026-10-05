import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { gruntDeathBody, GRUNT_DEATH_BODY } from '../src/presentation/GruntDeathBody';
import { DEATH_PALE_COMPLETE_MS, enemyDeathPale } from '../src/presentation/EnemyDeathPale';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { CrowdDeathBatches } from '../src/rendering/enemies/CrowdDeathBatches';
import { LETHAL_RECOIL } from '../src/rendering/enemies/EnemyLethalRecoil';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';

it('smoothly lifts .26 vertically after impact and fades an intact pale silhouette by 520ms', () => {
  expect(GRUNT_DEATH_BODY).toEqual({totalMs:520,liftStartMs:50,liftEndMs:350,liftUnits:.26,fadeStartMs:140});
  expect(DEATH_PALE_COMPLETE_MS).toEqual({grunt:95,heavy:185,giant:290});
  expect(enemyDeathPale(0,'grunt')).toBe(0);expect(enemyDeathPale(47.5,'grunt')).toBe(.5);expect(enemyDeathPale(95,'grunt')).toBe(1);
  let lift=0, opacity=1;
  for(let age=0;age<=520;age+=5){const p=gruntDeathBody(age);expect(p.lift).toBeGreaterThanOrEqual(lift);expect(p.lift).toBeLessThanOrEqual(.26);expect(p.opacity).toBeLessThanOrEqual(opacity);lift=p.lift;opacity=p.opacity;}
  expect(gruntDeathBody(50).lift).toBe(0);expect(gruntDeathBody(350).lift).toBe(.26);
  expect(gruntDeathBody(140).opacity).toBe(1);expect(gruntDeathBody(330).opacity).toBe(.5);
  expect(gruntDeathBody(519).opacity).toBeGreaterThan(0);expect(gruntDeathBody(520)).toEqual({lift:.26,opacity:0,visible:false});
});
it('keeps last gait and gear matrices exactly intact through dense-column lift, without rotation, shrink or depth retreat', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  expect(families.grunt.lethalReaction).toBeUndefined();expect(families.grunt.deathAssembly).toBeUndefined();
  const scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
  const lead={id:23,archetype:'grunt' as const,tier:1,hp:1,x:0,z:8};
  const following=Array.from({length:9},(_,i)=>({...lead,id:24+i,x:i%2?.035:-.035,z:8.22+i*.34}));
  r.update([lead,...following],2000,true);r.update(following,2010,true);
  const corpse=scene.getObjectByName('enemy-pale-death-body')!;
  const root=corpse.matrix.clone(),parts=corpse.children.map(p=>({matrix:p.matrix.clone(),geometry:(p as THREE.Mesh).geometry}));
  for(const age of [0,25,50,95,140,200,300,350,400,519]){
    r.update(following,2010+age,true);corpse.updateMatrixWorld(true);
    const expected=root.clone();expected.elements[13]+=gruntDeathBody(age).lift;
    expect(corpse.matrix.elements).toEqual(expected.elements);
    corpse.children.forEach((p,i)=>{expect(p.matrix.elements).toEqual(parts[i].matrix.elements);expect((p as THREE.Mesh).geometry).toBe(parts[i].geometry);});
    expect(corpse.matrix.elements[14]).toBeLessThan(following[0].z);
    for(const mesh of scene.children.filter(o=>o.name==='enemy-frozen-body-batch'&&o.visible) as THREE.InstancedMesh[]){
      for(const attr of ['deathBreakup','deathVariant','deathPieceId','deathPieceDirection'])expect(mesh.geometry.getAttribute(attr)).toBeUndefined();
      expect((mesh.material as THREE.Material).depthTest).toBe(true);expect(mesh.renderOrder).toBe(0);
    }
  }
  expect(scene.getObjectByName('enemy-death-read-echo')).toBeUndefined();
  r.update(following,2530,true);expect(corpse.visible).toBe(false);
  expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(1);
  r.reset();expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(0);
  r.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
});
it('bounds intact batches and reuses their resources without assembly attributes or deformation shaders', () => {
  const scene=new THREE.Scene(),f=createChibiGruntFamily(),group=new THREE.Group();group.add(f.runFrames[2].clone(),f.helmet.clone());
  const batches=new CrowdDeathBatches(scene,48);
  batches.begin();for(let i=0;i<100;i++)batches.submit(group,0,.6,0,1,true);batches.finish();
  const resources=scene.children as THREE.InstancedMesh[];expect(resources).toHaveLength(2);
  for(const mesh of resources){expect(mesh.count).toBe(48);expect(mesh.geometry.getAttribute('deathBreakup')).toBeUndefined();
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'} as Parameters<THREE.Material['onBeforeCompile']>[0];
    (mesh.material as THREE.Material).onBeforeCompile(shader,{} as THREE.WebGLRenderer);
    expect(shader.vertexShader).not.toContain('openedPieceDirection');expect(shader.vertexShader).not.toContain('deathVariant');
    expect(shader.fragmentShader).toContain('vDeathPale');expect(shader.fragmentShader).toContain('vDeathOpacity');
  }
  const clone=vi.spyOn(f.runFrames[2].geometry,'clone');
  batches.begin();for(let i=0;i<48;i++)batches.submit(group,0,.3,0,1,true);batches.finish();
  expect(scene.children).toEqual(resources);expect(clone).not.toHaveBeenCalled();
  batches.reset();expect(resources.every(m=>m.count===0&&!m.visible)).toBe(true);batches.dispose();f.dispose();expect(scene.children).toHaveLength(0);
});
it('retains priority-threat clocks, angular reactions, separation caps and stain sizes', () => {
  expect(ENEMY_DEATH_TIMING.heavy).toEqual({breakupEndMs:825,breakupStartMs:260,breakupDistance:.15,fadeStartMs:650,totalMs:1100,stainDiameter:.64});
  expect(ENEMY_DEATH_TIMING.giant).toEqual({breakupEndMs:1950,breakupStartMs:650,breakupDistance:.24,fadeStartMs:1550,totalMs:2600,stainDiameter:.95});
  expect(LETHAL_RECOIL.heavy).toEqual({distance:0,angleDegrees:26,peakMs:280});expect(LETHAL_RECOIL.giant).toEqual({distance:0,angleDegrees:16,peakMs:550});
  expect(ENEMY_DEATH_TIMING.grunt.stainDiameter).toBe(.34);expect(ENEMY_DEATH_TIMING.grunt).not.toHaveProperty('breakupStartMs');expect(ENEMY_DEATH_TIMING.grunt).not.toHaveProperty('breakupDistance');
});
