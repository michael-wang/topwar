import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGiantFamily, createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
function matrixClose(a: THREE.Matrix4,b: THREE.Matrix4) { a.elements.forEach((value,i)=>expect(value).toBeCloseTo(b.elements[i],6)); }
it('captures the exact last drawn body, delayed helmet, root and Giant weapon; no lethal motion', () => {
  for(const role of ['grunt','heavy','giant'] as const){
    const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
    const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families),timing=ENEMY_DEATH_TIMING[role];
    const enemy={id:2,tier:1,hp:2,archetype:role,x:.4,z:12,visualScale:1.9};
    renderer.update([enemy],0);renderer.update([{...enemy,hp:1}],2000);renderer.update([{...enemy,hp:1}],2017);
    const family=families[role], before: THREE.Matrix4[]=[], geometries: THREE.BufferGeometry[]=[];
    if(role==='giant') {
      const group=scene.getObjectByName('giant-assault-soldier')!;group.updateMatrixWorld(true);
      for(const part of [group.children[0],group.children[1],group.getObjectByName('giant-maul')!]) {
        before.push(part.matrixWorld.clone());if(part instanceof THREE.Mesh)geometries.push(part.geometry);
      }
    } else {
      for(const geometry of [family.runFrames.find(frame=>scene.children.some(c=>c instanceof THREE.InstancedMesh&&c.geometry===frame.geometry&&c.count>0))!.geometry,family.helmet.geometry]) {
        const mesh=scene.children.find(c=>c instanceof THREE.InstancedMesh&&c.geometry===geometry&&c.count>0) as THREE.InstancedMesh;
        const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);before.push(matrix);geometries.push(geometry);
      }
    }
    renderer.update([],2031);
    const corpse=scene.getObjectByName(role==='giant'?'giant-assault-soldier':'enemy-pale-death-body')!;
    const parts=[corpse.children[0],corpse.children[1],...(role==='giant'?[corpse.getObjectByName('giant-maul')!]:[])];
    const root=corpse.matrix.clone();
    for(const age of [0,20,timing.grayMs,timing.shatterMs-1]) {
      renderer.update([],2031+age);corpse.updateMatrixWorld(true);expect(corpse.visible).toBe(true);
      matrixClose(corpse.matrix,root);parts.forEach((part,index)=>matrixClose(part.matrixWorld,before[index]));
      geometries.forEach((geometry,index)=>expect((parts[index] as THREE.Mesh).geometry).toBe(geometry));
      const body=parts[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
      expect(body.material.opacity).toBe(1);expect(body.material.emissiveIntensity).toBe(0);
      expect(body.material.transparent).toBe(false);expect(body.material.depthWrite).toBe(true);
      if(age>=timing.grayMs){
        const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <color_fragment>'} as Parameters<typeof body.material.onBeforeCompile>[0];
        body.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);expect(shader.uniforms.deathPale.value).toBe(1);
      }
      const blood=scene.getObjectByName('enemy-lethal-blood') as THREE.InstancedMesh;
      expect(blood.count).toBe(age>=timing.bloodMs?8:0);
      if(blood.count){const m=new THREE.Matrix4();blood.getMatrixAt(0,m);expect(m.elements[13]).toBeGreaterThan(corpse.position.y+.5*corpse.scale.y);}
    }
    renderer.update([],2031+timing.shatterMs);expect(corpse.visible).toBe(false);
    const chunks=scene.children.filter(c=>c.name.startsWith('enemy-shatter-')) as THREE.InstancedMesh[];
    expect(chunks.reduce((n,c)=>n+c.count,0)).toBe(8);
    renderer.update([],2031+timing.totalMs);expect(chunks.every(c=>c.count===0&&!c.visible)).toBe(true);
    for(const name of ['enemy-pale-shatter','giant-armor-wreckage','giant-death-impact'])expect(scene.getObjectByName(name)).toBeUndefined();
    renderer.reset();renderer.update([enemy],4000);
    if(role==='giant')expect(corpse.visible).toBe(true);
    else {renderer.update([],4010);expect(corpse.visible).toBe(true);}
    renderer.dispose();for(const family of Object.values(families))family.dispose();
    expect(scene.children).toHaveLength(0);expect(enemy.hp).toBe(2);
  }
});

it('copies packed instance slots correctly through a dense mixed lethal frame', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
  const enemies=Array.from({length:48},(_,id)=>({id,tier:1,hp:1,x:id*.13,z:8+id*.05,
    archetype:id%3===0?'heavy' as const:'grunt' as const}));
  renderer.update(enemies,1234);
  const drawn: {geometry:THREE.BufferGeometry;matrix:THREE.Matrix4}[]=[];
  for(const child of scene.children)if(child instanceof THREE.InstancedMesh&&child.name.startsWith('toy-soldier-run-')){
    for(let i=0;i<child.count;i++){const matrix=new THREE.Matrix4();child.getMatrixAt(i,matrix);drawn.push({geometry:child.geometry,matrix});}
  }
  renderer.update([],1267);
  const frozen=scene.children.filter(child=>child.name==='enemy-pale-death-body');expect(frozen).toHaveLength(48);
  expect(drawn).toHaveLength(48);
  for(const group of frozen){
    const match=drawn.findIndex(record=>record.matrix.equals(group.matrix));expect(match).toBeGreaterThanOrEqual(0);
    expect((group.children[0] as THREE.Mesh).geometry).toBe(drawn[match].geometry);drawn.splice(match,1);
  }
  expect(drawn).toHaveLength(0);renderer.update([],1332);
  expect(frozen.every(group=>group.visible)).toBe(true);
  renderer.dispose();Object.values(families).forEach(family=>family.dispose());expect(scene.children).toHaveLength(0);
});
