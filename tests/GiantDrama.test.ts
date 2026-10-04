import { enemyFamilies } from './characterModel';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { giantReveal, GIANT_REVEAL_MS } from '../src/presentation/GiantDrama';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { AudioCueObserver } from '../src/audio/GameAudio';
import { bodyModel, helmetModel, vestModel, runFrames, grayBodyModel } from './characterModel';
it('reveals silhouette over 1.5s and withholds bars until mostly readable', () => {
  expect(GIANT_REVEAL_MS).toBe(1500); expect(giantReveal(0).opacity).toBe(.18);
  expect(giantReveal(750).opacity).toBeGreaterThan(.5); expect(giantReveal(750).barVisible).toBe(false);
  expect(giantReveal(1200).barVisible).toBe(true); expect(giantReveal(1500).haze).toBe(0);
  expect(giantReveal(1500).opacity).toBe(1);
});
it('renders two independent Giants, delays both HP bars, and preserves the other when one dies', () => {
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene,enemyFamilies(bodyModel(),helmetModel(),vestModel(),runFrames(),grayBodyModel()));
  const a={id:1,tier:1,archetype:'giant' as const,hp:172,maxHp:172,x:-1.4,z:30,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:5.04};
  const b={...a,id:2,x:1.4,z:40}; renderer.update([a,b],0);
  const giants=scene.children.filter(child=>child.name==='giant-assault-soldier');
  expect(giants.filter(child=>child.visible)).toHaveLength(2);
  expect(giants[0].position.x).not.toBe(giants[1].position.x);
  expect(scene.children.filter(child=>child.name==='heavy-hp-backing'&&child.visible)).toHaveLength(0);
  renderer.update([a,b],1500);
  const bars=scene.children.filter(child=>child.name==='heavy-hp-backing'&&child.visible);
  expect(bars).toHaveLength(2); expect(bars[0].scale.x).toBeLessThan(2.7);
  renderer.update([b],1600); renderer.update([b],1750);
  expect(giants.filter(child=>child.visible)).toHaveLength(2); // one frozen lethal figure, one live
  renderer.update([b],1850); expect(giants.filter(child=>child.visible)).toHaveLength(1);
  expect(scene.getObjectsByProperty('name','giant-armor-wreckage')).toHaveLength(0);
  renderer.reset(); renderer.dispose(); expect(scene.children).toHaveLength(0);
});
it('emits one heavy death/crash cue on a kill, excludes a leaked Giant and resets on Retry', () => {
  const observer=new AudioCueObserver(), giant={id:1,hp:1,archetype:'giant' as const};
  observer.observe(2,2,[giant],[],null,0);
  expect(observer.observe(2,2,[],[],null,100)).toContain('giantDeath');
  expect(observer.observe(2,2,[],[],null,200)).not.toContain('giantDeath');
  observer.reset(); observer.observe(2,2,[giant],[],null,0);
  expect(observer.observe(2,1,[],[],null,100)).not.toContain('giantDeath');
});
