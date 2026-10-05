import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ENEMY_DEATH_TIMING, enemyReactionStage } from '../src/presentation/EnemyDeathTiming';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
it('bakes two role-owned sink/hands-up poses with planted, wider shoes', () => {
 for(const family of [createChibiGruntFamily(),createChibiHeavyFamily()]) {
  const reaction=family.lethalReaction!, before=family.body.geometry.getAttribute('position'), after=reaction.final.geometry.getAttribute('position');
  expect(before.count).toBe(after.count);expect(reaction.transition.geometry).not.toBe(reaction.final.geometry);
  const handX=family.role==='grunt'?.30:.46;
  const handTop=(p:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>{
   let top=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>handX&&p.getY(i)>.25&&p.getY(i)<.70)top=Math.max(top,p.getY(i));return top;
  };
  expect(handTop(after)).toBeGreaterThan(handTop(before)+.12);
  const headTop=(p:THREE.BufferAttribute|THREE.InterleavedBufferAttribute)=>{
   let top=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.1)top=Math.max(top,p.getY(i));return top;
  };
  expect(headTop(after)).toBeLessThan(headTop(before)-.05);
  reaction.final.geometry.computeBoundingBox();expect(reaction.final.geometry.boundingBox!.min.y).toBeCloseTo(0);
  expect(enemyReactionStage(0,family.role)).toBe(0);expect(enemyReactionStage(300,family.role)).toBe(2);
  expect(ENEMY_DEATH_TIMING.grunt.totalMs).toBeLessThanOrEqual(540);family.dispose();
 }
});
it('keeps the Giant grip and maul in one assembly through reaction, then slightly loosens without uncoupling',()=>{
 const family=createChibiGiantFamily(),scene=new THREE.Scene(),renderer=new GiantRenderer(scene,family),hits=new HeavyHitFeedback(scene);
 const enemy={id:1,tier:1,hp:1,x:0,z:12,archetype:'giant' as const,visualScale:2.6};
 renderer.update(enemy,0,hits);renderer.update(enemy,2000,hits);const group=renderer.die(enemy,2010),root=group.position.clone();
 const weapon=group.getObjectByName('giant-maul')!,mesh=weapon.children[0] as THREE.Mesh,offset=mesh.position.clone();
 renderer.update(undefined,2700,hits);group.updateMatrixWorld(true);const final=weapon.matrixWorld.clone();
 expect(mesh.geometry.getAttribute('position').array).toEqual(family.weapon!.geometry.getAttribute('position').array);expect(mesh.position).toEqual(offset);expect(group.position).toEqual(root);
 expect((group.children[0] as THREE.Mesh).geometry).toBe(family.lethalReaction!.final.geometry);
 renderer.update(undefined,3500,hits);group.updateMatrixWorld(true);const a=new THREE.Vector3().setFromMatrixPosition(final),b=new THREE.Vector3().setFromMatrixPosition(weapon.matrixWorld);expect(a.distanceTo(b)).toBeLessThan(.12);expect(mesh.position).toEqual(offset);expect(mesh.geometry.getAttribute('position').array).toEqual(family.weapon!.geometry.getAttribute('position').array);
 renderer.dispose();hits.dispose();family.dispose();
});
