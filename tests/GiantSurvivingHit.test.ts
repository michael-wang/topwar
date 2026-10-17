import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { HeavyHitFeedback, SURVIVING_HIT_STYLES } from '../src/rendering/enemies/HeavyHitFeedback';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ART } from '../src/art/ArtDirection';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';

it('varies repeated armor contacts deterministically, stays on the upper chest and reuses the same pool', () => {
  const scene=new THREE.Scene(),family=createChibiGiantFamily(),r=new GiantRenderer(scene,family),hits=new HeavyHitFeedback(scene);
  const e={id:1,tier:1,archetype:'giant' as const,hp:172,x:2,z:14,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:4.2};
  const objects=scene.children.slice(),points:number[][]=[];
  const inverse=new THREE.Matrix4();
  for(let cycle=0;cycle<2;cycle++){
    hits.reset();
    for(let i=0;i<8;i++){
      const now=1000+i*350;hits.update(new Set([1]),now);expect(hits.observe(e,now)).toBe(true);r.update(e,now,hits);
      const body=scene.getObjectByName('giant-body') as THREE.Mesh;
      const core=scene.children.find(o=>o.name==='heavy-hit-sparks'&&o.visible)!.getObjectByName('giant-hit-hot-core')!;
      inverse.copy(body.matrixWorld).invert();
      const local=core.position.clone();local.z+=.035;local.applyMatrix4(inverse);
      expect(local.x).toBeGreaterThanOrEqual(-.181);expect(local.x).toBeLessThanOrEqual(.181);
      expect(local.y).toBeGreaterThanOrEqual(.649);expect(local.y).toBeLessThanOrEqual(.901);expect(local.z).toBeCloseTo(.41);
      if(cycle===0)points.push(local.toArray());else local.toArray().forEach((v,axis)=>expect(v).toBeCloseTo(points[i][axis]));
      const captured=core.position.clone();r.update({...e,x:1,z:13},now+30,hits);expect(core.position.equals(captured)).toBe(true);
      expect(scene.children).toEqual(objects);
    }
  }
  expect(new Set(points.slice(0,7).map(p=>p.map(v=>v.toFixed(3)).join(','))).size).toBe(7);
  points[0].forEach((v,axis)=>expect(points[7][axis]).toBeCloseTo(v));
  r.dispose();hits.dispose();family.dispose();expect(scene.children).toHaveLength(0);
});

it('anchors the ivory core and long gold streaks to transformed upper armor, detaches, and outlasts Heavy sparks', () => {
  const scene=new THREE.Scene(),family=createChibiGiantFamily(),r=new GiantRenderer(scene,family),hits=new HeavyHitFeedback(scene);
  const e={id:1,tier:1,archetype:'giant' as const,hp:172,x:2,z:22,visualScaleX:2.3,visualScaleY:2.9,visualScaleZ:2.6};
  r.update(e,0,hits);hits.observe(e,1000);hits.update(new Set([1]),1000);r.update(e,1000,hits);
  const body=scene.getObjectByName('giant-body') as THREE.Mesh;
  const core=scene.getObjectByName('giant-hit-hot-core') as THREE.Mesh;
  const expected=new THREE.Vector3(.04,.82,.41).applyMatrix4(body.matrixWorld);
  expect(core.position.y).toBeCloseTo(expected.y);expect(core.position.y).toBeGreaterThan(2);
  expect(core.position.z).toBeCloseTo(expected.z-.035);expect(core.visible).toBe(true);
  const sparks=scene.getObjectByName('heavy-hit-sparks')!,streak=sparks.children[0] as THREE.Mesh;
  for(const width of [350,390]){
    const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
    const left=streak.position.clone().add(new THREE.Vector3(-.035*streak.scale.x,0,0)).project(camera);
    const right=streak.position.clone().add(new THREE.Vector3(.035*streak.scale.x,0,0)).project(camera);
    expect(Math.abs(right.x-left.x)*width/2).toBeGreaterThan(5);
  }
  const anchored=core.position.clone();r.update({...e,z:21},1010,hits);expect(core.position.equals(anchored)).toBe(true);
  hits.update(new Set([1]),1240);expect(sparks.visible).toBe(true);expect(core.visible).toBe(false);
  hits.update(new Set([1]),1300);expect(sparks.visible).toBe(false);
  r.dispose();hits.dispose();family.dispose();expect(scene.children).toHaveLength(0);
});

