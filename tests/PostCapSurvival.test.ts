import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { emptyGrenade } from '../src/simulation/grenade';
import { advancePostCapSurvival, emptyPostCapSurvival } from '../src/simulation/postCapSurvival';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';

const config=GameConfigSchema.parse(data),balance=config.catharsis!;
const make=(enabled=true)=>new Simulation({seed:17,level:LevelDefinitionSchema.parse(levelData),startSquad:1,
  startRocketCount:0,tiers:config.tiers,catharsis:{trackHalfWidth:3.2,balance:{...balance,
    carnival:{...balance.carnival,enabled:false}, // Exercise the independently retained fallback.
    postCapSurvival:{...balance.postCapSurvival,enabled}}}});
const held=(inventory=0)=>({...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory});
const ticks=(sim:Simulation,count:number)=>{for(let i=0;i<count;i++)sim.step(1/60,{targetX:0},pilotTuning);};
function capped(enabled=true) {
  const sim=make(enabled),s=sim.getState();s.progression={level:6,xp:0};s.enemies=[];
  s.giantEncounter={scheduledAtSeconds:0,spawned:true};s.grenade=held();
  s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;
  sim.restoreState(s);ticks(sim,1);return sim;
}
function frame() {
  const s=capped().getState();s.enemies=[];return s;
}
function advance(s:ReturnType<typeof frame>,now:number) {
  s.elapsedSeconds=now;s.postCapSurvival=advancePostCapSurvival(s.postCapSurvival,s);return s;
}

it('authors an optional narrow layer and validates one Heavy per front',()=>{
  expect(balance.postCapSurvival).toEqual({enabled:true,startLevel:6,ordinaryGroupSize:3,pressureLaneCount:3,
    heavyCount:3,giantIntervalSeconds:24,maxSimultaneousGiants:1,grenadeSupplyIntervalSeconds:30,grenadeSupplyAmount:1});
  const legacy=structuredClone(data) as any;delete legacy.catharsis.postCapSurvival;
  expect(GameConfigSchema.parse(legacy).catharsis!.postCapSurvival.enabled).toBe(false);
  for(const patch of [{ordinaryGroupSize:4},{heavyCount:2},{pressureLaneCount:6,heavyCount:6,ordinaryGroupSize:6},
    {giantIntervalSeconds:0},{grenadeSupplyAmount:3},{maxSimultaneousGiants:2}]) {
    const bad=structuredClone(data);Object.assign(bad.catharsis.postCapSurvival,patch);
    expect(()=>GameConfigSchema.parse(bad)).toThrow();
  }
});

it('does not change pre-cap enemies, weapons, squad, XP or Supply timing',()=>{
  const on=make(),off=make(false);
  for(let t=0;t<60*32;t++) {
    ticks(on,1);ticks(off,1);
    if(t%60===0) {
      const a=on.getState(),b=off.getState();
      for(const key of ['enemies','player','squad','projectiles','weapons','progression','grenade','giantEncounter','enemyStream'] as const)
        expect(a[key]).toEqual(b[key]);
      expect(a.postCapSurvival).toEqual(emptyPostCapSurvival());
    }
  }
});

it.each([true,false])('preserves the one-time 60-person release with enabled=%s',enabled=>{
  const sim=capped(enabled),s=sim.getState();
  expect(s.enemies).toHaveLength(60);expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(1);
  expect(new Set(s.enemies.map(e=>e.lane)).size).toBe(3);
  expect(s.machineGunReleaseAtSeconds).toBe(s.elapsedSeconds);
  expect(s.postCapSurvival!.startedAtSeconds).toBe(enabled?s.elapsedSeconds:null);
  const release=s.machineGunReleaseAtSeconds;ticks(sim,600);
  expect(sim.getState().machineGunReleaseAtSeconds).toBe(release);
});

it.each([true,false])('uses only three Heavies after activation, or retained capped groups when disabled (%s)',enabled=>{
  const sim=capped(enabled),s=sim.getState();let nextId=s.enemyStream!.nextEnemyId;
  const admissions:number[]=[];
  for(let t=0;t<60*20;t++) {
    ticks(sim,1);const now=sim.getFrameState();
    if(now.enemyStream!.nextEnemyId===nextId)continue;
    const group=now.enemies.filter(e=>e.id>=nextId);
    expect(group).toHaveLength(enabled?3:60);
    expect(group.filter(e=>e.archetype==='heavy')).toHaveLength(enabled?3:1);
    expect(group.filter(e=>e.archetype==='grunt')).toHaveLength(enabled?0:59);
    expect(new Set(group.map(e=>e.lane)).size).toBe(3);
    if(enabled)expect(group.every(e=>e.hp===15)).toBe(true);
    admissions.push(now.elapsedSeconds);nextId=now.enemyStream!.nextEnemyId;
  }
  expect(admissions.length).toBeGreaterThanOrEqual(2);
  expect(admissions[1]-admissions[0]).toBeCloseTo(6);
});

