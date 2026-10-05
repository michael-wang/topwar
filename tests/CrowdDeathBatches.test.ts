import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { characterFamilies } from './characterModel';
import { enemyDeathPale } from '../src/presentation/EnemyDeathPale';

it('batches dense intact deaths by pose, keeps per-instance pale state and fade and disposes only owned clones', () => {
  const grunt=createChibiGruntFamily(),heavy=createChibiHeavyFamily(),scene=new THREE.Scene();
  const renderer=new EnemyRenderer(scene,{...characterFamilies(),grunt,heavy});
  const enemies=Array.from({length:24},(_,id)=>({id,tier:1,hp:1,x:0,z:8,archetype:'heavy' as const}));
  renderer.update(enemies,0);renderer.update([],10);renderer.update([],10+70);
  const batches=scene.children.filter(c=>c.name==='enemy-frozen-body-batch') as THREE.InstancedMesh[];
  expect(batches.filter(c=>c.visible).length).toBeLessThanOrEqual(5);
  expect(batches.filter(c=>c.visible).reduce((n,c)=>n+c.count,0)).toBe(48); // body + helmet, not 48 draws.
  for(const mesh of batches.filter(c=>c.visible)){
    expect(mesh.geometry).not.toBe(heavy.helmet.geometry);
    expect(heavy.runFrames.some(frame=>frame.geometry===mesh.geometry)).toBe(false);
    expect(mesh.geometry.getAttribute('deathGray')).toBeUndefined();expect(mesh.geometry.getAttribute('deathPale').getX(0)).toBeCloseTo(enemyDeathPale(70, 'heavy'));
    expect(mesh.geometry.getAttribute('deathOpacity').getX(0)).toBe(1);
    expect(mesh.geometry.getAttribute('deathRed')).toBeUndefined();expect(mesh.geometry.getAttribute('deathBreakup').getX(0)).toBe(0);
  }
  renderer.update([],900);
  for(const mesh of batches.filter(c=>c.visible)){expect(mesh.geometry.getAttribute('deathGray')).toBeUndefined();expect(mesh.geometry.getAttribute('deathPale').getX(0)).toBe(1);expect(mesh.geometry.getAttribute('deathBreakup').getX(0)).toBe(0);expect(mesh.geometry.getAttribute('deathOpacity').getX(0)).toBeLessThan(1);}
  const borrowed=vi.spyOn(heavy.helmet.geometry,'dispose');
  const owned=batches.flatMap(mesh=>[vi.spyOn(mesh.geometry,'dispose'),vi.spyOn(mesh.material as THREE.Material,'dispose')]);
  renderer.reset();expect(batches.every(mesh=>!mesh.visible&&mesh.count===0)).toBe(true);
  renderer.dispose();expect(owned.every(spy=>spy.mock.calls.length===1)).toBe(true);
  expect(borrowed).not.toHaveBeenCalled();grunt.dispose();heavy.dispose();expect(scene.children).toHaveLength(0);
});
