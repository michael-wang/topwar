import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { canvasFieldBag, paddedBarrel } from '../src/rendering/characters/StructuredToyParts';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ART } from '../src/art/ArtDirection';
import { COMBAT_COLORS } from '../src/rendering/characters/ToyCombatGear';

function region(g:THREE.BufferGeometry,color:string,minY=-Infinity):THREE.Box3 {
  const p=g.getAttribute('position'),c=g.getAttribute('color'),target=new THREE.Color(color),box=new THREE.Box3();
  for(let i=0;i<p.count;i++)if(p.getY(i)>minY&&Math.abs(c.getX(i)-target.r)+Math.abs(c.getY(i)-target.g)+Math.abs(c.getZ(i)-target.b)<.00001)
    box.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  return box;
}
it('builds inexpensive canvas equipment with a broad planar front, tapered body and integrated projecting flap',()=>{
  const bag=canvasFieldBag(.18,.155,.10),p=bag.getAttribute('position'),n=bag.getAttribute('normal');
  const front=Array.from({length:p.count},(_,i)=>i).filter(i=>n.getZ(i)>.999);
  expect(front.length).toBeGreaterThan(18);
  expect(new Set(front.map(i=>p.getZ(i).toFixed(4))).size).toBeGreaterThanOrEqual(2); // body + shallow flap
  expect(bag.boundingBox!.max.z).toBeGreaterThan(.05);
  expect(bag.boundingBox!.getSize(new THREE.Vector3()).y).toBeCloseTo(.155);
  expect(p.count/3).toBeLessThanOrEqual(128);expect(bag.getAttribute('uv')).toBeUndefined();bag.dispose();
});
it('keeps Heavy jacket side walls vertical through the middle',()=>{
  const barrel=paddedBarrel(.34,.48,.275,.35,.10,20,.30),p=barrel.getAttribute('position');
  for(const y of [.21,.30,.49]){
    const row=Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(p.getY(i)-y)<.00001);
    expect(row.length).toBe(21);
    for(const i of row)expect(Math.hypot(p.getX(i)/.34,p.getZ(i)/.275)).toBeCloseTo(1);
  }
  barrel.dispose();
});
it('merges Heavy pouches and Giant shield/vault equipment into static poses with single disposal',()=>{
  for(const create of [createChibiHeavyFamily,createChibiGiantFamily]){
    const family=create(),color=family.role==='heavy'?COMBAT_COLORS.heavy.pouch:COMBAT_COLORS.giant.satchel;
    for(const mesh of [family.body,...family.runFrames]){
      const gear=region(mesh.geometry,color);expect(gear.isEmpty()).toBe(false);
      expect(gear.min.x).toBeLessThan(family.role === 'heavy' ? -.30 : -.35);expect(gear.max.z).toBeGreaterThan(.18);
    }
    expect(family.vest.visible).toBe(false);
    const spies=[family.body,...family.runFrames].map(m=>vi.spyOn(m.geometry,'dispose'));
    family.dispose();spies.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
  }
});
it('gives Giant an offset vault, shield and single vertical sensor without a human face',()=>{
  const giant=createChibiGiantFamily();
  expect(region(giant.body.geometry,ART.faction.skin).isEmpty()).toBe(true);
  expect(region(giant.helmet.geometry,ART.faction.skin).isEmpty()).toBe(true);
  const vault=region(giant.body.geometry,ART.enemyArmory.steel,.8);
  expect(vault.max.x).toBeLessThan(0);expect(vault.max.y).toBeGreaterThan(1.1);
  const sensor=region(giant.helmet.geometry,ART.enemyArmory.warning);
  const size=sensor.getSize(new THREE.Vector3());expect(size.y).toBeGreaterThan(size.x);
  expect(sensor.min.x).toBeGreaterThan(0);
  const shield=region(giant.body.geometry,ART.enemyArmory.steel);
  expect(shield.min.x).toBeLessThan(-.60);
  expect(giant.helmet.geometry.boundingBox!.max.y).toBeLessThan(giant.presentation!.height);
  expect(giant.presentation?.healthBar).toEqual({width:1.20,height:.20});
  expect(giant.weapon).toBeDefined();giant.dispose();
});
