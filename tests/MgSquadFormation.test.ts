import {expect,it} from 'vitest';
import * as THREE from 'three';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {createTankPlaytest} from '../src/app/TankPlaytest';
import {qaSimulationTuning} from '../src/app/QaStressFixture';
import {createDefenseSquadFormation,createSquadFormation,defenseSquadInwardShift} from '../src/simulation/squad/formation';
import {createChibiPlayerFamily} from '../src/rendering/squad/ChibiPlayerFamily';
import {SquadRenderer} from '../src/rendering/squad/SquadRenderer';
import {projectRenderState} from '../src/app/projectRenderState';
import {VictoryCelebration} from '../src/presentation/VictoryCelebration';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';
const curve=config.catharsis!.progression,level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(config);
function make(count:number){
  const sim=createTankPlaytest({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
    catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},config.weapon.rifle.fireRate,false);
  const s=sim.getState();s.progression={level:count+7,xp:0};s.squad={count,rifleCounts:[count],rocketCount:0,rifleRemainder:0};
  s.enemies=[];s.weapons.rifleMemberCooldowns=Array(count).fill(0);s.weapons.rifleCooldownRemainingSeconds=0;
  s.defenseWaves!.nextAtSeconds=1000;
  s.defenseTank!.nextAttackAtSeconds=s.defenseTank!.nextFlankAtSeconds=s.defenseTank!.nextGiantAtSeconds=1000;
  sim.restoreState(s);return sim;
}
it('authors only four/five-member MG layouts, preserving all accepted smaller layouts and generic fallback',()=>{
  expect(createDefenseSquadFormation(1,.45,curve)).toEqual([{x:0,z:0}]);
  expect(createDefenseSquadFormation(2,.45,curve)).toEqual([{x:-.36,z:.09},{x:.36,z:-.09}]);
  expect(createDefenseSquadFormation(3,.45,curve)).toEqual([{x:-.36,z:.36},{x:0,z:-.72},{x:.36,z:.36}]);
  for(const count of [0,6])expect(createDefenseSquadFormation(count,.45,curve)).toEqual(createSquadFormation(count,.45));
  for(const count of [4,5]){
    const offsets=createDefenseSquadFormation(count,.45,curve),old=createSquadFormation(count,.45);
    expect(new Set(offsets.map(p=>p.x)).size).toBe(count);expect(new Set(offsets.map(p=>p.z)).size).toBeGreaterThan(1);
    const width=(p:{x:number}[])=>Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x));
    expect(width(offsets)).toBeGreaterThan(width(old));expect(width(offsets)).toBeLessThan(1.4);
  }
});
it.each([4,5])('shares all %i MG soldier, projectile and Victory firing anchors without changing independent cadence or saved state',count=>{
  const sim=make(count),before=sim.getState(),offsets=createDefenseSquadFormation(count,.45,curve);
  sim.step(1/60,{targetX:0},tuning);const s=sim.getState();
  expect(s.projectiles).toHaveLength(count);expect(s.combatStats!.shotsFired).toBe(count);
  expect(s.rngState).toBe(before.rngState);expect(s.squad).toEqual(before.squad);
  const frame=projectRenderState(s,{catharsis:s.catharsis,formationSpacing:.45,trackHalfWidth:3.2,defenseLineOffset:1.5});
  const scene=new THREE.Scene(),family=createChibiPlayerFamily(),renderer=new SquadRenderer(scene,family),positions:THREE.Vector3[]=[];
  renderer.update(frame,0);renderer.update(frame,3000);renderer.forEachVisibleMemberPosition(p=>positions.push(p.clone()));
  expect(positions).toHaveLength(count);
  for(const p of s.projectiles){const i=p.memberIndex!;expect(p.x).toBeCloseTo(offsets[i].x);expect(p.z-p.speed/60).toBeCloseTo(offsets[i].z);
    expect(positions[i].x).toBeCloseTo(-p.x);expect(positions[i].z).toBeCloseTo(offsets[i].z);expect(p.lane).toBe(2);expect(p.damage).toBe(config.tiers.tier1Power);}
  const clone=make(count);clone.restoreState(s);for(let i=0;i<50;i++){sim.step(1/60,{targetX:0},tuning);clone.step(1/60,{targetX:0},tuning);}expect(clone.getState()).toEqual(sim.getState());
  const celebration=new VictoryCelebration(before,0,{formationSpacing:.45,fireRate:config.weapon.rifle.fireRate,bulletSpeed:60,bulletRange:80},[]);
  celebration.update(1000/60,false,false,false);expect(celebration.projectiles).toHaveLength(count);
  for(const p of celebration.projectiles){expect(p.x).toBeCloseTo(offsets[p.memberIndex!].x);expect(p.z-p.speed/60).toBeCloseTo(offsets[p.memberIndex!].z);}
  renderer.dispose();family.dispose();
});
it.each([3,12,30])('keeps selected-lane aim and collision at %i units despite the wider physical origins',z=>{
  const sim=make(5),s=sim.getState();s.enemies=[
    {id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z,archetype:'heavy',hp:15},
    {id:s.enemyStream!.nextEnemyId++,tier:1,lane:3,x:1.4,z,archetype:'heavy',hp:15}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);const next=sim.getState();
  for(const p of next.projectiles){expect(p.lane).toBe(2);const target=next.enemies[0];expect(p.x+p.slopeX!*(target.z-p.z)).toBeCloseTo(target.x);}
  for(let i=0;i<45;i++)sim.step(1/60,{targetX:0},tuning);
  const after=sim.getState();expect(after.enemies.find(e=>e.lane===3)!.hp).toBe(15);expect(after.combatStats!.heavyKills).toBe(1);
});
it('reforms five to four to three after real casualties, preserving survivor cooldowns and historical three-member anchors',()=>{
  const sim=make(5),family=createChibiPlayerFamily(),scene=new THREE.Scene(),renderer=new SquadRenderer(scene,family);
  for(const expected of [4,3]){
    const before=sim.getState();before.enemies=[{id:before.enemyStream!.nextEnemyId++,tier:1,lane:4,x:2.8,z:-10,archetype:'heavy',hp:15}];
    before.weapons.rifleCooldownRemainingSeconds=.03;before.weapons.rifleMemberCooldowns=Array.from({length:before.squad.count},(_,i)=>.03+i*.001);
    sim.restoreState(before);sim.step(1/60,{targetX:0},tuning);const s=sim.getState();
    expect(s.squad.count).toBe(expected);expect(s.progression!.level).toBe(expected+7);expect(s.progression!.xp).toBe(0);
    expect(s.progression!.pressure).toEqual({level:12,xp:0});
    expect(s.weapons.rifleMemberCooldowns).toEqual(before.weapons.rifleMemberCooldowns.slice(1).map(t=>t-1/60));
    const frame=projectRenderState(s,{catharsis:s.catharsis,formationSpacing:.45,trackHalfWidth:3.2,defenseLineOffset:1.5});
    renderer.update(frame,3000);const anchors:THREE.Vector3[]=[];renderer.forEachVisibleMemberPosition(p=>anchors.push(p.clone()));
    const offsets=createDefenseSquadFormation(expected,.45,curve);expect(anchors).toHaveLength(expected);
    anchors.forEach((p,i)=>{expect(p.x).toBeCloseTo(-offsets[i].x);expect(p.z).toBeCloseTo(offsets[i].z);});
    sim.restoreState(s);expect(sim.getState()).toEqual(s);
  }
  renderer.dispose();family.dispose();
});
it.each([-2.8,0,2.8])('uses the shared large-MG casualty anchor even before the first soldier draw at X=%i',playerX=>{
  const sim=make(5),s=sim.getState(),family=createChibiPlayerFamily(),scene=new THREE.Scene(),renderer=new SquadRenderer(scene,family);
  renderer.present([{kind:'normalEnemyContact',enemyId:1,enemyTier:1,attackerX:0,attackerZ:0,playerX,playerZ:0,
    before:s.squad,after:{...s.squad,count:4,rifleCounts:[4]},affectedMembers:[{index:4,tier:1,rocket:false}]}],1000,3.2,.45,curve);
  const body=scene.getObjectByName('player-casualty')!,offset=createDefenseSquadFormation(5,.45,curve,playerX,2.8)[4];
  expect(body.position.x).toBeCloseTo(-(playerX+offset.x));expect(body.position.z).toBeCloseTo(offset.z);
  renderer.dispose();family.dispose();
});
it.each([4,5])('translates all %i anchors rigidly with a continuous eased edge correction and unchanged center lanes',count=>{
  const base=createDefenseSquadFormation(count,.45,curve),radius=base.at(-1)!.x;
  for(const playerX of [-1.4,0,1.4])expect(createDefenseSquadFormation(count,.45,curve,playerX,2.8)).toEqual(base);
  let prior=-Infinity;
  for(let step=0;step<=560;step++){
    const x=-2.8+step*.01,offsets=createDefenseSquadFormation(count,.45,curve,x,2.8),shift=defenseSquadInwardShift(count,curve,x,2.8);
    offsets.forEach((p,i)=>{expect(p.x-base[i].x).toBeCloseTo(shift);expect(p.z).toBe(base[i].z);expect(Math.abs(x+p.x)).toBeLessThanOrEqual(2.1500001);});
    const center=x+shift;expect(center).toBeGreaterThanOrEqual(prior-1e-10);if(Number.isFinite(prior))expect(center-prior).toBeLessThanOrEqual(.0100001);prior=center;
  }
  for(const x of [2.15-radius-.1,2.15-radius+.1]){
    const d=.00001,f=(x:number)=>defenseSquadInwardShift(count,curve,x,2.8);
    expect((f(x+d)-f(x))/d).toBeCloseTo((f(x)-f(x-d))/d,3);
  }
  for(const smaller of [1,2,3])for(const x of [-2.8,2.8])expect(createDefenseSquadFormation(smaller,.45,curve,x,2.8)).toEqual(createDefenseSquadFormation(smaller,.45,curve));
});
it.each([350,390])('keeps complete four/five MG silhouettes inside Camera B at every lane and during transitions at %ipx',width=>{
  const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
  for(const count of [4,5]){
    const sim=make(count),s=sim.getState(),scene=new THREE.Scene(),family=createChibiPlayerFamily(),renderer=new SquadRenderer(scene,family);
    const base=projectRenderState(s,{catharsis:s.catharsis,formationSpacing:.45,trackHalfWidth:3.2,defenseLineOffset:1.5});
    for(let step=0;step<=28;step++){
      const x=-2.8+step*.2,frame={...base,player:{...base.player,x}};
      renderer.update(frame,step*200);scene.updateMatrixWorld(true);
      const groups=scene.children.filter(p=>p instanceof THREE.Group&&p.visible&&p.getObjectByName('toy-soldier-helmet'));
      expect(groups).toHaveLength(count);
      for(const group of groups){const box=new THREE.Box3().setFromObject(group);
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
          const p=new THREE.Vector3(x,y,z).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(p.y).toBeGreaterThan(-.72);expect(p.y).toBeLessThan(1);
        }
      }
    }
    renderer.dispose();family.dispose();
  }
});
it.each([0,1,2,3,4])('keeps actual shifted bullet/renderer/Victory anchors aligned without changing physical lane %i',lane=>{
  const sim=make(5),s=sim.getState(),playerX=(lane-2)*1.4;
  s.player.x=playerX;s.player.selectedLane=lane;sim.restoreState(s);sim.step(1/60,{targetX:playerX},tuning);
  const next=sim.getState(),offsets=createDefenseSquadFormation(5,.45,curve,playerX,2.8);
  expect(next.player.x).toBeCloseTo(playerX);expect(next.player.selectedLane).toBe(lane);
  for(const p of next.projectiles){expect(p.x).toBeCloseTo(playerX+offsets[p.memberIndex!].x);expect(p.lane).toBe(lane);}
  const celebration=new VictoryCelebration(s,0,{formationSpacing:.45,fireRate:config.weapon.rifle.fireRate,bulletSpeed:60,bulletRange:80},[]);
  celebration.update(1000/60,false,false,false);
  for(const p of celebration.projectiles)expect(p.x).toBeCloseTo(playerX+offsets[p.memberIndex!].x);
});
it.each([-1,1])('tests contacts at the shifted physical body, with no invisible body left at its old edge (side %i)',side=>{
  for(const shifted of [false,true]){
    const sim=make(5),s=sim.getState(),x=side*2.8;
    s.player.x=x;s.player.selectedLane=side<0?0:4;s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns!.fill(100);
    const offsets=createDefenseSquadFormation(5,.45,curve,shifted?x:0,2.8),index=side<0?0:4,body=offsets[index];
    s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:s.player.selectedLane,x:x+body.x,z:body.z,archetype:'heavy',hp:15}];
    sim.restoreState(s);sim.step(1/60,{targetX:x},tuning);
    expect(sim.getState().squad.count).toBe(shifted?4:5);
  }
});
it('sweeps only the real group path while entering the edge bound and restores that transition deterministically',()=>{
  const sim=make(5),s=sim.getState();s.player.x=1.4;s.player.selectedLane=4;
  s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns!.fill(100);
  // Applying the end shift at the start would sweep a nonexistent soldier through here.
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:.1,z:.72,archetype:'heavy',hp:15}];
  sim.restoreState(s);const copy=make(5);copy.restoreState(s);
  for(const target of [sim,copy])target.step(.3,{targetX:2.8},tuning);
  expect(sim.getState()).toEqual(copy.getState());expect(sim.getState().squad.count).toBe(5);
  const next=sim.getState();expect(next.player.x).toBeCloseTo(2.8);expect(next.enemies).toHaveLength(1);
});
it.each([-1,1])('retains selected outer-lane hits at close/far range with inward-shifted origins (side %i)',side=>{
  for(const z of [3,12,30]){
    const sim=make(5),s=sim.getState(),lane=side<0?0:4,x=side*2.8;
    s.player.x=x;s.player.selectedLane=lane;s.enemies=[
      {id:s.enemyStream!.nextEnemyId++,tier:1,lane,x,z,archetype:'heavy',hp:15},
      {id:s.enemyStream!.nextEnemyId++,tier:1,lane:lane-side,x:side*1.4,z,archetype:'heavy',hp:15}];
    sim.restoreState(s);sim.step(1/60,{targetX:x},tuning);const next=sim.getState();
    for(const p of next.projectiles){expect(p.lane).toBe(lane);const enemy=next.enemies[0];expect(p.x+p.slopeX!*(enemy.z-p.z)).toBeCloseTo(x);}
    for(let i=0;i<45;i++)sim.step(1/60,{targetX:x},tuning);
    expect(sim.getState().enemies.find(e=>e.lane!==lane)!.hp).toBe(15);expect(sim.getState().combatStats!.heavyKills).toBe(1);
  }
});
