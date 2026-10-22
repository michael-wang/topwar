import { enemyFamilies } from './characterModel';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { AudioCueObserver } from '../src/audio/GameAudio';
import { bodyModel, helmetModel, vestModel, runFrames, grayBodyModel } from './characterModel';
it('renders two solid original-color Giants immediately, showing bars only after damage and preserving the survivor', () => {
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene,enemyFamilies(bodyModel(),helmetModel(),vestModel(),runFrames(),grayBodyModel()));
  const a={id:1,tier:1,archetype:'giant' as const,hp:172,maxHp:172,x:-1.4,z:30,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:5.04};
  const b={...a,id:2,x:1.4,z:40}; renderer.update([a,b],0);
  const giants=scene.children.filter(child=>child.name==='giant-assault-soldier');
  expect(giants.filter(child=>child.visible)).toHaveLength(2);
  expect(giants[0].position.x).not.toBe(giants[1].position.x);
  for (const giant of giants.filter(child=>child.visible)) giant.traverse(o=>{
    if(o instanceof THREE.Mesh){const material=o.material as THREE.MeshStandardMaterial;
      expect(material.opacity).toBe(1);expect(material.transparent).toBe(false);expect(material.color.getHexString()).toBe('ffffff');}
  });
  expect(scene.getObjectByName('giant-emergence-haze')).toBeUndefined();
  expect(scene.children.filter(child=>child.name==='heavy-hp-backing'&&child.visible)).toHaveLength(0);
  renderer.update([{...a,hp:171},{...b,hp:163}],1500);
  const bars=scene.children.filter(child=>child.name==='heavy-hp-backing'&&child.visible);
  expect(bars).toHaveLength(2); expect(bars[0].scale.x).toBeLessThan(2.7);
  const survivor={...b,hp:163};
  renderer.update([survivor],1600); renderer.update([survivor],1750);
  expect(scene.children.filter(child=>child.name==='heavy-hp-backing'&&child.visible)).toHaveLength(1);
  expect(giants.filter(child=>child.visible)).toHaveLength(2); // one frozen lethal figure, one live
  renderer.update([survivor],1850); expect(giants.filter(child=>child.visible)).toHaveLength(2);
  renderer.update([survivor],4200); expect(giants.filter(child=>child.visible)).toHaveLength(1);
  expect(scene.getObjectsByProperty('name','giant-armor-wreckage')).toHaveLength(0);
  renderer.reset(); renderer.dispose(); expect(scene.children).toHaveLength(0);
});
it('emits one heavy death/crash cue on a kill, excludes a leaked Giant and resets on Retry', () => {
  const observer=new AudioCueObserver(), giant={id:1,hp:1,archetype:'giant' as const};
  observer.observe(2,2,[giant],0);
  expect(observer.observe(2,2,[],100)).toContain('giantDeath');
  expect(observer.observe(2,2,[],200)).not.toContain('giantDeath');
  observer.reset(); observer.observe(2,2,[giant],0);
  expect(observer.observe(2,1,[],100)).not.toContain('giantDeath');
});