it('uses bright six-spoke Giant metal sparks with a restrained body flash and unchanged Heavy treatment', () => {
  const scene=new THREE.Scene(), feedback=new HeavyHitFeedback(scene);
  const enemy={ id:1,tier:1,archetype:'giant' as const,x:0,z:15,hp:100 };
  feedback.observe(enemy,0); feedback.observe({...enemy,id:2,archetype:'heavy'},0);
  feedback.update(new Set([1,2]),0);
  const bodies=scene.children.filter(child=>child.name==='heavy-hit-body') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[];
  const sparks=scene.children.filter(child=>child.name==='heavy-hit-sparks');
  expect(bodies[0].material.color.getHexString()).toBe('ffe34f');
  expect(bodies[0].material.opacity).toBe(.24);
  expect(bodies[1].material.opacity).toBe(.72);
  expect(bodies[1].material.color.getHexString()).toBe(new THREE.Color(ART.fx.core).getHexString());
  expect(sparks[0].children.filter(child=>child.visible)).toHaveLength(7);
  expect(sparks[1].children.filter(child=>child.visible)).toHaveLength(4);
  const spark=sparks[0].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(spark.scale.x).toBeCloseTo(2.8*4.2); expect(spark.material.opacity).toBe(1);
  expect(spark.material.color.getHexString()).toBe('ffe34f');
  const heavySpark=sparks[1].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(heavySpark.material.color.getHexString()).toBe(new THREE.Color(ART.fx.impact).getHexString());
  expect(heavySpark.scale.toArray()).toEqual([1,1,1]);
  feedback.update(new Set([1,2]),50);
  expect(bodies[0].visible).toBe(true);
  expect(spark.material.opacity).toBeCloseTo(Math.pow(1-50/300,.6));
  feedback.update(new Set([1,2]),100); expect(bodies[0].visible).toBe(false);
  feedback.update(new Set([1,2]),170); expect(sparks[0].visible).toBe(true); expect(sparks[1].visible).toBe(false);
  feedback.update(new Set([1,2]),300);expect(sparks[0].visible).toBe(false);
  const material=bodies[0].material, disposed=vi.spyOn(material,'dispose');
  expect(feedback.observe(enemy,500)).toBe(true);
  expect(scene.children).toHaveLength(24); expect(bodies[0].material).toBe(material);
  const borrowed=new THREE.BufferGeometry(), borrowedDisposed=vi.spyOn(borrowed,'dispose');
  feedback.setBody(1,borrowed,new THREE.Matrix4(),500);
  feedback.dispose(); expect(disposed).toHaveBeenCalledTimes(1); expect(borrowedDisposed).not.toHaveBeenCalled();
  borrowed.dispose();
});

it('routes repeated Giant HP deltas to bounded gold sparks without blood, and resets silently on Restore/Retry', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
  const giant={id:1,tier:1,archetype:'giant' as const,x:0,z:12,hp:172,maxHp:172,visualScale:3};
  const blood=scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh;
  const stains=scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  renderer.update([giant],0);renderer.update([{...giant,hp:171}],2000);
  let objects=0;
  for(let i=0;i<150;i++){
    const enemy={...giant,hp:170-i},age=2250+i*30;
    renderer.update([enemy],age);renderer.update([enemy],age); // Same presentation age freezes effects.
    expect(blood.count).toBe(0);expect(stains.count).toBe(0);
    if(i===5)objects=scene.children.length; // Existing pool lazily warms before reusing expired slots.
    if(i>5)expect(scene.children.length).toBe(objects);
    expect(scene.children.filter(o=>o.name==='heavy-hit-sparks').length).toBeLessThanOrEqual(12);
  }
  const sparks=scene.children.find(o=>o.name==='heavy-hit-sparks'&&o.visible)!;
  expect(sparks).toBeDefined();
  renderer.reset();renderer.update([{...giant,hp:20}],9000);
  expect(scene.children.filter(o=>o.name==='heavy-hit-sparks'&&o.visible)).toHaveLength(0);
  expect(blood.count).toBe(0);expect(stains.count).toBe(0);
  renderer.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
});

it('limits ordinary emissive while preserving immediate Giant visibility and dedicated HP dimensions', () => {
  const scene=new THREE.Scene(), family=createChibiGiantFamily(), renderer=new GiantRenderer(scene,family);
  const feedback=new HeavyHitFeedback(scene);
  const enemy={id:1,tier:1,archetype:'giant' as const,x:0,z:10,hp:100,visualScale:3};
  renderer.update(enemy,0,feedback);
  expect(renderer.barVisible()).toBe(true);
  feedback.observe(enemy,2000); renderer.update(enemy,2000,feedback);
  const body=scene.getObjectByName('giant-body') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
  expect(body.material.emissiveIntensity).toBe(SURVIVING_HIT_STYLES.giant.emissivePeak);
  expect(body.material.emissiveIntensity).toBeLessThanOrEqual(.12);
  expect(body.material.emissive.getHexString()).toBe('ffe34f');
  const bar=renderer.healthBarLayout(enemy); expect(bar.width).toBeCloseTo(3.6); expect(bar.height).toBeCloseTo(.6);
  renderer.die(enemy,2100); renderer.update(undefined,2110,feedback);
  expect(body.material.emissiveIntensity).toBe(0);
  renderer.dispose(); feedback.dispose(); family.dispose();
});
