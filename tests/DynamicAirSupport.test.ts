import {expect,it} from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {createAirSupportPlaytest} from '../src/app/TankPlaytest';
import {qaSimulationTuning} from '../src/app/QaStressFixture';
import {defaultRuntimeTuning} from '../src/app/runtimeTuning';
import {readCheckpoint,writeCheckpoint,simulationFromCheckpoint,type SessionCheckpoint} from '../src/app/SessionCheckpoint';
import {CommanderSupportConfigSchema,advanceCommanderSupport,supportBossHpThreshold} from '../src/simulation/commanderSupport';
import type {Simulation} from '../src/simulation/Simulation';
const level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(config),table=[750,750,1200,1600,2000];
function make(count:number,hp:number){
  const sim=createAirSupportPlaytest({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
    catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},config.weapon.rifle.fireRate),s=sim.getState();
  // Lv12 capacity/pressure deliberately differ from the actual number living.
  s.progression={level:12,xp:0};s.squad={count,rifleCounts:[count],rocketCount:0,rifleRemainder:0};
  s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns=Array(count).fill(100);
  s.enemies=[];s.defenseWaves!.nextAtSeconds=1000;s.player.x=0;s.player.selectedLane=2;s.defenseTank!.hp=hp;
  s.defenseTank!.nextAttackAtSeconds=s.defenseTank!.nextFlankAtSeconds=s.defenseTank!.nextGiantAtSeconds=1000;
  sim.restoreState(s);return sim;
}
function step(sim:Simulation,n=1){for(let i=0;i<n;i++)sim.step(1/60,{targetX:sim.getState().player.x},tuning);}
function recover(sim:Simulation){
  const state=sim.getState(),savedConfig=structuredClone(config);savedConfig.catharsis=state.catharsis!.balance;
  const c:SessionCheckpoint={version:1,simulationContract:1,game:'topwar',mode:'defense',savedAt:1,build:'dynamic-support',
    paused:true,hidden:false,reason:'pause',fixture:'air-support',config:savedConfig,level,tuning:defaultRuntimeTuning(savedConfig,level),state};
  let text:string|null=null;const storage={getItem:()=>text,setItem:(_key:string,v:string)=>{text=v;},removeItem:()=>{text=null;}};
  expect(writeCheckpoint(c,storage).ok).toBe(true);const result=readCheckpoint(storage);expect(result.status).toBe('valid');
  if(result.status!=='valid')throw Error('Invalid support checkpoint');return simulationFromCheckpoint(result.checkpoint);
}
it.each([1,2,3,4,5])('uses actual %i living MGs at the inclusive boundary, independently of Lv12 capacity',count=>{
  const threshold=table[count-1],sim=make(count,threshold+1);step(sim);
  expect(sim.getState().commanderSupport!.airstrike!.status).toBe('ready');
  const s=sim.getState();s.defenseTank!.hp=threshold;sim.restoreState(s);step(sim);
  const air=sim.getState().commanderSupport!.airstrike!;expect(air.status).toBe('waiting');expect(air.bombAtSeconds!-air.triggeredAtSeconds!).toBe(7.5);
  expect(supportBossHpThreshold(s.catharsis!.balance.commanderSupport!,count)).toBe(threshold);
});
it('requires an explicit new policy/table and never injects it into historical configurations',()=>{
  const c=structuredClone(config.catharsis!.commanderSupport!);delete c.heavyRaid!.lastStand!.livingMgHpThresholds;
  expect(CommanderSupportConfigSchema.safeParse(c).success).toBe(false);
  c.heavyRaid!.lastStand!.triggerPolicy='bossHpOnly';expect(CommanderSupportConfigSchema.parse(c).heavyRaid!.lastStand).not.toHaveProperty('livingMgHpThresholds');
  delete c.heavyRaid!.lastStand!.triggerPolicy;expect(CommanderSupportConfigSchema.parse(c).heavyRaid!.lastStand).not.toHaveProperty('triggerPolicy');
});
it.each([1,2,3] as const)('requires active Phase 3 without using flank proximity/ETA (phase %i)',phase=>{
  const s=make(5,2001).getState();s.defenseTank!.phase=phase;
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:0,x:-2.8,z:0,archetype:'giant',hp:config.catharsis!.giant.hp}];
  advanceCommanderSupport(s,s.catharsis!.balance.commanderSupport,s.commanderSupport!,0);expect(s.commanderSupport!.airstrike!.status).toBe('ready');
  s.defenseTank!.hp=2000;advanceCommanderSupport(s,s.catharsis!.balance.commanderSupport,s.commanderSupport!,0);
  expect(s.commanderSupport!.airstrike!.status).toBe(phase===3?'waiting':'ready');
});
it('does not count living Rifle soldiers as MGs',()=>{
  const s=make(3,100).getState();s.progression={level:5,xp:0};
  advanceCommanderSupport(s,s.catharsis!.balance.commanderSupport,s.commanderSupport!,0);expect(s.commanderSupport!.airstrike!.status).toBe('ready');
});
it.each(['entering','intro','naval'] as const)('keeps the %s guard for the highest threshold',guard=>{
  const s=make(5,2000).getState();if(guard==='entering')s.defenseTank!.status='entering';
  else if(guard==='intro')s.defenseTank!.startedAtSeconds=s.elapsedSeconds-3;else s.destroyer!.startedAtSeconds=s.elapsedSeconds-3;
  advanceCommanderSupport(s,s.catharsis!.balance.commanderSupport,s.commanderSupport!,0);expect(s.commanderSupport!.airstrike!.status).toBe('ready');
});
it('re-evaluates pre-call casualties and preserves the previous pressure without using it for the threshold',()=>{
  const sim=make(5,2001);let s=sim.getState();
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:4,x:2.8,z:-10,archetype:'heavy',hp:15}];sim.restoreState(s);step(sim);
  s=sim.getState();expect(s.squad.count).toBe(4);expect(s.progression).toEqual({level:11,xp:0,pressure:{level:12,xp:0}});
  s.defenseTank!.hp=2000;sim.restoreState(s);step(sim);expect(sim.getState().commanderSupport!.airstrike!.status).toBe('ready');
  s=sim.getState();s.defenseTank!.hp=1600;sim.restoreState(s);step(sim);expect(sim.getState().commanderSupport!.airstrike!.status).toBe('waiting');
});
it('uses newly earned living MGs before activation and keeps the call latched through later level-ups',()=>{
  const sim=make(4,1700),s=sim.getState();s.progression={level:11,xp:1790};
  const kill=(target:Simulation=sim)=>{const s=target.getState();s.combatStats!.shotsFired++;
    s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z:3,archetype:'heavy',hp:1}];
    s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'machineGun',tier:1,memberIndex:0,lane:2,slopeX:0,x:0,z:2.5,
      speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
    target.restoreState(s);step(target);};
  sim.restoreState(s);step(sim);expect(sim.getState().commanderSupport!.airstrike!.status).toBe('ready');kill();
  expect(sim.getState().squad.count).toBe(5);expect(sim.getState().commanderSupport!.airstrike!.status).toBe('waiting');
  const after=make(3,1200),p=after.getState();p.progression={level:10,xp:899};after.restoreState(p);step(after);
  const latched=structuredClone(after.getState().commanderSupport!.airstrike!);kill(after);
  expect(after.getState().squad.count).toBe(4);expect(after.getState().progression!.level).toBe(11);
  expect(after.getState().commanderSupport!.airstrike).toEqual(latched);
});
it('latches the call/deadline through later casualties and restores deterministically without replaying events',()=>{
  const sim=make(5,2000);step(sim);const air=structuredClone(sim.getState().commanderSupport!.airstrike!);
  const s=sim.getState();s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:4,x:2.8,z:-10,archetype:'heavy',hp:15}];sim.restoreState(s);step(sim);
  expect(sim.getState().squad.count).toBe(4);expect(sim.getState().commanderSupport!.airstrike).toEqual(air);
  const copy=recover(sim);expect(copy.consumeSupportEvents()).toEqual([]);step(sim,650);step(copy,650);
  expect(copy.getState()).toEqual(sim.getState());expect(copy.consumeSupportEvents()).toEqual(sim.consumeSupportEvents());
  expect(copy.getState().commanderSupport!.airstrike!.strikesCompleted).toBe(6);step(copy,10);expect(copy.consumeSupportEvents()).toEqual([]);
});
it.each(['bossHpOnly',undefined] as const)('preserves embedded historical %s behavior through ready/waiting/completed/cancelled checkpoints',policy=>{
  for(const count of [2,5]){
    const sim=make(count,1200),s=sim.getState(),last=s.catharsis!.balance.commanderSupport!.heavyRaid!.lastStand!;
    delete last.livingMgHpThresholds;if(policy)last.triggerPolicy=policy;else delete last.triggerPolicy;
    s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:0,x:-2.8,z:10,archetype:'heavy',hp:15,bossFlankSpeedUnitsPerSecond:2}];sim.restoreState(s);
    const ready=recover(sim);step(ready);expect(ready.getState().commanderSupport!.airstrike!.status).toBe(policy?'ready':'waiting');
    const at=ready.getState();at.enemies=[];at.defenseTank!.hp=750;ready.restoreState(at);step(ready);
    const waiting=recover(ready);expect(waiting.getState()).toEqual(ready.getState());step(waiting,650);expect(waiting.getState().commanderSupport!.airstrike!.status).toBe('completed');
    expect(recover(waiting).getState()).toEqual(waiting.getState());
    const cancelled=ready.getState();cancelled.commanderSupport!.airstrike!.status='cancelled';ready.restoreState(cancelled);
    const copy=recover(ready);step(copy,650);expect(copy.getState().commanderSupport!.airstrike!.status).toBe('cancelled');
    expect(copy.getState().catharsis!.balance.commanderSupport!.heavyRaid!.lastStand!.triggerPolicy).toBe(policy);
    expect(copy.getState().catharsis!.balance.commanderSupport!.heavyRaid!.lastStand).not.toHaveProperty('livingMgHpThresholds');
  }
});
