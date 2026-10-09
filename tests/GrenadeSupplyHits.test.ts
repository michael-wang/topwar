import { expect, it } from 'vitest';
import { Simulation } from '../src/simulation/Simulation';
import { emptyGrenade, placeGrenadeSupply } from '../src/simulation/grenade';
import { carnivalOptions } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { GrenadeConfigSchema } from '../src/config/grenadeConfig';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';

const make=()=>new Simulation({...carnivalOptions,level:{id:'supply',length:100,enemyGroups:[],upgradeGates:[]}});
function supplyRun(kind:'rifle'|'machineGun'='rifle',inventory=0,recurring=false,hitsRequired=10) {
  const sim=make(),s=sim.getState();s.progression={level:kind==='rifle'?3:6,xp:0};
  const config={...s.catharsis!.balance.grenade,supplyHitsRequired:hitsRequired,supplyDestruction:undefined};
  s.catharsis!.balance.grenade=config;
  s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,
    acquiredAtSeconds:recurring?0:null,inventory,
    supply:{...placeGrenadeSupply(s,config),...(recurring?{rewardAmount:1 as const}:{})}};
  s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000];
  sim.restoreState(s);return sim;
}
function hit(sim:Simulation,kind:'rifle'|'machineGun'='rifle',damage=3,lane=2,count=1) {
  const s=sim.getState(),depth=s.grenade!.supply?.depth??14;
  s.projectiles=Array.from({length:count},()=>({id:s.weapons.nextProjectileId++,kind,tier:1,memberIndex:0,lane,x:0,z:depth-.5,
    slopeX:0,speed:60,damage,remainingRange:20,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}));
  sim.restoreState(s);sim.step(1/60,{targetX:0},pilotTuning);
}

it.each(['rifle','machineGun'] as const)('%s counts ten successful hits regardless of damage, without XP/enemy effects',kind=>{
  const sim=supplyRun(kind),progression=sim.getState().progression;
  for(let n=1;n<=9;n++) {
    hit(sim,kind,999);const s=sim.getState();expect(s.grenade!.supply!.hitProgress).toBe(n);
    expect(s.grenade!.inventory).toBe(0);expect(s.grenade!.acquiredAtSeconds).toBeNull();
    expect(s.projectiles).toEqual([]);expect(s.enemies).toEqual([]);expect(s.progression).toEqual(progression);
    expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeSupplyHit'}]);
  }
  hit(sim,kind);expect(sim.getState().grenade!.inventory).toBe(3);expect(sim.getState().grenade!.supply).toBeNull();
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]);
  hit(sim,kind);expect(sim.consumeGrenadeEvents()).toEqual([]);expect(sim.getState().progression).toEqual(progression);
});

it('restores partial progress and its frozen requirement, and Retry starts fresh',()=>{
  const sim=supplyRun();hit(sim,'rifle',3,2,4);const saved=sim.getState(),clone=make();
  clone.restoreState(JSON.parse(JSON.stringify(saved)));saved.grenade!.supply!.hitProgress=8;
  expect(clone.getState()).toEqual(sim.getState());
  for(const s of [sim,clone])s.setCatharsisBalance({...s.getState().catharsis!.balance,
    grenade:{...s.getState().catharsis!.balance.grenade,supplyHitsRequired:1,
      supplyDestruction:{mode:'staged',recoverySeconds:.7}}});
  for(let i=0;i<5;i++){hit(sim);hit(clone);expect(sim.getState()).toEqual(clone.getState());}
  expect(sim.getState().grenade!.inventory).toBe(0);hit(sim);hit(clone);expect(sim.getState()).toEqual(clone.getState());
  expect(sim.getState().grenade!.inventory).toBe(3);expect(supplyRun().getState().grenade!.supply!.hitProgress).toBe(0);
  expect(make().getState().grenade).toEqual(emptyGrenade());
});

it.each([0,1,2,3])('recurring supply takes ten hits and adds one to inventory %i without exceeding capacity',inventory=>{
  const sim=supplyRun('machineGun',inventory,true);hit(sim,'machineGun',3,2,9);
  expect(sim.getState().grenade!.inventory).toBe(inventory);expect(sim.getState().grenade!.supply!.hitProgress).toBe(9);
  sim.consumeGrenadeEvents();hit(sim,'machineGun',3,2,3);
  expect(sim.getState().grenade!.inventory).toBe(Math.min(3,inventory+1));
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]);
  expect(sim.getState().projectiles).toHaveLength(2);
});

it.each([6,8])('preserves one-hit configurations and old %i-level snapshots without durability fields',max=>{
  const old=supplyRun('rifle',0,false,1);hit(old);expect(old.getState().grenade!.inventory).toBe(3);
  const sim=supplyRun(),s=sim.getState();delete s.grenade!.supply!.hitProgress;delete s.grenade!.supply!.hitsRequired;
  s.catharsis!.balance.progression.levelPlan=s.catharsis!.balance.progression.levelPlan.slice(0,max);
  s.catharsis!.balance.progression.xpRequirements=s.catharsis!.balance.progression.xpRequirements.slice(0,max-1);
  sim.restoreState(JSON.parse(JSON.stringify(s)));hit(sim);expect(sim.getState().grenade!.inventory).toBe(3);
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]);
  expect(CatharsisConfigSchema.parse({...s.catharsis!.balance,grenade:undefined}).grenade.supplyHitsRequired).toBe(1);
});

it('does not count a wrong-lane bullet and preserves ordinary first-obstruction collision',()=>{
  const sim=supplyRun();hit(sim,'rifle',3,1);expect(sim.getState().grenade!.supply!.hitProgress).toBe(0);
  const s=sim.getState();s.enemies=[{id:1,tier:1,archetype:'heavy',hp:15,lane:2,x:0,z:13.6}];sim.restoreState(s);
  hit(sim);expect(sim.getState().grenade!.supply!.hitProgress).toBe(0);expect(sim.getState().enemies[0].hp).toBe(14);
  expect(sim.getState().progression!.xp).toBe(0);
});

it.each(['rifle','machineGun'] as const)('retains ordinary %s firing cadence during supply acquisition',kind=>{
  const sim=supplyRun(kind),s=sim.getState();s.weapons.rifleMemberCooldowns=[0];s.weapons.rifleCooldownRemainingSeconds=0;sim.restoreState(s);
  const times:number[]=[];
  for(let tick=0;tick<300&&sim.getState().grenade!.supply;tick++) {
    sim.step(1/60,{targetX:0},pilotTuning);
    for(const e of sim.consumeGrenadeEvents())if(e.kind==='grenadeSupplyHit'||e.kind==='grenadeAcquired')times.push(sim.getState().elapsedSeconds);
  }
  expect(times).toHaveLength(10);expect(sim.getState().grenade!.inventory).toBe(3);
  expect(times[9]-times[0]).toBeCloseTo(9/(kind==='rifle'?4.5:18),1);
});

it('rejects corrupt progress atomically and validates positive integral config',()=>{
  const sim=supplyRun(),original=sim.getState();
  for(const patch of [{hitProgress:-1},{hitProgress:10},{hitProgress:.5},{hitsRequired:0},{hitsRequired:undefined},{hitProgress:undefined}]) {
    const bad=sim.getState();Object.assign(bad.grenade!.supply!,patch);
    expect(()=>sim.restoreState(bad)).toThrow();expect(sim.getState()).toEqual(original);
  }
  for(const supplyHitsRequired of [0,-1,.5,Infinity,NaN])expect(()=>GrenadeConfigSchema.parse({...original.catharsis!.balance.grenade,supplyHitsRequired})).toThrow();
});
