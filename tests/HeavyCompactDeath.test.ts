import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { gruntDeathBody } from '../src/presentation/GruntDeathBody';
import { airborneGrenadePose } from '../src/presentation/GrenadeMotion';

it('keeps dense ordinary Heavy deaths intact, pale, pause-stable and bounded at Grunt timing, and resets without replay', () => {
  const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
  const scene = new THREE.Scene(), r = new EnemyRenderer(scene, families);
  const enemies = Array.from({length:48}, (_,i) => ({id:i+1,archetype:'heavy' as const,hp:1,tier:1,x:(i%6)*.3,z:8+Math.floor(i/6)*.3}));
  r.update(enemies, 2000, true); r.update([], 2010, true);
  const bodies = scene.children.filter(o => o.name === 'enemy-pale-death-body' && o.visible);
  expect(bodies).toHaveLength(48);
  const captured = bodies.map(o => o.matrix.clone());
  r.update([], 2340, true);
  const batches = scene.children.filter(o => o.name === 'enemy-frozen-body-batch' && o.visible) as THREE.InstancedMesh[];
  for (const mesh of batches) {
    expect(mesh.count).toBeLessThanOrEqual(48);
    expect(mesh.geometry.getAttribute('deathBreakup')).toBeUndefined();
    expect(mesh.geometry.getAttribute('deathSink')).toBeUndefined();
    expect(mesh.geometry.getAttribute('deathOpacity').getX(0)).toBeCloseTo(.5);
    expect(mesh.geometry.getAttribute('deathPale').getX(0)).toBe(1);
  }
  bodies.forEach((body,i) => {
    const expected = captured[i].clone(); expected.elements[13] += gruntDeathBody(330).lift;
    expect(body.matrix.elements).toEqual(expected.elements);
  });
  const paused = batches.map(m => Array.from(m.instanceMatrix.array));
  r.update([],2340,true); expect(batches.map(m => Array.from(m.instanceMatrix.array))).toEqual(paused);
  r.update([],2530,true); expect(r.getDebugStats().deathVisuals).toBe(0);
  const resources = [...scene.children];
  for (let cycle=0;cycle<4;cycle++) {
    r.update(enemies,3000+cycle*2000,true); r.update([],3010+cycle*2000,true); r.update([],3530+cycle*2000,true);
    expect(scene.children).toEqual(resources); expect(r.getDebugStats().deathVisuals).toBe(0);
  }
  r.reset(); r.update([],20000,true);
  expect(r.getDebugStats().deathVisuals).toBe(0); expect(batches.every(m => !m.visible && m.count === 0)).toBe(true);
  r.dispose(); Object.values(families).forEach(f => f.dispose()); expect(scene.children).toHaveLength(0);
});

it('retains Heavy airstrike airborne motion and its full lifetime instead of applying the ordinary short fade', () => {
  const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
  const scene = new THREE.Scene(), r = new EnemyRenderer(scene, families);
  const enemy = { id:1,archetype:'heavy' as const,hp:1,tier:1,x:.4,z:8 };
  r.update([enemy],2000,true);
  r.presentSupportBomb({heavy:true,victims:[enemy],blasts:[]},2010); r.update([],2010,true);
  const corpse = scene.getObjectByName('enemy-pale-death-body')!, initialY = corpse.matrix.elements[13];
  r.update([],2610,true);
  expect(corpse.visible).toBe(true); expect(r.getDebugStats().airborneDeaths).toBe(1);
  expect(corpse.matrix.elements[13]-initialY).toBeCloseTo(airborneGrenadePose(600).lift*2.5);
  r.update([],3160,true); expect(corpse.visible).toBe(false);
  r.reset(); r.update([enemy],4000,true); r.update([],4010,true); r.update([],4530,true);
  expect(corpse.visible).toBe(false); // Reused slot must return to ordinary 520ms death.
  r.dispose(); Object.values(families).forEach(f => f.dispose()); expect(scene.children).toHaveLength(0);
});
