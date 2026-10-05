import * as THREE from 'three';
import { IntegratedDeathBlood } from '../src/rendering/enemies/IntegratedDeathBlood';
import { expect, it, vi } from 'vitest';
import { EnemyHitImpulse, ENEMY_HIT_STYLE, ENEMY_HIT_IMPULSE_MS, HIT_BLOOD_CAPACITY } from '../src/rendering/enemies/EnemyHitImpulse';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily,createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { BloodSplat,bloodSplatTexture } from '../src/rendering/enemies/BloodSplat';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
it('attacks quickly, refreshes without a zero snap, caps repeated kicks and prunes stale IDs',()=>{
 const tracker=new EnemyHitImpulse();expect(tracker.observe(1,0)).toBe(1);
 expect(tracker.strength(1,0)).toBe(0);expect(tracker.strength(1,20)).toBe(1);
 const before=tracker.strength(1,60);expect(tracker.observe(1,60)).toBe(2);expect(tracker.strength(1,60)).toBe(before);expect(tracker.strength(1,80)).toBeCloseTo(ENEMY_HIT_STYLE.grunt.cap/ENEMY_HIT_STYLE.grunt.distance);
 for(let t=80;t<1000;t+=10){tracker.observe(1,t);expect(tracker.strength(1,t+20)).toBeLessThanOrEqual(ENEMY_HIT_STYLE.grunt.cap/ENEMY_HIT_STYLE.grunt.distance);}
 expect(tracker.strength(1,1000+ENEMY_HIT_IMPULSE_MS)).toBe(0);tracker.prune(new Set());expect(tracker.strength(1,100)).toBe(0);
 expect(ENEMY_HIT_STYLE.grunt.distance).toBeGreaterThan(ENEMY_HIT_STYLE.heavy.distance);expect(ENEMY_HIT_STYLE.heavy.distance).toBeGreaterThan(ENEMY_HIT_STYLE.giant.distance);
});
it('every surviving HP drop emits blood and a +Z kick, independently of emphasis; lethal cancels hit blood',()=>{
 for(const role of ['grunt','heavy','giant'] as const){
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()},scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
  const e={id:1,tier:1,archetype:role,x:.3,z:12,hp:10,maxHp:10,visualScale:1.35},initial=JSON.stringify(e);
  const emphasis=vi.spyOn(HeavyHitFeedback.prototype,'observe');
  const z=()=>role==='giant'?scene.getObjectByName('giant-assault-soldier')!.position.z:(()=>{const mesh=scene.children.find(c=>c instanceof THREE.InstancedMesh&&c.name.startsWith('toy-soldier-run-')&&c.count>0) as THREE.InstancedMesh;const m=new THREE.Matrix4();mesh.getMatrixAt(0,m);return m.elements[14];})();
  const blood=scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh,stains=scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  renderer.update([e],0);renderer.update([e],2000);renderer.update([{...e,hp:9}],2010);renderer.update([{...e,hp:9}],2030);
  expect(blood.count).toBe(1);expect(z()).toBeCloseTo(e.z+ENEMY_HIT_STYLE[role].distance,5);expect(stains.count).toBe(0);
  const matrix=new THREE.Matrix4();blood.getMatrixAt(0,matrix);expect(matrix.elements[13]).toBeGreaterThan(.2);
  renderer.update([{...e,hp:8}],2070);renderer.update([{...e,hp:8}],2090);expect(blood.count).toBe(2);expect(z()).toBeCloseTo(e.z+ENEMY_HIT_STYLE[role].cap,5);
  if(role!=='grunt'){expect(emphasis.mock.results.map(result=>result.value)).toEqual([true,false]);}
  renderer.update([{...e,hp:8}],2330);expect(z()).toBeCloseTo(e.z,5);expect(blood.count).toBe(0);expect(JSON.stringify(e)).toBe(initial);
  renderer.update([{...e,hp:7}],2340);renderer.update([],2350);expect(blood.count).toBe(0);expect(stains.count).toBe(1);
  renderer.update([],2600);expect(blood.count).toBe(0);
  emphasis.mockRestore();renderer.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
 }
});
it('keeps hit blood separately bounded and cannot evict a long lethal Giant pulse',()=>{
 const scene=new THREE.Scene(),texture=bloodSplatTexture(),lethal=new IntegratedDeathBlood(scene),hit=new BloodSplat(scene,texture,HIT_BLOOD_CAPACITY,'enemy-hit-blood');
 lethal.spawn(1,'giant',0,new THREE.Matrix4().makeTranslation(0,0,12));
 const style={bloodStartMs:0,bloodEndMs:100,bloodPulseCount:1,bloodScale:.5};
 const objects=vi.spyOn(THREE.Object3D.prototype,'clone');
 for(let i=0;i<300;i++)hit.spawnStyled(i,style,1000,new THREE.Vector3(0,1,12));
 hit.update(1050);lethal.update(1050);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(HIT_BLOOD_CAPACITY);expect((scene.getObjectByName('enemy-3d-blood-giant') as THREE.InstancedMesh).count).toBe(1);expect(objects).not.toHaveBeenCalled();
 hit.cancel(299);hit.update(1051);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(HIT_BLOOD_CAPACITY-1);
 hit.update(1100);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(0);
 objects.mockRestore();hit.dispose();lethal.dispose();texture.dispose();
});

it('holds peak between attack and recovery, with exact capped role distances',()=>{
 const tracker=new EnemyHitImpulse();
 for(const role of ['grunt','heavy','giant'] as const){
  tracker.reset();tracker.observe(1,0,role);
  expect(tracker.strength(1,10)).toBeCloseTo(.5);
  for(const t of [20,40,70])expect(tracker.strength(1,t)).toBe(1);
  expect(tracker.strength(1,160)).toBeCloseTo(.5);expect(tracker.strength(1,250)).toBe(0);
  tracker.observe(1,40,role);expect(tracker.strength(1,40)).toBe(1);
  expect(tracker.strength(1,60)*ENEMY_HIT_STYLE[role].distance).toBeCloseTo(ENEMY_HIT_STYLE[role].cap);
 }
});
