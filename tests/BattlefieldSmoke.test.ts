import {expect,it} from 'vitest';
import * as THREE from 'three';
import {GrenadeExplosion} from '../src/rendering/GrenadeExplosion';
import {EnemyArtilleryRenderer} from '../src/rendering/EnemyArtilleryRenderer';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
import {smokeWindX} from '../src/presentation/BattlefieldWind';
import {HeavyAirstrikeExplosion} from '../src/rendering/HeavyAirstrikeExplosion';
import {EXPLOSION_SMOKE} from '../src/rendering/ExplosionSmoke';

it('uses one size-independent world wind, with screen-right light and charcoal drift',()=>{
 expect(smokeWindX(-1)).toBe(0);expect(smokeWindX(1)).toBe(-2.2);expect(smokeWindX(1,true)).toBe(-3.4);
});

it('preserves the approved grenade profile, debris, sparks and fire while excluding artillery-only box fragments',()=>{
 expect(EXPLOSION_SMOKE.grenade).toEqual({count:16,dark:5,seconds:1.9,opacity:.30,airyWeight:.09});
 for(const tier of ['grenade','artillery'] as const){
  const scene=new THREE.Scene(),fx=new GrenadeExplosion(scene,1,false,tier);
  fx.present(0,14,tier==='grenade'?4:.588,0);
  for(const ms of [30,300,800,1300]){
   fx.update(ms,0);
   expect(scene.getObjectByName('grenade-debris')!.visible).toBe(tier==='grenade'&&ms<1200);
   expect(scene.getObjectByName('grenade-sparks')!.visible).toBe(tier==='grenade'&&ms<650);
   expect(scene.getObjectByName('grenade-fire')!.visible).toBe(ms<280);
   if(ms>=300)expect(scene.getObjectByName('grenade-smoke')!.visible).toBe(true);
  }
  fx.dispose();expect(scene.children).toHaveLength(0);
 }
});

it('orders actual smoke footprint, quantity and persistence airstrike > grenade > artillery without enlarging damage rings',()=>{
 const sizes:number[]=[],counts:number[]=[],durations:number[]=[];
 for(const tier of ['artillery','grenade','airstrike'] as const){
  const scene=new THREE.Scene(),fx=tier==='airstrike'?new HeavyAirstrikeExplosion(scene):new GrenadeExplosion(scene,1,false,tier);
  if(fx instanceof HeavyAirstrikeExplosion)fx.present(0,0,14,0);else fx.present(0,14,tier==='artillery'?.588:4,0);
  fx.update(350,0);
  const smoke=scene.getObjectByName(tier==='airstrike'?'airstrike-0-smoke':'grenade-smoke') as THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  const profile=EXPLOSION_SMOKE[tier],matrix=new THREE.Matrix4();smoke.getMatrixAt(profile.dark,matrix);
  sizes.push(new THREE.Vector3().setFromMatrixScale(matrix).length());counts.push(smoke.count);durations.push(profile.seconds);
  const outerAlpha=1-(1-smoke.material.opacity*profile.airyWeight)**(profile.count-profile.dark);
  if(tier==='artillery') {expect(outerAlpha).toBeGreaterThan(.35);expect(outerAlpha).toBeLessThan(.65);}
  else expect(outerAlpha).toBeLessThan(.27);
  if(tier==='artillery')expect(scene.getObjectByName('grenade-shock-ring')!.scale.x).toBeCloseTo(.588);
  fx.update(profile.seconds*1000-1,0);expect(smoke.visible).toBe(true);
  fx.update(profile.seconds*1000,0);expect(smoke.visible).toBe(false);
  fx.dispose();expect(scene.children).toHaveLength(0);
 }
 for(const values of [sizes,counts,durations]){expect(values[0]).toBeLessThan(values[1]);expect(values[1]).toBeLessThan(values[2]);}
});

it('retains three overlapping grenade smoke tails at the real flight cadence while debris and fire expire separately',()=>{
 const scene=new THREE.Scene(),fx=new GrenadeExplosion(scene),objects=scene.children.slice();
 for(const at of [0,650,1300])fx.present(0,14,4,at);
 fx.update(1800,0);
 expect(scene.children.filter(m=>m.name.startsWith('grenade-smoke')&&m.visible)).toHaveLength(3);
 expect(scene.getObjectByName('grenade-debris')!.visible).toBe(false);
 expect(scene.getObjectByName('grenade-fire')!.visible).toBe(false);
 expect(scene.children).toEqual(objects);
 fx.reset();expect(scene.children.every(m=>!m.visible)).toBe(true);fx.dispose();expect(scene.children).toHaveLength(0);
});
it.each([350,390])('drifts grenade and real artillery-impact smoke screen-right at %ipx without changing blast anchors',width=>{
 const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
 for(const artillery of [false,true]){
  const scene=new THREE.Scene(),fx=artillery?new EnemyArtilleryRenderer(scene):new GrenadeExplosion(scene);
  const state={shells:[],elapsedSeconds:2,warningPresentation:'personalEmergency' as const};
  const update=(ms:number)=>{if(fx instanceof EnemyArtilleryRenderer)fx.update(state,ms);else fx.update(ms,0);};
  update(0);
  if(fx instanceof EnemyArtilleryRenderer)fx.present([{kind:'artilleryImpact',id:1,x:1.4,z:12,radius:.588,atSeconds:2,hit:false}],0);
  else fx.present(1.4,12,4,0);
  update(30);expect(scene.getObjectByName('grenade-flash')!.position.x).toBe(-1.4);
  const smoke=scene.getObjectByName('grenade-smoke') as THREE.InstancedMesh,objects=scene.children.slice(),matrix=new THREE.Matrix4();
  const projected=()=>Array.from({length:smoke.count},(_,i)=>{smoke.getMatrixAt(i,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix).project(camera).x;});
  update(350);const before=projected(),dark=new THREE.Color(),light=new THREE.Color();smoke.getColorAt(0,dark);smoke.getColorAt(artillery?4:5,light);
  expect(dark.r).toBeLessThan(light.r*.4);expect(smoke.count).toBe(artillery?12:16);
  update(850);expect(smoke.visible).toBe(true);expect(scene.getObjectByName('grenade-fire')!.visible).toBe(false);
  projected().forEach((x,i)=>expect(x).toBeGreaterThan(before[i]));
  const frozen=Array.from(smoke.instanceMatrix.array);update(850);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
  expect(scene.children).toEqual(objects);update(artillery?1800:1900);expect(smoke.visible).toBe(false);
  if(fx instanceof EnemyArtilleryRenderer)fx.restore(state);else fx.reset();update(850);expect(smoke.visible).toBe(false);
  fx.dispose();expect(scene.children).toHaveLength(0);
 }
});
