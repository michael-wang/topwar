import {expect,it} from 'vitest';
import * as THREE from 'three';
import {LabAirstrikeControl as HeavyAirstrikeExplosion} from '../src/dev/LabAirstrikeControl';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
import {EXPLOSION_SMOKE} from '../src/rendering/ExplosionSmoke';
it.each([350,390])('builds dark-forward overlapping projected smoke banks at %ipx while leaving other profiles alone',width=>{
 expect(EXPLOSION_SMOKE.grenade).toEqual({count:16,dark:5,seconds:1.9,opacity:.30,airyWeight:.09});
 expect(EXPLOSION_SMOKE.artillery).toEqual({count:12,dark:4,seconds:1.8,opacity:.58,airyWeight:.34,darkFadeEnd:.95,darkLast:true,darkColor:'#252b2d',lightColor:'#9b9f9c',darkScale:1.5,startSeconds:0,fadeInSeconds:.08,initialOpacity:.6});
 const scene=new THREE.Scene(),fx=new HeavyAirstrikeExplosion(scene),camera=new THREE.PerspectiveCamera(48,width/844,.1,180);
 applyCoastalCamera(camera);
 for(let i=0;i<3;i++)fx.present(i,(i-1)*2.8,14,0);
 fx.update(150,0);expect(scene.getObjectByName('airstrike-0-core')!.visible).toBe(true);
 fx.update(450,0);expect(scene.getObjectByName('airstrike-0-fire')!.visible).toBe(false);
 for(const age of [1000,2000,3000,4000]){
  fx.update(age,0);
  const bounds=[0,1,2].map(i=>{
   const smoke=scene.getObjectByName(`airstrike-${i}-smoke`) as THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
   expect(smoke.visible).toBe(true);
   const sootFade=Math.max(0,Math.min(1,(5.6*.98-age/1000)/(5.6*.36)));
   expect(1-(1-smoke.material.opacity*sootFade)**10).toBeGreaterThan(.96);
   expect(1-(1-smoke.material.opacity*.22)**10).toBeGreaterThan(.6);
   const matrix=new THREE.Matrix4();smoke.getMatrixAt(6,matrix);
   expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeGreaterThan(2.2);
   const xs:number[]=[];
   for(let j=0;j<smoke.count;j++){
    smoke.getMatrixAt(j,matrix);
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])xs.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix).project(camera).x);
   }
   return {min:Math.min(...xs),max:Math.max(...xs)};
  });
  for(let i=1;i<bounds.length;i++)expect(Math.min(bounds[i-1].max,bounds[i].max)-Math.max(bounds[i-1].min,bounds[i].min)).toBeGreaterThan(.3);
 }
 fx.update(5600,0);expect(scene.children.every(m=>!m.visible)).toBe(true);fx.dispose();expect(scene.children).toHaveLength(0);
});

it('layers prominent charcoal after softer gray puffs in the same bounded draw and 5.6-second lifetime', () => {
  const scene = new THREE.Scene(), fx = new HeavyAirstrikeExplosion(scene);
  for (let i = 0; i < 9; i++) fx.present(i, (i % 3 - 1) * 2.8, 7 + Math.floor(i / 3) * 14, 0);
  const meshes = [...scene.children]; fx.update(150, 0);
  for (const name of ['core', 'fire', 'dust', 'shockwave']) expect(scene.getObjectByName(`airstrike-0-${name}`)!.visible).toBe(true);
  fx.update(600, 0);
  const smoke = scene.getObjectByName('airstrike-0-smoke') as THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  expect(smoke.count).toBe(20); expect(smoke.material.depthWrite).toBe(false);
  const weights=smoke.geometry.getAttribute('smokeWeight');
  expect(Array.from(weights.array)).toEqual([...Array(10).fill(Math.fround(.22)),...Array(10).fill(1)]);
  expect(1-(1-smoke.material.opacity*.22)**10).toBeGreaterThan(.75);
  expect(1-(1-smoke.material.opacity)**10).toBeGreaterThan(.999);
  const inner=new THREE.Color(),outer=new THREE.Color();smoke.getColorAt(10,inner);smoke.getColorAt(0,outer);
  expect(inner.r).toBeLessThan(outer.r*.3);expect(Math.max(outer.r,outer.g,outer.b)-Math.min(outer.r,outer.g,outer.b)).toBeLessThan(.025);
  const innerPose=new THREE.Matrix4(),outerPose=new THREE.Matrix4();smoke.getMatrixAt(10,innerPose);smoke.getMatrixAt(0,outerPose);
  expect(new THREE.Vector3().setFromMatrixScale(innerPose).x).toBeLessThan(new THREE.Vector3().setFromMatrixScale(outerPose).x);
  const pose = Array.from(smoke.instanceMatrix.array); fx.update(600, 0);
  expect(Array.from(smoke.instanceMatrix.array)).toEqual(pose); expect(scene.children).toEqual(meshes);
  fx.update(5599, 0); expect(smoke.visible).toBe(true); fx.update(5600, 0); expect(smoke.visible).toBe(false);
  fx.reset(); expect(scene.children.every(m => !m.visible)).toBe(true); fx.dispose(); expect(scene.children).toHaveLength(0);
});


