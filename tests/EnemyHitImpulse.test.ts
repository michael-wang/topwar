import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { EnemyHitImpulse, ENEMY_HIT_STYLE, ENEMY_HIT_IMPULSE_MS, HIT_BLOOD_CAPACITY } from '../src/rendering/enemies/EnemyHitImpulse';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily,createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { BloodSplat,bloodSplatTexture } from '../src/rendering/enemies/BloodSplat';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
it('attacks quickly, refreshes without a zero snap, caps repeated kicks and prunes stale IDs',()=>{
 const tracker=new EnemyHitImpulse();expect(tracker.observe(1,0)).toBe(1);
 expect(tracker.strength(1,0)).toBe(0);expect(tracker.strength(1,12)).toBe(.85);
 const before=tracker.strength(1,60);expect(tracker.observe(1,60)).toBe(2);expect(tracker.strength(1,60)).toBe(before);expect(tracker.strength(1,72)).toBe(1);
 for(let t=80;t<1000;t+=10){tracker.observe(1,t);expect(tracker.strength(1,t+12)).toBeLessThanOrEqual(1);}
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
  renderer.update([e],0);renderer.update([e],2000);renderer.update([{...e,hp:9}],2010);renderer.update([{...e,hp:9}],2022);
  expect(blood.count).toBe(1);expect(z()).toBeCloseTo(e.z+ENEMY_HIT_STYLE[role].distance*.85,5);expect(stains.count).toBe(0);
  const matrix=new THREE.Matrix4();blood.getMatrixAt(0,matrix);expect(matrix.elements[13]).toBeGreaterThan(.5);
  renderer.update([{...e,hp:8}],2070);renderer.update([{...e,hp:8}],2082);expect(blood.count).toBe(2);expect(z()).toBeCloseTo(e.z+ENEMY_HIT_STYLE[role].distance,5);
  if(role!=='grunt'){expect(emphasis.mock.results.map(result=>result.value)).toEqual([true,false]);}
  renderer.update([{...e,hp:8}],2230);expect(z()).toBeCloseTo(e.z,5);expect(blood.count).toBe(0);expect(JSON.stringify(e)).toBe(initial);
  renderer.update([{...e,hp:7}],2240);renderer.update([],2250);expect(blood.count).toBe(0);expect(stains.count).toBe(1);
  renderer.update([],2400);expect(blood.count).toBe(0);
  emphasis.mockRestore();renderer.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
 }
});
it('keeps hit blood separately bounded and cannot evict a long lethal Giant pulse',()=>{
 const scene=new THREE.Scene(),texture=bloodSplatTexture(),lethal=new BloodSplat(scene,texture),hit=new BloodSplat(scene,texture,HIT_BLOOD_CAPACITY,'enemy-hit-blood');
 lethal.spawn(1,'giant',0,new THREE.Vector3(0,2,12),1);
 const style={bloodStartMs:0,bloodEndMs:100,bloodPulseCount:1,bloodScale:.5};
 const objects=vi.spyOn(THREE.Object3D.prototype,'clone');
 for(let i=0;i<300;i++)hit.spawnStyled(i,style,500,new THREE.Vector3(0,1,12));
 hit.update(550);lethal.update(550);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(HIT_BLOOD_CAPACITY);expect((scene.getObjectByName('enemy-blood-splats') as THREE.InstancedMesh).count).toBe(1);expect(objects).not.toHaveBeenCalled();
 hit.cancel(299);hit.update(551);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(HIT_BLOOD_CAPACITY-1);
 hit.update(600);expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(0);
 objects.mockRestore();hit.dispose();lethal.dispose();texture.dispose();
});
