import { expect, it } from 'vitest';
import { survivalSimulation as currentSimulation, type SurvivalScenario } from '../scripts/qa/survivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { effectivePrimaryFireRate, progressionStage } from '../src/simulation/progression';
import { createDevReviewFixture } from './helpers/ReviewFixtures';
import oldSaves from './fixtures/old-survival.json';
import data from './fixtures/pre-b6b4-game.json';
import { GameConfigSchema } from '../src/config/configSchema';
const survivalSimulation = (seed: number, scenario: SurvivalScenario) => currentSimulation(seed, scenario, GameConfigSchema.parse(data));

it.each([6,7,8,9,10])('preserves a same-tick casualty at MG Lv%i while applying only the earned delta', level => {
  const sim=survivalSimulation(17,'lv10'),s=sim.getState(),balance=s.catharsis!.balance;
  const count=progressionStage(level,balance.progression).squadStage;
  s.progression={level,xp:level===10?0:balance.progression.xpRequirements[level-1]-1};
  s.squad={count,rifleCounts:[count],rifleRemainder:0,rocketCount:0};
  s.weapons.rifleCooldownRemainingSeconds=.025;
  s.weapons.rifleMemberCooldowns=Array.from({length:count},(_,i)=>.025+i*.004);
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,archetype:'grunt',lane:2,x:0,z:3,hp:1},
    {id:s.enemyStream!.nextEnemyId++,tier:1,archetype:'grunt',lane:0,x:-2.8,z:-2,hp:1}];
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'machineGun',tier:1,memberIndex:0,lane:2,
    slopeX:0,x:0,z:2.5,speed:60,damage:GameConfigSchema.parse(data).tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},pilotTuning);
  const after=sim.getState(),next=Math.min(level+1,10),delta=progressionStage(next,balance.progression).squadStage-count;
  expect(after.progression).toEqual({level:next,xp:0});
  expect(after.squad.count).toBe(count===1?0:count-1+delta);
  expect(after.weapons.rifleMemberCooldowns).toHaveLength(after.squad.count);
  if(count>1)expect(after.weapons.rifleMemberCooldowns![0]).toBeCloseTo(s.weapons.rifleMemberCooldowns![1]-1/60);
  expect(sim.consumePresentationEvents()).toHaveLength(1);
  const replay=survivalSimulation(17,'lv10');replay.restoreState(JSON.parse(JSON.stringify(after)));
  for(let i=0;i<120;i++){sim.step(1/60,{targetX:0},pilotTuning);replay.step(1/60,{targetX:0},pilotTuning);}
  expect(sim.getState()).toEqual(replay.getState());
});

it('honors authored MG stage multipliers and shortens pending clocks on a live rate edit without recruiting',()=>{
  const sim=survivalSimulation(17,'lv7'),s=sim.getState();
  s.weapons.rifleCooldownRemainingSeconds=.1;s.weapons.rifleMemberCooldowns=[.1];sim.restoreState(s);
  const balance=structuredClone(s.catharsis!.balance);balance.progression.fireRateMultipliers=[1,1.3,1.6];
  sim.setCatharsisBalance(balance);
  expect(effectivePrimaryFireRate(3,7,balance)).toBeCloseTo(23.4);
  expect(effectivePrimaryFireRate(3,8,balance)).toBeCloseTo(28.8);
  expect(sim.getState().squad.count).toBe(1);
  expect(sim.getState().weapons.rifleMemberCooldowns![0]).toBeCloseTo(1/23.4);
});

it('retains the historical MG base rate when old Rifle multipliers were customized',()=>{
  const balance=GameConfigSchema.parse({...data,catharsis:oldSaves[0].catharsis!.balance}).catharsis!;
  balance.progression.fireRateMultipliers=[1.1,1.3,1.6];
  for(const level of [6,7,8])expect(effectivePrimaryFireRate(3,level,balance)).toBe(balance.machineGun.fireRate);
});

it('keeps three distinct shot phases when a live XP edit skips both MG rate and squad stages',()=>{
  const sim=survivalSimulation(17,'lv6'),s=sim.getState();s.progression!.xp=199;
  s.weapons.rifleCooldownRemainingSeconds=1/18;s.weapons.rifleMemberCooldowns=[1/18];sim.restoreState(s);
  const balance=structuredClone(s.catharsis!.balance);
  balance.progression.xpRequirements=[28,60,110,180,220,10,10,10,10];sim.setCatharsisBalance(balance);
  const after=sim.getState();expect(after.progression).toEqual({level:10,xp:0});expect(after.squad.count).toBe(3);
  expect(new Set(after.weapons.rifleMemberCooldowns).size).toBe(3);
  expect(after.weapons.rifleMemberCooldowns!.every(clock=>clock<=1/27)).toBe(true);
});

it.each(oldSaves)('restores an actual eight-level save without reinterpreting its plan, firepower or schedules',save=>{
  const sim=survivalSimulation(17,'lv10');sim.restoreState(JSON.parse(JSON.stringify(save)));
  expect(sim.getState()).toEqual(save);
  const s=sim.getState(),b=s.catharsis!.balance;
  expect(b.progression.levelPlan).toHaveLength(8);
  expect(progressionStage(8,b.progression)).toEqual({weaponFamily:'machineGun',fireRateStage:1,squadStage:3});
  expect(effectivePrimaryFireRate(3,8,b)).toBe(18);
  const clone=survivalSimulation(17,'lv10');clone.restoreState(s);
  for(let i=0;i<600;i++){sim.step(1/60,{targetX:0},pilotTuning);clone.step(1/60,{targetX:0},pilotTuning);}
  expect(sim.getState()).toEqual(clone.getState());expect(sim.getState().catharsis).toEqual(s.catharsis);
});

it('retains a three-MG crate QA path at the authored cap without adding a human control',()=>{
  const s=survivalSimulation(17,'lv10').getState();
  const sim=createDevReviewFixture({seed:17,level:{id:'crate',length:1000,enemyGroups:[],upgradeGates:[]},
    startSquad:1,startRocketCount:0,tiers:GameConfigSchema.parse(data).tiers,catharsis:s.catharsis},3,'crate10');
  expect(sim.getState().progression).toEqual({level:10,xp:0});expect(sim.getState().squad.count).toBe(3);
  expect(sim.getState().weapons.rifleMemberCooldowns).toEqual([0,1/81,2/81]);
});

it('preserves historical overflow shot phases even when a saved pending clock exceeds one period',()=>{
  const sim=survivalSimulation(17,'lv10'),s=JSON.parse(JSON.stringify(oldSaves[0]));
  s.progression={level:6,xp:0};s.squad={count:1,rifleCounts:[1],rifleRemainder:0,rocketCount:0};
  s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000];
  s.catharsis.balance.progression.gruntKillXp=500;
  s.enemies=[{id:s.enemyStream.nextEnemyId++,tier:1,archetype:'grunt',lane:2,x:0,z:3,hp:1}];
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'machineGun',tier:1,memberIndex:0,lane:2,
    slopeX:0,x:0,z:2.5,speed:60,damage:GameConfigSchema.parse(data).tiers.tier1Power,
    remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},pilotTuning);
  const after=sim.getState();expect(after.progression).toEqual({level:8,xp:0});expect(after.squad.count).toBe(3);
  [1/18,1/36,1/72].forEach((clock,i)=>expect(after.weapons.rifleMemberCooldowns![i]).toBeCloseTo(clock));
});
