import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { HeavyHitFeedback, SURVIVING_HIT_STYLES } from '../src/rendering/enemies/HeavyHitFeedback';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ART } from '../src/art/ArtDirection';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';

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
  expect(sparks[0].children.filter(child=>child.visible)).toHaveLength(6);
  expect(sparks[1].children.filter(child=>child.visible)).toHaveLength(4);
  const spark=sparks[0].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(spark.scale.x).toBeCloseTo(1.8*2.4); expect(spark.material.opacity).toBe(1);
  expect(spark.material.color.getHexString()).toBe('ffe34f');
  const heavySpark=sparks[1].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(heavySpark.material.color.getHexString()).toBe(new THREE.Color(ART.fx.impact).getHexString());
  expect(heavySpark.scale.toArray()).toEqual([1,1,1]);
  feedback.update(new Set([1,2]),50);
  expect(bodies[0].visible).toBe(true);
  expect(spark.material.opacity).toBeCloseTo(1-50/170);
  feedback.update(new Set([1,2]),100); expect(bodies[0].visible).toBe(false);
  feedback.update(new Set([1,2]),170); expect(sparks[0].visible).toBe(false);
  const material=bodies[0].material, disposed=vi.spyOn(material,'dispose');
  expect(feedback.observe(enemy,250)).toBe(true);
  expect(scene.children).toHaveLength(4); expect(bodies[0].material).toBe(material);
  const borrowed=new THREE.BufferGeometry(), borrowedDisposed=vi.spyOn(borrowed,'dispose');
  feedback.setBody(1,borrowed,new THREE.Matrix4(),250);
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
