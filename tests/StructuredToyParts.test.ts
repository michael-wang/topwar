import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { canvasFieldBag, paddedBarrel, heavyWebHarness } from '../src/rendering/characters/StructuredToyParts';
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
it('keeps Heavy side walls vertical through the middle and the web harness clear of the padded barrel',()=>{
  const barrel=paddedBarrel(.34,.48,.275,.35,.10,20,.30),p=barrel.getAttribute('position');
  for(const y of [.21,.30,.49]){
    const row=Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(p.getY(i)-y)<.00001);
    expect(row.length).toBe(21);
    for(const i of row)expect(Math.hypot(p.getX(i)/.34,p.getZ(i)/.275)).toBeCloseTo(1);
  }
  const harness=heavyWebHarness(),h=harness.getAttribute('position');
  for(let i=0;i<h.count;i++){
    const cap=Math.max(0,Math.abs(h.getY(i)-.35)-.14)/.10;
    const r=Math.sqrt(Math.max(.02,1-cap*cap));
    expect(Math.hypot(h.getX(i)/.34,h.getZ(i)/.275)).toBeGreaterThan(r);
  }
  barrel.dispose();harness.dispose();
});
it('authors owning Heavy pouch/Giant satchel regions in all static poses and disposes each owner once',()=>{
  for(const create of [createChibiHeavyFamily,createChibiGiantFamily]){
    const family=create(),color=family.role==='heavy'?COMBAT_COLORS.heavy.pouch:COMBAT_COLORS.giant.satchel;
    for(const mesh of [family.body,...family.runFrames]){
      const bag=region(mesh.geometry,color);expect(bag.isEmpty()).toBe(false);
      expect(bag.max.y).toBeLessThan(.48);expect(bag.max.z).toBeGreaterThan(.27);
    }
    expect(family.vest.visible).toBe(false);
    const spies=[family.body,...family.runFrames].map(m=>vi.spyOn(m.geometry,'dispose'));
    family.dispose();spies.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
  }
});
it('gives Giant a 2.9–3.1 head silhouette at unchanged authored crown and padded body',()=>{
  const giant=createChibiGiantFamily(),head=region(giant.body.geometry,ART.faction.skin,.8);
  const crown=giant.helmet.geometry.boundingBox!.max.y,headSize=head.getSize(new THREE.Vector3());
  expect(crown).toBeCloseTo(1.355);
  expect(crown/(crown-head.min.y)).toBeGreaterThan(2.9);expect(crown/(crown-head.min.y)).toBeLessThan(3.1);
  expect(headSize.x/.5412).toBeCloseTo(.86);expect(headSize.z/.4756).toBeCloseTo(.86);
  expect(region(giant.body.geometry,ART.raider.bodyDeep).max.y).toBeCloseTo(.895);
  expect(giant.presentation?.healthBar).toEqual({width:1.20,height:.20});
  expect(giant.weapon).toBeDefined();giant.dispose();
});
