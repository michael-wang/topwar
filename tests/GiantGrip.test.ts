import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGiantFamily, GIANT_WEAPON_GRIP } from '../src/rendering/enemies/ChibiThreatFamilies';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { giantGripMotion, giantWeightPose } from '../src/presentation/CharacterMotion';
import { ART } from '../src/art/ArtDirection';

function region(g:THREE.BufferGeometry,color:string,filter=(x:number,y:number)=>true):THREE.Box3 {
  const p=g.getAttribute('position'),c=g.getAttribute('color'),target=new THREE.Color(color),box=new THREE.Box3();
  for(let i=0;i<p.count;i++)if(filter(p.getX(i),p.getY(i))&&Math.abs(c.getX(i)-target.r)+Math.abs(c.getY(i)-target.g)+Math.abs(c.getZ(i)-target.b)<.00001)
    box.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  return box;
}
it('owns exactly one grip hand in the single maul mesh, never in any body/run pose',()=>{
  const family=createChibiGiantFamily(),weapon=family.weapon!.geometry;
  expect(family.weaponGrip).toEqual(GIANT_WEAPON_GRIP);
  for(const mesh of [family.body,...family.runFrames]){
    expect(region(mesh.geometry,ART.faction.skin,(x,y)=>x>0&&y<.7).isEmpty()).toBe(true);
    expect(region(mesh.geometry,ART.faction.skin,(x,y)=>x<-.3&&y<.7).isEmpty()).toBe(false);
  }
  const hand=region(weapon,ART.faction.skin),shaft=region(weapon,ART.raider.hardware),head=region(weapon,ART.raider.helmet);
  const center=hand.getCenter(new THREE.Vector3());center.toArray().forEach((v,i)=>expect(v).toBeCloseTo(GIANT_WEAPON_GRIP[i],5));
  expect(shaft.min.y).toBeLessThan(center.y);expect(shaft.max.y).toBeGreaterThan(center.y);
  expect(shaft.getCenter(new THREE.Vector3()).x).toBeCloseTo(center.x);
  expect(shaft.getCenter(new THREE.Vector3()).z).toBeCloseTo(center.z);
  expect(head.min.y-hand.max.y).toBeGreaterThan(.04); // Hand cannot reach the maul head.
  expect(family.weapon!.material).toBe(family.helmet.material);
  expect(weapon.groups).toHaveLength(0); // Skin region does not create a separate draw.
  family.dispose();
});
it('keeps shaft and grip coupled throughout all four poses and through the fall, while the grip actually moves',()=>{
  const family=createChibiGiantFamily(),scene=new THREE.Scene(),renderer=new GiantRenderer(scene,family),hits=new HeavyHitFeedback(scene);
  const e={id:0,tier:1,archetype:'giant' as const,x:0,z:16,hp:172,maxHp:172,visualScaleX:2.5004,visualScaleY:2.66,visualScaleZ:2.66};
  const anchor=new THREE.Vector3(...GIANT_WEAPON_GRIP),positions:number[][]=[];
  renderer.update(e,0,hits);const group=scene.getObjectByName('giant-assault-soldier')!,weapon=group.getObjectByName('giant-maul')!;
  const mesh=weapon.children[0] as THREE.Mesh;
  const assertGrip=()=>{
    scene.updateMatrixWorld(true);
    const actual=anchor.clone().applyMatrix4(mesh.matrixWorld),pivot=new THREE.Vector3().setFromMatrixPosition(weapon.matrixWorld);
    expect(actual.distanceTo(pivot)).toBeLessThan(.000001);
    const localHead=new THREE.Vector3(.60,.77,.08).applyMatrix4(mesh.matrixWorld);
    expect(actual.distanceTo(localHead)).toBeGreaterThan(.7);
  };
  for(let age=0;age<=850;age+=850/16){
    renderer.update(e,1700+age,hits);assertGrip();positions.push(weapon.position.toArray());
    const phase=giantWeightPose(0,1700+age,850).phase,offset=giantGripMotion(phase);
    expect(weapon.position.z).toBeCloseTo(GIANT_WEAPON_GRIP[2]+offset.z);
    expect(weapon.rotation.x).toBeCloseTo(giantWeightPose(0,1700+age,850).weapon);
  }
  expect(Math.max(...positions.map(p=>p[2]))-Math.min(...positions.map(p=>p[2]))).toBeGreaterThan(.14);
  expect(Math.max(...positions.map(p=>p[1]))-Math.min(...positions.map(p=>p[1]))).toBeLessThan(.019);
  const last=weapon.position.clone();renderer.die(e,2600);
  for(const age of [0,100,250,450,519]){renderer.update(undefined,2600+age,hits);assertGrip();expect(weapon.position).toEqual(last);}
  renderer.update(undefined,4050,hits);expect(group.visible).toBe(false);
  renderer.reset();expect(weapon.position.toArray()).toEqual([...GIANT_WEAPON_GRIP]);
  renderer.dispose();hits.dispose();family.dispose();expect(scene.children).toHaveLength(0);
});
