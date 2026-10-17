import * as THREE from 'three';
import {expect,it,vi} from 'vitest';
import {GiantDestruction} from '../src/rendering/enemies/GiantDestruction';
import {EnemyRenderer} from '../src/rendering/enemies/EnemyRenderer';
import {createChibiGruntFamily} from '../src/rendering/enemies/ChibiGruntFamily';
import {createChibiHeavyFamily,createChibiGiantFamily} from '../src/rendering/enemies/ChibiThreatFamilies';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
import {ENEMY_DEATH_TIMING} from '../src/presentation/EnemyDeathTiming';

it('keeps bounded wreck smoke rising before wind, seeks, freezes, expires early and disposes',()=>{
 const scene=new THREE.Scene(),fx=new GiantDestruction(scene),matrix=new THREE.Matrix4().compose(new THREE.Vector3(2,0,14),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),new THREE.Vector3(2.5,2.8,2.6));
 const smoke=scene.getObjectByName('giant-destruction-smoke') as THREE.InstancedMesh;
 const burst=scene.getObjectByName('giant-destruction-burst') as THREE.InstancedMesh;
 expect(scene.children).toHaveLength(2);expect(smoke.count).toBe(8);expect(burst.count).toBe(10);
 const resources=[smoke.geometry,burst.geometry,smoke.material as THREE.Material,burst.material as THREE.Material];
 const dispose=resources.map(r=>vi.spyOn(r,'dispose'));
 fx.present(matrix,1000);fx.update(1030);expect(smoke.visible).toBe(false);expect(burst.visible).toBe(true);
 const color=new THREE.Color();smoke.getColorAt(1,color);expect(color.getHexString()).toBe('343b3e');
 fx.update(2050);expect(smoke.visible).toBe(true);expect(burst.visible).toBe(false);
 const first=new THREE.Matrix4(),later=new THREE.Matrix4();smoke.getMatrixAt(1,first);
 const origin=new THREE.Vector3().setFromMatrixPosition(first);expect(origin.y).toBeGreaterThan(.035);expect(origin.y).toBeLessThan(.7);
 matrix.elements[12]=100; // Later moving geometry cannot drag the detached wreck plume.
 fx.update(2120);smoke.getMatrixAt(1,later);expect(later.elements[12]).toBeCloseTo(first.elements[12]);expect(later.elements[13]).toBeGreaterThan(first.elements[13]);
 fx.update(2500);smoke.getMatrixAt(1,later);
 for(const width of [350,390]){
  const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
  expect(new THREE.Vector3().setFromMatrixPosition(later).project(camera).x).toBeGreaterThan(origin.clone().project(camera).x);
 }
 const frozen=Array.from(smoke.instanceMatrix.array);fx.update(2500);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
 fx.update(2050);smoke.getMatrixAt(1,later);expect(later.elements).toEqual(first.elements);
 fx.update(3020);expect(smoke.visible).toBe(true);fx.update(3100);expect(smoke.visible).toBe(false);expect(burst.visible).toBe(false);
 for(let i=0;i<100;i++){fx.present(matrix,i*3000);fx.update(i*3000+1100);expect(scene.children).toHaveLength(2);}
 fx.reset();expect(smoke.visible).toBe(false);expect(burst.visible).toBe(false);
 fx.dispose();expect(scene.children).toHaveLength(0);dispose.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});

it('uses only short localized smoke from the landed interiors, with no persistent fire',()=>{
 const scene=new THREE.Scene(),fx=new GiantDestruction(scene);
 const matrix=new THREE.Matrix4().makeScale(3,3,3);matrix.setPosition(2,0,14);
 fx.present(matrix,1000);fx.setWreckSource(0,new THREE.Vector3(4,.035,14),950);fx.setWreckSource(1,new THREE.Vector3(-1,.035,15),1100);
 const smoke=scene.getObjectByName('giant-destruction-smoke') as THREE.InstancedMesh;
 const burst=scene.getObjectByName('giant-destruction-burst') as THREE.InstancedMesh;
 const alpha=burst.geometry.getAttribute('destructionAlpha'),smokeAlpha=smoke.geometry.getAttribute('destructionAlpha');
 const first=new THREE.Matrix4(),later=new THREE.Matrix4();
 fx.update(1900);expect(burst.visible).toBe(false);expect(Array.from(alpha.array)).toEqual(Array(10).fill(0));
 fx.update(2250);expect(burst.visible).toBe(false);expect(smokeAlpha.getX(0)).toBeGreaterThan(0);expect(smokeAlpha.getX(6)).toBe(0);
 smoke.getMatrixAt(1,first);fx.update(2600);smoke.getMatrixAt(1,later);
 expect(later.elements[12]).toBeLessThan(first.elements[12]);expect(later.elements[13]).toBeGreaterThan(first.elements[13]);
 expect(smokeAlpha.getX(6)).toBeGreaterThan(0);
 for(let i=0;i<8;i++)if(smokeAlpha.getX(i)>0){
  smoke.getMatrixAt(i,later);const source=(i>>1)&1;
  expect(Math.abs(later.elements[12]-(source?-1:4))).toBeLessThan(.46);
 }
 const transforms=Array.from(smoke.instanceMatrix.array),opacities=Array.from(smokeAlpha.array);
 fx.update(2600);expect(Array.from(smoke.instanceMatrix.array)).toEqual(transforms);
 fx.update(1250);fx.update(2600);expect(Array.from(smoke.instanceMatrix.array)).toEqual(transforms);expect(Array.from(smokeAlpha.array)).toEqual(opacities);
 fx.update(3200);expect(smoke.visible).toBe(false);expect(burst.visible).toBe(false);expect(Array.from(smokeAlpha.array).every(a=>a===0)).toBe(true);
 fx.reset();fx.update(2600);expect(scene.children.every(o=>!o.visible)).toBe(true);fx.dispose();expect(scene.children).toHaveLength(0);
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
 r.update(enemies,0);r.update(enemies,2000);const objects=scene.children.length;r.update([],2100);r.update([],3500);
 expect(scene.children.filter(o=>o.name==='giant-destruction-smoke'&&o.visible)).toHaveLength(3);
 const body=scene.getObjectByName('giant-body') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 expect(body.geometry.getAttribute('deathPieceDirection')).toBeDefined();
 const shader={uniforms:{},vertexShader:'',fragmentShader:''} as Parameters<typeof body.material.onBeforeCompile>[0];
 body.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 expect(shader.uniforms.giantDebrisEnabled.value).toBe(1);expect(shader.uniforms.giantDebrisMatrices.value).toHaveLength(11);
 r.update([],4700);expect(scene.children.filter(o=>o.name.startsWith('giant-destruction-')&&o.visible)).toHaveLength(0);
 expect(scene.children.length).toBe(objects);r.dispose();Object.values(families).forEach(f=>f.dispose());
});
