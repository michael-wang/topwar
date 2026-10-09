import { expect, it } from 'vitest';
import * as THREE from 'three';
import { GRENADE_FX, crateFragmentPose, radialBlastDirection, airborneGrenadePose } from '../src/presentation/GrenadeMotion';
import { GrenadeRenderer } from '../src/rendering/GrenadeRenderer';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import type { GrenadeEvent } from '../src/simulation/grenade';
import type { EnemyRenderState } from '../src/rendering/RenderState';

it('keeps crate panels attached until opening, then rotates and falls every fragment to the ground',()=>{
  const scene=new THREE.Scene(),r=new GrenadeRenderer(scene),group=scene.getObjectByName('grenade-supply')!;
  const base={originZ:0,elapsedSeconds:0,flight:null};
  for(const stage of [0,1,2] as const){r.update({...base,supply:{lane:2,x:0,depth:14,destruction:{mode:'staged',stage,recoverySeconds:.7,recoverAtSeconds:stage?.7:0}}},0);
    expect(group.children[9].position.y).toBe(.48);expect(group.children.slice(0,16).every(m=>m.position.length()<1)).toBe(true);}
  r.present([{kind:'grenadeSupplyOpened',x:0,z:14,amount:3}],0);
  r.update({...base,supply:null},250);const positions=group.children.slice(0,16).map(m=>m.position.clone());
  r.update({...base,supply:null},250);positions.forEach((p,i)=>expect(group.children[i].position).toEqual(p));
  r.update({...base,supply:null},1000);
  for(const mesh of group.children.slice(0,16)){expect(mesh.position.y+group.position.y).toBeCloseTo(.07);expect(mesh.rotation.x).not.toBe(0);}
  r.update({...base,supply:null},1200);expect(group.visible).toBe(false);
  for(let i=0;i<16;i++){const up=crateFragmentPose(i,150,.9),down=crateFragmentPose(i,650,.9),land=crateFragmentPose(i,1000,.9);
    expect(up.y).toBeGreaterThan(.9);expect(down.y).toBeLessThan(up.y);expect(land.landed).toBe(true);}
  r.dispose();expect(scene.children).toEqual([]);
});

it('has a bright initial core, fast radius-sized shockwave and dissipating smoke in two stable pools',()=>{
  const scene=new THREE.Scene(),r=new GrenadeRenderer(scene),state={supply:null,flight:null,originZ:0,elapsedSeconds:0};
  const children=[...scene.children];
  const blast=(at:number)=>r.present([{kind:'grenadeDetonated',x:1.4,z:14,radius:4,victims:[]}],at);
  blast(0);r.update(state,30);expect(scene.getObjectByName('grenade-flash')!.visible).toBe(true);
  expect(scene.getObjectByName('grenade-flash')!.position.x).toBe(-1.4);
  r.update(state,330);expect(scene.getObjectByName('grenade-flash')!.visible).toBe(false);
  expect(scene.getObjectByName('grenade-shock-ring')!.scale.x).toBeGreaterThan(3.7);
  r.update(state,700);expect(scene.getObjectByName('grenade-smoke')!.visible).toBe(true);
  expect(scene.getObjectByName('grenade-fire')!.visible).toBe(false);
  for(let i=0;i<30;i++){blast(i*650);r.update(state,i*650+100);expect(r.getDebugStats().activeExplosions).toBeLessThanOrEqual(2);expect(scene.children).toEqual(children);}
  r.update(state,30000);expect(r.getDebugStats().activeExplosions).toBe(0);r.reset();expect(scene.children.every(m=>!m.visible)).toBe(true);
  r.dispose();expect(scene.children).toEqual([]);
});

