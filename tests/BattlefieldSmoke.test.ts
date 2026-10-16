import {expect,it} from 'vitest';
import * as THREE from 'three';
import {GrenadeExplosion} from '../src/rendering/GrenadeExplosion';
import {EnemyArtilleryRenderer} from '../src/rendering/EnemyArtilleryRenderer';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
import {smokeWindX} from '../src/presentation/BattlefieldWind';

it('uses one size-independent world wind, with screen-right light and charcoal drift',()=>{
 expect(smokeWindX(-1)).toBe(0);expect(smokeWindX(1)).toBe(-2.2);expect(smokeWindX(1,true)).toBe(-3.4);
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
  update(350);const before=projected(),dark=new THREE.Color(),light=new THREE.Color();smoke.getColorAt(0,dark);smoke.getColorAt(4,light);
  expect(dark.r).toBeLessThan(light.r*.4);expect(smoke.count).toBe(10);
  update(850);expect(smoke.visible).toBe(true);expect(scene.getObjectByName('grenade-fire')!.visible).toBe(false);
  projected().forEach((x,i)=>expect(x).toBeGreaterThan(before[i]));
  const frozen=Array.from(smoke.instanceMatrix.array);update(850);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
  expect(scene.children).toEqual(objects);update(1200);expect(smoke.visible).toBe(false);
  if(fx instanceof EnemyArtilleryRenderer)fx.restore(state);else fx.reset();update(850);expect(smoke.visible).toBe(false);
  fx.dispose();expect(scene.children).toHaveLength(0);
 }
});
