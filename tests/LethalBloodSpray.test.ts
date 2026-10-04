import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { BLOOD_CAPACITY, BLOOD_COLORS, BLOOD_DROPLETS_PER_DEATH, BLOOD_LIFETIME_MS,
  LethalBloodSpray, bloodVelocity } from '../src/rendering/enemies/LethalBloodSpray';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { characterFamilies } from './characterModel';

it('shares six matte crimson/coral droplets across roles, deterministic and bounded', () => {
  const scene=new THREE.Scene(), blood=new LethalBloodSpray(scene);
  expect(BLOOD_DROPLETS_PER_DEATH).toBe(6);expect(BLOOD_LIFETIME_MS).toBe(150);
  expect(blood.droplets.instanceMatrix.count).toBe(BLOOD_CAPACITY);
  for(const role of ['grunt','heavy','giant'] as const){
    blood.reset();blood.spawn({id:2,tier:1,hp:0,x:0,z:8,archetype:role},100);
    blood.update(100);expect(blood.droplets.count).toBe(6);
    const color=new THREE.Color();for(let i=0;i<6;i++){
      blood.droplets.getColorAt(i,color);expect(BLOOD_COLORS).toContain('#'+color.getHexString());
      expect(bloodVelocity(2,i)).toEqual(bloodVelocity(2,i));
    }
    blood.update(250);expect(blood.droplets.visible).toBe(false);expect(blood.droplets.count).toBe(0);
  }
  for(let id=0;id<100;id++)blood.spawn({id,tier:1,hp:0,x:0,z:8},300);
  blood.update(300);expect(blood.droplets.count).toBe(BLOOD_CAPACITY);expect(scene.children).toHaveLength(1);
  const material=blood.droplets.material as THREE.MeshStandardMaterial;
  expect(material.emissiveIntensity).toBe(0);expect(material.blending).toBe(THREE.NormalBlending);
  const geometryDispose=vi.spyOn(blood.droplets.geometry,'dispose'), materialDispose=vi.spyOn(material,'dispose');
  blood.reset();expect(blood.droplets.visible).toBe(false);blood.dispose();
  expect(geometryDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();expect(scene.children).toHaveLength(0);
});
it('emits on lethal removal only, excludes contact and leaves living hits unchanged', () => {
  const scene=new THREE.Scene(), families=characterFamilies(), renderer=new EnemyRenderer(scene,families);
  const a={id:1,tier:1,hp:2,x:0,z:8},b={...a,id:2};
  renderer.update([a,b],0);renderer.update([{...a,hp:1},b],10);
  const blood=scene.getObjectByName('enemy-lethal-blood') as THREE.InstancedMesh;
  expect(blood.count).toBe(0);
  const squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
  renderer.present([{kind:'normalEnemyContact',enemyId:2,enemyTier:1,attackerX:0,attackerZ:8,
    playerX:0,playerZ:0,before:squad,after:squad}],20);
  renderer.update([],20);expect(blood.count).toBe(6);
  renderer.update([],170);expect(blood.count).toBe(0);
  expect(a.hp).toBe(2);expect(b.hp).toBe(2);
  renderer.reset();renderer.dispose();expect(scene.children).toHaveLength(0);
});