it('uses one activation clock and skips occupied Giant slots without death-triggered catch-up',()=>{
  const s=frame(),start=s.postCapSurvival!.startedAtSeconds!;
  advance(s,start+24-1e-6);expect(s.enemies).toHaveLength(0);
  advance(s,start+24);expect(s.enemies.filter(e=>e.archetype==='giant')).toHaveLength(1);
  const giant=s.enemies[0];expect(giant.hp).toBe(172);expect(giant.lane).toBeGreaterThan(0);expect(giant.lane).toBeLessThan(4);
  advance(s,start+48);expect(s.enemies).toEqual([giant]);expect(s.postCapSurvival!.nextGiantAtSeconds).toBeCloseTo(start+72);
  s.enemies=[];advance(s,start+49);expect(s.enemies).toHaveLength(0);
  advance(s,start+72);expect(s.enemies).toHaveLength(1);
  advance(s,start+240);expect(s.enemies).toHaveLength(1);
  expect(s.postCapSurvival!.nextGiantAtSeconds).toBeCloseTo(start+264);
});

it('counts a surviving Lv5 Giant toward the recurring cap',()=>{
  const s=frame(),start=s.postCapSurvival!.startedAtSeconds!;
  s.enemies=[{id:1,tier:1,archetype:'giant',lane:1,x:-1.4,z:30,hp:80}];
  advance(s,start+24);expect(s.enemies).toHaveLength(1);expect(s.enemies[0].hp).toBe(80);
});

it('skips full-inventory and uncollected Supply slots; spending does not bank a missed crate',()=>{
  const s=frame(),start=s.postCapSurvival!.startedAtSeconds!;s.grenade!.inventory=3;
  advance(s,start+30);expect(s.grenade!.supply).toBeNull();expect(s.postCapSurvival!.nextGrenadeSupplyAtSeconds).toBeCloseTo(start+60);
  s.grenade!.inventory=2;advance(s,start+31);expect(s.grenade!.supply).toBeNull();
  advance(s,start+60);const supply=structuredClone(s.grenade!.supply);
  expect(supply!.rewardAmount).toBe(1);expect(s.grenade!.inventory).toBe(2);
  advance(s,start+90);expect(s.grenade!.supply).toEqual(supply);
  s.grenade!.supply=null;advance(s,start+91);expect(s.grenade!.supply).toBeNull();
  advance(s,start+120);expect(s.grenade!.supply).not.toBeNull();
  expect(s.postCapSurvival!.nextGrenadeSupplyAtSeconds).toBeCloseTo(start+150);
});

it('never overwrites the uncollected teaching Supply',()=>{
  const s=frame(),start=s.postCapSurvival!.startedAtSeconds!;
  s.grenade={...held(),acquiredAtSeconds:null,supply:{lane:2,x:0,depth:8}};
  advance(s,start+30);expect(s.grenade.supply).toEqual({lane:2,x:0,depth:8});
});

it.each([0,1,2,3])('one MG hit collects +1 from inventory %s, clamped at three',inventory=>{
  const sim=capped(),s=sim.getState();s.enemies=[];s.enemyStream!.nextRowIndex=10000;
  s.grenade={...held(inventory),supply:{lane:2,x:0,depth:8,rewardAmount:1}};
  s.projectiles=[{id:1,kind:'machineGun',tier:1,lane:2,x:0,z:s.player.z+7.5,slopeX:0,speed:60,
    damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  s.weapons.nextProjectileId=2;sim.restoreState(s);ticks(sim,1);
  expect(sim.getState().grenade!.inventory).toBe(Math.min(3,inventory+1));
  expect(sim.getState().grenade!.supply).toBeNull();expect(sim.getState().progression).toEqual({level:6,xp:0});
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]);
  ticks(sim,1);expect(sim.getState().grenade!.inventory).toBe(Math.min(3,inventory+1));
});

