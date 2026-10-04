import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { COMBAT_COLORS, toyClothBand } from '../src/rendering/characters/ToyCombatGear';
import { ART } from '../src/art/ArtDirection';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { characterFamilies } from './characterModel';
import type { EnemyRenderState } from '../src/rendering/RenderState';

function region(geometry: THREE.BufferGeometry, value: string): THREE.Box3 {
  const p = geometry.getAttribute('position'), c = geometry.getAttribute('color'), color = new THREE.Color(value);
  const bounds = new THREE.Box3();
  for (let i=0;i<p.count;i++) if (Math.abs(c.getX(i)-color.r)+Math.abs(c.getY(i)-color.g)+Math.abs(c.getZ(i)-color.b)<.00001)
    bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  return bounds;
}

it('keeps coarse cloth triangles outside the smooth body so straps do not become clipped noisy patches', () => {
  const source=toyClothBand(.34,.24,.275,.35,Math.PI/2,.18,-.85), band=source.toNonIndexed();
  source.dispose();
  const p=band.getAttribute('position');
  for(let i=0;i<p.count;i+=3) {
    const center=new THREE.Vector3();
    for(let j=i;j<i+3;j++) center.add(new THREE.Vector3().fromBufferAttribute(p,j));
    center.divideScalar(3); center.y-=.35; center.divide(new THREE.Vector3(.34,.24,.275));
    expect(center.length()).toBeGreaterThan(1);
  }
  band.dispose();
});

it('authors trouser lobes and restrained role gear inside the owning reference/run body meshes', () => {
  for (const [create, trousers, gear] of [
    [createChibiPlayerFamily, COMBAT_COLORS.player.trousers, [COMBAT_COLORS.player.gear]],
    [createChibiGruntFamily, ART.raider.shorts, Object.values(COMBAT_COLORS.grunt)],
    [createChibiHeavyFamily, COMBAT_COLORS.heavy.trousers, [COMBAT_COLORS.heavy.harness,COMBAT_COLORS.heavy.pouch]],
    [createChibiGiantFamily, ART.raider.shorts, Object.values(COMBAT_COLORS.giant)],
  ] as const) {
    const family = create();
    const bodies = [family.body, ...('runFrames' in family ? family.runFrames : [])];
    for (const body of bodies) {
      const pants = region(body.geometry,trousers);
      expect(pants.min.x).toBeLessThan(-.15); expect(pants.max.x).toBeGreaterThan(.15);
      expect(pants.min.y).toBeLessThan(.20); expect(pants.max.y).toBeLessThan(.42);
      for (const value of gear) expect(region(body.geometry,value).isEmpty()).toBe(false);
    }
    if (family.role === 'player') {
      const p = family.body.geometry.getAttribute('playerPart'), c = family.body.geometry.getAttribute('color');
      const color = new THREE.Color(COMBAT_COLORS.player.gear);
      for(let i=0;i<p.count;i++) if(Math.abs(c.getX(i)-color.r)<.00001) expect(p.getX(i)).toBe(0);
    } else expect(family.vest.visible).toBe(false); // Gear does not revive secondary draws.
    family.dispose();
  }
});

it('gives Heavy its own broad curved diagonal harness and two hip masses, distinct from Grunt field gear', () => {
  const heavy=createChibiHeavyFamily(), grunt=createChibiGruntFamily();
  const harness=region(heavy.body.geometry,COMBAT_COLORS.heavy.harness);
  expect(harness.min.x).toBeLessThan(-.20); expect(harness.max.x).toBeGreaterThan(.20);
  expect(harness.min.y).toBeLessThan(.20); expect(harness.max.y).toBeGreaterThan(.50);
  expect(harness.max.y).toBeLessThan(.61);
  const pouches=region(heavy.body.geometry,COMBAT_COLORS.heavy.pouch);
  expect(pouches.min.x).toBeLessThan(-.30); expect(pouches.max.x).toBeGreaterThan(.30);
  expect(pouches.min.x).toBeGreaterThan(-.38); expect(pouches.max.x).toBeLessThan(.38);
  expect(pouches.min.z).toBeGreaterThan(.16); // Attached lower-front equipment, inside fist width.
  expect(pouches.max.y).toBeLessThan(.34);
  const canteen=region(grunt.body.geometry,COMBAT_COLORS.grunt.canteen);
  expect(canteen.max.x).toBeLessThan(0);
  expect(region(grunt.body.geometry,COMBAT_COLORS.heavy.harness).isEmpty()).toBe(true);
  expect(region(heavy.body.geometry,COMBAT_COLORS.grunt.canteen).isEmpty()).toBe(true);
  expect(heavy.body.geometry).not.toBe(grunt.body.geometry);
  heavy.dispose(); grunt.dispose();
});

it('keeps crowd gear in bounded static pose batches and disposes merged geometry through its role owner', () => {
  const scene=new THREE.Scene(), grunt=createChibiGruntFamily(), heavy=createChibiHeavyFamily(), giant=createChibiGiantFamily();
  const renderer=new EnemyRenderer(scene,{...characterFamilies(),grunt,heavy,giant});
  const fixtures=(count:number):EnemyRenderState[]=>Array.from({length:count},(_,id)=>({id,tier:1,
    archetype:id%5===0?'heavy':'grunt',x:0,z:10,hp:10,maxHp:10}));
  renderer.update(fixtures(50),0);
  const meshes=scene.children.filter(child=>child instanceof THREE.InstancedMesh);
  renderer.update(fixtures(200),1000);
  const expanded=scene.children.filter(child=>child instanceof THREE.InstancedMesh);
  expect(expanded).toHaveLength(meshes.length); // Capacity may grow, batch count may not.
  const bodies=expanded.filter(mesh=>[grunt.body,...grunt.runFrames,heavy.body,...heavy.runFrames]
    .some(source=>source.geometry===(mesh as THREE.InstancedMesh).geometry)) as THREE.InstancedMesh[];
  expect(bodies).toHaveLength(8);
  expect(bodies.reduce((sum,body)=>sum+body.count,0)).toBe(200);
  const owned=[grunt,heavy,giant].map(f=>vi.spyOn(f.body.geometry,'dispose'));
  renderer.dispose(); for(const spy of owned) expect(spy).not.toHaveBeenCalled();
  grunt.dispose(); heavy.dispose(); giant.dispose(); for(const spy of owned) expect(spy).toHaveBeenCalledTimes(1);
});
