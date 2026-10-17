import * as THREE from 'three';
import {expect,it,vi} from 'vitest';
import {GiantDestruction} from '../src/rendering/enemies/GiantDestruction';
import {EnemyRenderer} from '../src/rendering/enemies/EnemyRenderer';
import {createChibiGruntFamily} from '../src/rendering/enemies/ChibiGruntFamily';
import {createChibiHeavyFamily,createChibiGiantFamily} from '../src/rendering/enemies/ChibiThreatFamilies';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
import {ENEMY_DEATH_TIMING} from '../src/presentation/EnemyDeathTiming';

it('detaches bounded layered smoke from a rotated/scaled torso, drifts screen-right, seeks, freezes and expires',()=>{
 const scene=new THREE.Scene(),fx=new GiantDestruction(scene),matrix=new THREE.Matrix4().compose(new THREE.Vector3(2,0,14),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),new THREE.Vector3(2.5,2.8,2.6));
 const smoke=scene.getObjectByName('giant-destruction-smoke') as THREE.InstancedMesh;
 const burst=scene.getObjectByName('giant-destruction-burst') as THREE.InstancedMesh;
 expect(scene.children).toHaveLength(2);expect(smoke.count).toBe(10);expect(burst.count).toBe(10);
 const resources=[smoke.geometry,burst.geometry,smoke.material as THREE.Material,burst.material as THREE.Material];
 const dispose=resources.map(r=>vi.spyOn(r,'dispose'));
 fx.present(matrix,1000);fx.update(1030);expect(smoke.visible).toBe(true);expect(burst.visible).toBe(true);
 const color=new THREE.Color();smoke.getColorAt(9,color);expect(color.getHexString()).toBe('343b3e');
 const first=new THREE.Matrix4();smoke.getMatrixAt(9,first);
 const origin=new THREE.Vector3().setFromMatrixPosition(first);expect(origin.y).toBeGreaterThan(1.5);
 matrix.elements[12]=100; // A later pose/moving wreck cannot drag the captured plume.
 fx.update(1650);expect(burst.visible).toBe(false);
 const later=new THREE.Matrix4();smoke.getMatrixAt(9,later);
 for(const width of [350,390]){
  const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
  expect(new THREE.Vector3().setFromMatrixPosition(later).project(camera).x).toBeGreaterThan(origin.clone().project(camera).x);
 }
 const frozen=Array.from(smoke.instanceMatrix.array);fx.update(1650);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
 fx.update(1030);smoke.getMatrixAt(9,later);expect(later.elements).toEqual(first.elements); // Absolute-age reconstruction.
 fx.update(3599);expect(smoke.visible).toBe(true);fx.update(3600);expect(smoke.visible).toBe(false);
 for(let i=0;i<100;i++){fx.present(matrix,i*3000);fx.update(i*3000+1000);expect(scene.children).toHaveLength(2);}
 fx.reset();expect(smoke.visible).toBe(false);expect(burst.visible).toBe(false);
 fx.dispose();expect(scene.children).toHaveLength(0);dispose.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});

it.each(['bullet','grenade','airstrike','tank'] as const)('owns one mechanical %s death with zero Giant biological effects, and reuses slots silently',cause=>{
 const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
 const scene=new THREE.Scene(),r=new EnemyRenderer(scene,families),present=vi.spyOn(GiantDestruction.prototype,'present');
 const giant={id:1,tier:1,archetype:'giant' as const,x:0,z:14,hp:5,maxHp:172,visualScale:2.66};
 r.update([giant],0);r.update([giant],2000);
 const victim={id:1,x:0,z:14,archetype:'giant' as const,damage:5,killed:true,killXp:120};
 if(cause==='grenade')r.presentGrenade([{kind:'grenadeDetonated',x:0,z:14,radius:4,victims:[victim]}],2100);
 if(cause==='airstrike')r.presentSupportBomb({heavy:true,victims:[victim],blasts:[{x:0,z:14}]},2100);
 if(cause==='tank')r.presentTankEntrance({z:14,shockwave:false,victims:[victim]},2100);
 r.update([],2100);
 for(const age of [0,30,180,350,650,1000,1550,2599,2600,10000]){
  r.update([],2100+age);
  for(const name of ['enemy-hit-blood','enemy-blood-ribbons-giant','enemy-3d-blood-giant','enemy-ground-blood-stains'])
   expect((scene.getObjectByName(name) as THREE.InstancedMesh).count).toBe(0);
 }
 expect(present).toHaveBeenCalledOnce();const objects=scene.children.length;
 for(let i=0;i<8;i++){r.update([{...giant,id:i+2}],20000+i*3000);r.update([],20010+i*3000);r.update([],22900+i*3000);expect(scene.children.length).toBe(objects);}
 r.reset();r.update([giant],60000); // Continuing an alive checkpoint primes silently, without dead slots.
 expect(scene.children.filter(o=>o.name==='giant-destruction-smoke'&&o.visible)).toHaveLength(0);
 r.reset();r.update([],60001);expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(0);
 r.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);present.mockRestore();
});

it('keeps three simultaneous destruction slots bounded and drives actual tagged armor with the new opening',()=>{
 const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
 const scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
 const enemies=[1,2,3].map(id=>({id,tier:1,archetype:'giant' as const,x:(id-2)*3,z:15,hp:1,visualScale:2.66}));
 r.update(enemies,0);r.update(enemies,2000);const objects=scene.children.length;r.update([],2100);r.update([],2750);
 expect(scene.children.filter(o=>o.name==='giant-destruction-smoke'&&o.visible)).toHaveLength(3);
 const body=scene.getObjectByName('giant-body') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 expect(body.geometry.getAttribute('deathPieceDirection')).toBeDefined();
 const shader={uniforms:{},vertexShader:'',fragmentShader:''} as Parameters<typeof body.material.onBeforeCompile>[0];
 body.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 expect(shader.uniforms.giantDebrisEnabled.value).toBe(1);expect(shader.uniforms.giantDebrisMatrices.value).toHaveLength(11);
 r.update([],4700);expect(scene.children.filter(o=>o.name.startsWith('giant-destruction-')&&o.visible)).toHaveLength(0);
 expect(scene.children.length).toBe(objects);r.dispose();Object.values(families).forEach(f=>f.dispose());
});
