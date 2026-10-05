import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createChibiGiantFamily, createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { ENEMY_DEATH_TIMING, ENEMY_REACTION_TIMING, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
import { gruntDeathBody } from '../src/presentation/GruntDeathBody';
import { enemyDeathPale } from '../src/presentation/EnemyDeathPale';
import { writeLethalRecoil } from '../src/rendering/enemies/EnemyLethalRecoil';
function matrixClose(a: THREE.Matrix4,b: THREE.Matrix4) { a.elements.forEach((value,i)=>expect(value).toBeCloseTo(b.elements[i],6)); }
it('captures exact lethal poses, lifts intact Grunts or topples threats, and fades all surfaces together', () => {
  for(const role of ['grunt','heavy','giant'] as const){
    const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
    const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families),timing=ENEMY_DEATH_TIMING[role];
    const enemy={id:2,tier:1,hp:2,archetype:role,x:.4,z:12,visualScale:1.9};
    renderer.update([enemy],0);renderer.update([{...enemy,hp:1}],2000);renderer.update([{...enemy,hp:1}],2017);
    const breakupTiming=role==='grunt'?undefined:ENEMY_DEATH_TIMING[role];
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
    for(const age of role==='grunt'?[0,20,50,95,140,200,350,400,519]:[0,20,ENEMY_REACTION_TIMING[role].startMs-1,ENEMY_REACTION_TIMING[role].endMs,breakupTiming!.breakupEndMs,timing.fadeStartMs,(timing.fadeStartMs+timing.totalMs)/2,timing.totalMs-1]) {
      renderer.update([],2031+age);corpse.updateMatrixWorld(true);expect(corpse.visible).toBe(true);
      const expected = new THREE.Matrix4(); if(role==='grunt'){expected.copy(root);expected.elements[13]+=gruntDeathBody(age).lift;}else writeLethalRecoil(expected, root, age, role); matrixClose(corpse.matrix,expected);
      if(role==='grunt' || age < ENEMY_REACTION_TIMING[role].startMs) {
        if(age===0)parts.forEach((part,index)=>matrixClose(part.matrixWorld,before[index]));
        geometries.forEach((geometry,index)=>expect((parts[index] as THREE.Mesh).geometry).toBe(geometry));
      } else {
        const geometry=(parts[0] as THREE.Mesh).geometry;
        if(role==='giant'&&age>breakupTiming!.breakupStartMs){expect(geometry.getAttribute('deathPieceDirection')).toBeDefined();expect(geometry.getAttribute('position').array).toEqual(family.lethalReaction!.final.geometry.getAttribute('position').array);}
        else expect(geometry).toBe(family.lethalReaction!.final.geometry);
      }
      const body=parts[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
      expect(body.material.opacity).toBe((role==='grunt'?gruntDeathBody(age).opacity:enemyDeathPose(age,breakupTiming!).bodyOpacity));expect(body.material.emissiveIntensity).toBe(0);
      expect(body.material.transparent).toBe(age>(role==='grunt'?140:timing.fadeStartMs));expect(body.material.depthWrite).toBe(true);
      if (role === 'giant') {
        for (const mesh of [parts[0], parts[1], corpse.getObjectByName('giant-maul')!.children[0]] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]) {
          const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <color_fragment>' } as Parameters<typeof mesh.material.onBeforeCompile>[0];
          mesh.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
          expect(shader.uniforms.deathPale.value).toBe(enemyDeathPale(age, role));
        }
      }
      if(role!=='grunt'&&age>=breakupTiming!.breakupEndMs){
        const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <color_fragment>'} as Parameters<typeof body.material.onBeforeCompile>[0];
        body.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);expect(shader.uniforms.deathGray).toBeUndefined();
        expect(shader.uniforms.deathRed).toBeUndefined();
      }
    }
    renderer.update([],2031+timing.totalMs);expect(corpse.visible).toBe(false);
    expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(1);
    renderer.update([],100000);expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(1);
    expect(scene.children.some(c=>/shatter|fragment|debris|death-impact/.test(c.name))).toBe(false);
    renderer.reset();expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(0);renderer.update([enemy],4000);
    if(role==='giant') {
      expect(corpse.visible).toBe(true);
      const material = (corpse.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material;
      const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' } as Parameters<typeof material.onBeforeCompile>[0];
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      expect(shader.uniforms.deathPale.value).toBe(0); // Reused live slot cannot inherit a dead tint.
    }
    else {renderer.update([],4010);expect(corpse.visible).toBe(true);}
    renderer.dispose();for(const family of Object.values(families))family.dispose();
    expect(scene.children).toHaveLength(0);expect(enemy.hp).toBe(2);
  }
});

it('only lethal removal stains the scene, and mode changes clear persistent blood without phantom kills', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
  const enemy={id:1,tier:1,hp:2,x:0,z:8,archetype:'grunt' as const};
  const stains=scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  renderer.update([enemy],0,true);renderer.update([{...enemy,hp:1}],100,true);expect(stains.count).toBe(0);
  renderer.update([],200,true);expect(stains.count).toBe(0);
  renderer.update([],10000,true);expect(stains.count).toBe(1);
  renderer.update([enemy],11000,true);renderer.update([],12000,false);expect(stains.count).toBe(0);
  expect((scene.getObjectByName('enemy-3d-blood-grunt') as THREE.InstancedMesh).count).toBe(0);
  renderer.update([enemy],13000,false);
  const squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
  renderer.present([{kind:'normalEnemyContact',enemyId:1,enemyTier:1,attackerX:0,attackerZ:8,playerX:0,playerZ:0,before:squad,after:squad}],13010);
  renderer.update([],13010,false);expect(stains.count).toBe(0);
  renderer.dispose();Object.values(families).forEach(family=>family.dispose());
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

it('reuses slot materials when changing corpse role and disposes the shared mask once', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
  const enemy={id:1,tier:1,hp:1,x:0,z:8,archetype:'grunt' as const};
  renderer.update([enemy],0);renderer.update([],10);renderer.update([],540);
  const group=scene.getObjectByName('enemy-pale-death-body')!;
  const material=(group.children[0] as THREE.Mesh).material as THREE.Material;
  const dispose=vi.spyOn(material,'dispose'),clone=vi.spyOn(families.heavy.body.material as THREE.Material,'clone');
  renderer.update([{...enemy,id:2,archetype:'heavy'}],600);renderer.update([],610);
  expect((group.children[0] as THREE.Mesh).material).toBe(material);expect(dispose).not.toHaveBeenCalled();expect(clone).not.toHaveBeenCalled();
  const mask=((scene.getObjectByName('enemy-ground-blood-stains') as THREE.Mesh).material as THREE.MeshBasicMaterial).map!;
  const maskDispose=vi.spyOn(mask,'dispose');renderer.dispose();expect(maskDispose).toHaveBeenCalledOnce();expect(dispose).toHaveBeenCalledOnce();
  Object.values(families).forEach(family=>family.dispose());
});
