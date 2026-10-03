import { playerFamily, enemyFamilies, giantFamily } from './characterModel';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { laneLocomotion, recoilEnvelope, giantWeightPose, LANE_LOCOMOTION_MS } from '../src/presentation/CharacterMotion';
import { BattlefieldAir, AMBIENT_MOTES, FOOT_DUST_CAPACITY } from '../src/rendering/environment/BattlefieldAir';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { bodyModel, helmetModel, vestModel, rifleModel } from './characterModel';

it('anticipates, steps with independent member phases, and settles by 220ms', () => {
  expect(LANE_LOCOMOTION_MS).toBe(220);
  expect(laneLocomotion(11,1,0).lean).toBeLessThan(0);
  expect(laneLocomotion(90,1,0).lean).toBeGreaterThan(0);
  expect(laneLocomotion(90,1,0).stride).not.toBe(laneLocomotion(90,1,1).stride);
  expect(laneLocomotion(90,-1,0).lean).toBe(-laneLocomotion(90,1,0).lean);
  for (const age of [220,1000,Infinity,-1]) expect(laneLocomotion(age,1,0)).toEqual({stride:0,lean:0,bob:0,lag:0});
  expect(recoilEnvelope(0)).toBe(1); expect(recoilEnvelope(100)).toBeLessThan(0);
  expect(recoilEnvelope(150)).toBe(0);
});
it('keeps player anchors and independent recoil while lane locomotion settles and resets', () => {
  const scene = new THREE.Scene(), renderer = new SquadRenderer(scene, playerFamily(bodyModel(),helmetModel(),vestModel(),rifleModel()));
  const frame = { defenseMode:true, player:{x:0,z:0,selectedLane:2},squad:{count:2,rocketCount:0,rifleCounts:[2],formationSpacing:.45},
    track:{halfWidth:3.2,defenseLineZ:-1.5},enemies:[],boss:null,streamRewards:[],gates:[],pickups:[],projectiles:[] };
  renderer.update(frame,0); const initialX = (scene.children.find(child => child instanceof THREE.Group) as THREE.Group).position.x;renderer.update({...frame,player:{x:1.4,z:0,selectedLane:3}},400);
  renderer.update({...frame,player:{x:1.4,z:0,selectedLane:3},projectiles:[{id:1,kind:'rifle' as const,tier:1,memberIndex:0,x:1.4,z:1,hitRadiusBonus:0}]},460);
  const members = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
  expect(members[0].position.x).toBeCloseTo(initialX - 1.4);
  expect(members[0].getObjectByName('toy-soldier-body')!.rotation.z).not.toBe(0);
  expect(members[0].getObjectByName('toy-rifle')!.position.z).toBeLessThan(members[1].getObjectByName('toy-rifle')!.position.z);
  renderer.update(frame,800);renderer.update(frame,1100);
  expect(members[0].getObjectByName('toy-soldier-body')!.rotation.z).toBe(0);
  renderer.reset();renderer.update(frame,1200);
  expect(members[0].getObjectByName('toy-rifle')!.position.z).toBeCloseTo(0);
  renderer.dispose();
});
it('keeps Giant weight and secondary motion small, asynchronous and independent of velocity', () => {
  const a = giantWeightPose(1,200,850), b = giantWeightPose(2,200,850);
  expect(a.arm).not.toBe(b.arm); expect(a.weapon).not.toBe(a.arm);
  for(let t=0;t<1700;t+=10) {
    const p=giantWeightPose(1,t,850);
    expect(p.compression).toBeGreaterThanOrEqual(0);expect(p.compression).toBeLessThanOrEqual(.018);
    expect(Math.abs(p.sway)).toBeLessThanOrEqual(.026);
  }
});
it('bounds ambient/dust buffers and never allocates another emitter during a long Giant walk', () => {
  const scene=new THREE.Scene(), air=new BattlefieldAir(scene);
  const enemy={id:1,tier:1,archetype:'giant' as const,hp:210,x:0,z:20,visualScaleX:3.4,gaitCycleMs:850};
  const ash=scene.getObjectByName('battlefield-air-motes') as THREE.Points;
  const dust=scene.getObjectByName('giant-foot-dust') as THREE.Points;
  expect(ash.geometry.attributes.position.count).toBe(AMBIENT_MOTES);
  expect(dust.geometry.attributes.position.count).toBe(FOOT_DUST_CAPACITY);
  const geometry=dust.geometry;
  for(let t=0;t<60000;t+=50) air.update([enemy],0,t,true);
  expect(scene.children).toHaveLength(2); expect(dust.geometry).toBe(geometry);
  expect(Array.from(dust.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
  air.update([],0,61000,true); expect(dust.visible).toBe(false);
  air.reset(); expect(ash.visible).toBe(false);expect(dust.visible).toBe(false);
  air.dispose();expect(scene.children).toHaveLength(0);
});


import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { grayBodyModel, runFrames } from './characterModel';
it('keeps Heavy locomotion underneath additive hits and gives its death a short physical collapse', () => {
  const scene=new THREE.Scene(), renderer=new EnemyRenderer(scene,enemyFamilies(bodyModel(),helmetModel(),vestModel(),runFrames(),grayBodyModel()));
  const enemy={id:1,tier:1,archetype:'heavy' as const,x:0,z:14,hp:15,maxHp:15};
  renderer.update([enemy],100);renderer.update([{...enemy,hp:14}],120);
  const matrix=new THREE.Matrix4();
  (scene.getObjectByName(`toy-soldier-run-${enemyRunFrame(1,120,650)}`) as THREE.InstancedMesh).getMatrixAt(0,matrix);
  const hitMatrix=matrix.clone();renderer.update([{...enemy,hp:14}],170);
  (scene.getObjectByName(`toy-soldier-run-${enemyRunFrame(1,170,650)}`) as THREE.InstancedMesh).getMatrixAt(0,matrix);
  expect(matrix.equals(hitMatrix)).toBe(false);
  renderer.update([],200);renderer.update([],310);
  const corpse=scene.children.find(child => child instanceof THREE.Group && child.children.some(part=>part instanceof THREE.Mesh && part.material instanceof THREE.MeshStandardMaterial && part.material.transparent));
  expect(corpse?.rotation.x).toBeLessThan(-.3);
  renderer.update([],700);expect(corpse?.visible).toBe(false);renderer.reset();renderer.dispose();
});
it('articulates Giant forearm/mace lag and collapses physically before breakup', () => {
  const scene=new THREE.Scene(), body=bodyModel(), renderer=new GiantRenderer(scene,giantFamily(body,helmetModel(),vestModel(),runFrames(),grayBodyModel())), hits=new HeavyHitFeedback(scene);
  const enemy={id:1,tier:1,archetype:'giant' as const,x:0,z:14,hp:210,maxHp:210,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:5.04};
  renderer.update(enemy,100,hits);
  const group=scene.getObjectByName('giant-assault-soldier')!, mace=group.getObjectByName('giant-mace')!, arm=group.getObjectByName('giant-arm')!, forearm=group.getObjectByName('giant-forearm')!;
  expect(mace.parent?.name).toBe('giant-forearm'); expect(arm.rotation.x).not.toBe(forearm.rotation.x);
  const angle=mace.rotation.x;hits.observe({...enemy,hp:209},120);renderer.update({...enemy,hp:209},120,hits);
  expect(mace.rotation.x).not.toBe(angle);
  renderer.die(enemy,200);renderer.update(undefined,550,hits);
  expect(group.rotation.x).toBeLessThan(-.5);expect(group.position.y).toBeLessThan(1.05); // Lift the prone armor thickness above the ground.expect(group.visible).toBe(true);
  renderer.update(undefined,850,hits);expect(group.visible).toBe(false);
  renderer.reset();renderer.update(enemy,1000,hits);expect(arm.rotation.z).toBe(0);
  renderer.dispose();hits.dispose();
});