it('uses actual radial positions, deterministic coincident directions and a complete airborne fall',()=>{
  expect(radialBlastDirection(2,10,0,10,1)).toEqual({x:-1,z:0});
  expect(radialBlastDirection(-2,10,0,10,2)).toEqual({x:1,z:0});
  expect(radialBlastDirection(0,12,0,10,3)).toEqual({x:0,z:1});
  expect(radialBlastDirection(0,10,0,10,3)).toEqual(radialBlastDirection(0,10,0,10,3));
  expect(airborneGrenadePose(440).lift).toBeGreaterThan(1);
  expect(airborneGrenadePose(880).lift).toBeCloseTo(0);expect(airborneGrenadePose(1000).opacity).toBeLessThan(1);
  expect(airborneGrenadePose(GRENADE_FX.airborneMs).visible).toBe(false);
});

it('bounds airborne Grunts and reuses death bodies; Heavy/Giant recoil recovers without mutating enemies',()=>{
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
  const scene=new THREE.Scene(),plainScene=new THREE.Scene(),r=new EnemyRenderer(scene,families),plain=new EnemyRenderer(plainScene,families);
  const enemies:EnemyRenderState[]=Array.from({length:24},(_,i)=>({id:i+1,archetype:'grunt',tier:1,hp:1,x:(i%5-2)*.8,z:10+Math.floor(i/5)*.25,visualScale:1.8}));
  enemies.push({id:30,archetype:'heavy',tier:1,hp:15,x:-1,z:10,visualScale:1.8},{id:31,archetype:'giant',tier:1,hp:172,x:1,z:10,visualScale:2});
  const snapshot=structuredClone(enemies),survivors=enemies.slice(-2).map(e=>({...e,hp:e.hp-9}));
  for(const renderer of [r,plain]){renderer.update(enemies,0,true);renderer.update(enemies,2000,true);}
  const event:Extract<GrenadeEvent,{kind:'grenadeDetonated'}>={kind:'grenadeDetonated',x:0,z:10,radius:4,
    victims:enemies.map(e=>({id:e.id,x:e.x,z:e.z,archetype:e.archetype!,damage:Math.min(9,e.hp),killed:e.hp<=9,killXp:e.hp<=9?1:0}))};
  r.presentGrenade([event],2100);r.update(survivors,2100,true);plain.update(survivors,2100,true);
  expect(r.getDebugStats().airborneDeaths).toBe(8);expect(r.getDebugStats().deathVisuals).toBe(24);
  r.update(survivors,2250,true);plain.update(survivors,2250,true);
  const giant=scene.getObjectByName('giant-assault-soldier')!,normalGiant=plainScene.getObjectByName('giant-assault-soldier')!;
  expect(giant.position.x).toBeLessThan(normalGiant.position.x);expect(giant.rotation.z).not.toBe(normalGiant.rotation.z);
  const heavyMatrix=(renderer:EnemyRenderer)=>{const target=new THREE.Matrix4();(renderer as unknown as {copyBodyWorld(e:EnemyRenderState,m:THREE.Matrix4):void}).copyBodyWorld(survivors[0],target);return target;};
  expect(heavyMatrix(r).elements[12]).toBeGreaterThan(heavyMatrix(plain).elements[12]);
  const bodies=scene.children.filter(g=>g.name==='enemy-pale-death-body'&&g.visible);
  expect(bodies.filter(g=>g.matrix.elements[13]>.5).length).toBe(8);
  const frozen=bodies.map(g=>g.matrix.clone());r.update(survivors,2250,true);bodies.forEach((g,i)=>expect(g.matrix).toEqual(frozen[i]));
  r.update(survivors,2800,true);plain.update(survivors,2800,true);
  expect(heavyMatrix(r)).toEqual(heavyMatrix(plain));expect(giant.matrix).toEqual(normalGiant.matrix);
  expect(r.getDebugStats().blastReactions).toBe(0);expect(enemies).toEqual(snapshot);
  r.update(survivors,3400,true);expect(r.getDebugStats().airborneDeaths).toBe(0);
  r.reset();expect(r.getDebugStats().deathVisuals).toBe(0);r.dispose();plain.dispose();Object.values(families).forEach(f=>f.dispose());
  expect(scene.children).toEqual([]);
});