it('allows Supply acquisition to fill reserves while one Grenade is in flight',()=>{
  const sim=capped(),s=sim.getState();s.enemies=[];s.enemyStream!.nextRowIndex=10000;
  s.grenade={...held(2),supply:{lane:2,x:0,depth:8,rewardAmount:1},flight:{startX:0,startZ:0,
    targetX:0,targetZ:40,startedAtSeconds:0,flightSeconds:.65,damageEnemyHp:9,blastRadius:4}};
  s.projectiles=[{id:1,kind:'machineGun',tier:1,lane:2,x:0,z:s.player.z+7.5,slopeX:0,speed:60,
    damage:3,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  s.weapons.nextProjectileId=2;sim.restoreState(s);ticks(sim,1);
  expect(sim.getState().grenade!.inventory).toBe(3);expect(sim.getState().grenade!.flight).not.toBeNull();
  const clone=make();clone.restoreState(sim.getState());expect(clone.getState()).toEqual(sim.getState());
  sim.step(1/60,{targetX:0,throwGrenade:true},pilotTuning);expect(sim.getState().grenade!.inventory).toBe(3);
});

it.each(['pending','supply'] as const)('restores %s schedules and placement deterministically without duplicated admissions',phase=>{
  const sim=capped(),s=sim.getState();s.enemies=[];s.enemyStream!.nextRowIndex=10000;
  sim.restoreState(s);if(phase==='supply')ticks(sim,1800);
  const snapshot=sim.getState(),clone=make();clone.restoreState(JSON.parse(JSON.stringify(snapshot)));
  if(phase==='supply')expect(snapshot.grenade!.supply!.rewardAmount).toBe(1);
  ticks(sim,60*35);ticks(clone,60*35);expect(sim.getState()).toEqual(clone.getState());
  expect(sim.getState().enemies.filter(e=>e.archetype==='giant')).toHaveLength(1);
  expect(sim.getState().grenade!.supply!.rewardAmount).toBe(1);
  snapshot.postCapSurvival!.nextGiantAtSeconds=999;expect(sim.getState().postCapSurvival!.nextGiantAtSeconds).not.toBe(999);
});

it('defaults old snapshots safely and ignores inactive temporary state when disabled',()=>{
  const sim=capped(),old=sim.getState();delete old.postCapSurvival;sim.restoreState(old);
  expect(sim.getState().postCapSurvival).toEqual(emptyPostCapSurvival());
  ticks(sim,1);expect(sim.getState().postCapSurvival!.startedAtSeconds).toBe(sim.getState().elapsedSeconds);
  const disabled=capped(false),stale=disabled.getState();(stale as any).postCapSurvival={obsolete:true};
  disabled.restoreState(stale);expect(disabled.getState().postCapSurvival).toEqual(emptyPostCapSurvival());
  const fresh=make().getState();expect(fresh.postCapSurvival).toEqual(emptyPostCapSurvival());
  expect(fresh.machineGunReleaseAtSeconds).toBeNull();expect(fresh.grenade).toEqual(emptyGrenade());
});

it('rejects corrupt active schedules and migrates an old capped run with no recorded teaching encounter',()=>{
  const sim=capped();
  for(const patch of [{startedAtSeconds:100},{nextGiantAtSeconds:null},{nextGrenadeSupplyAtSeconds:0}]) {
    const s=sim.getState();Object.assign(s.postCapSurvival!,patch);expect(()=>sim.restoreState(s)).toThrow();
  }
  const old=sim.getState();delete old.postCapSurvival;old.grenade=emptyGrenade();sim.restoreState(old);
  ticks(sim,60*31);const restored=make();restored.restoreState(sim.getState());
  expect(restored.getState()).toEqual(sim.getState());
  expect(sim.getState().grenade!.supply!.rewardAmount).toBeUndefined(); // Original teaching crate, not overwritten.
});

it('advances directly past missed slots without stacking overdue Giants or Supplies',()=>{
  const s=frame(),start=s.postCapSurvival!.startedAtSeconds!;
  advance(s,start+125);
  expect(s.enemies.filter(e=>e.archetype==='giant')).toHaveLength(1);
  expect(s.grenade!.supply!.rewardAmount).toBe(1);
  expect(s.postCapSurvival!.nextGiantAtSeconds).toBeCloseTo(start+144);
  expect(s.postCapSurvival!.nextGrenadeSupplyAtSeconds).toBeCloseTo(start+150);
});

it('disables independently at runtime and leaves fundamental progression/combat values intact',()=>{
  const sim=capped();sim.setCatharsisBalance({...balance,postCapSurvival:{...balance.postCapSurvival,enabled:false}});
  ticks(sim,1);expect(sim.getState().postCapSurvival).toEqual(emptyPostCapSurvival());
  ticks(sim,1800);expect(sim.getState().enemies.some(e=>e.archetype==='giant')).toBe(false);
  expect(sim.getState().grenade!.supply).toBeNull();expect(sim.getState().catharsis!.balance.progression).toEqual(balance.progression);
});

it.each(['evolve','machineGun'] as const)('keeps the isolated %s review free of recurring threats and teaching Supplies',role=>{
  const sim=createDevReviewFixture({seed:17,level:LevelDefinitionSchema.parse(levelData),startSquad:1,
    startRocketCount:0,tiers:config.tiers,catharsis:{balance,trackHalfWidth:3.2}},3,role);
  const s=sim.getState();s.enemies=[];sim.restoreState(s);ticks(sim,60*35);
  expect(sim.getState().grenade).toEqual(emptyGrenade());
  expect(sim.getState().postCapSurvival).toEqual(emptyPostCapSurvival());
  expect(sim.getState().enemies).toHaveLength(0);
});

it('retains Lv6 XP toward new MG stages without legacy reinforcement/landing assault',()=>{
  const sim=capped(),s=sim.getState();s.enemies=[{id:1,tier:1,archetype:'heavy',lane:2,x:0,z:3,hp:1}];
  s.enemyStream!.nextRowIndex=10000;s.enemyStream!.nextEnemyId=2;
  s.weapons.rifleMemberCooldowns=[0];s.weapons.rifleCooldownRemainingSeconds=0;sim.restoreState(s);ticks(sim,60);
  expect(sim.getState().enemies).toHaveLength(0);expect(sim.getState().progression).toEqual({level:6,xp:10});
  expect(sim.getState().reinforcement).toEqual({startedAtSeconds:null,arrived:false});
  expect(sim.getState().landingAssault!.startedAtSeconds).toBeNull();
});
