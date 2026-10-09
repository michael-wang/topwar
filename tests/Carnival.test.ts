import { expect, it } from 'vitest';
import { carnivalEntry, carnivalOptions, carnivalConfig, carnivalPilotLane, runCarnivalPilot } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { Simulation } from '../src/simulation/Simulation';
import { advanceCarnival, emptyCarnival } from '../src/simulation/carnival';
import { GameConfigSchema } from '../src/config/configSchema';
import data from '../public/game-data/game.json';

const step = (sim: Simulation, n = 1) => { for (let i=0;i<n;i++) sim.step(1/60,{targetX:0},pilotTuning); };
const withoutNaval = (sim: Simulation) => { const balance=sim.getState().catharsis!.balance;
  sim.setCatharsisBalance({...balance,destroyer:{...balance.destroyer!,enabled:false}});return sim; };
const roundTrip = (sim: Simulation) => { const clone=carnivalEntry();clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));return clone; };

it('starts CARNIVAL before one unchanged 59-Grunt / one-Heavy release and resets exactly', () => {
  const make=()=>createDevReviewFixture(carnivalOptions,3,'carnival');
  const sim=make(),initial=sim.getState();
  expect(initial.progression).toEqual({level:6,xp:0});expect(initial.enemies).toEqual([]);
  expect(initial.machineGunReleaseAtSeconds).toBeNull();expect(initial.carnival).toEqual(emptyCarnival());
  step(sim);const s=sim.getState();
  expect(s.squad.count).toBe(1);expect(s.enemies).toHaveLength(60);
  expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(1);
  expect(new Set(s.enemies.map(e=>e.lane)).size).toBe(3);
  expect(s.enemies.every(e=>e.z-s.player.z>=38 && e.z-s.player.z<=47)).toBe(true);
  expect(s.carnival).toEqual({status:'active',startedAtSeconds:s.elapsedSeconds,elapsedSeconds:0,nextWaveIndex:0});
  expect(s.postCapSurvival!.startedAtSeconds).toBeNull();
  const old=carnivalEntry();const disabled=old.getState();disabled.catharsis!.balance.carnival.enabled=false;
  old.restoreState(disabled);step(old);
  // Same stream cursor/seed gives byte-for-byte accepted opening geometry/HP.
  const comparable=carnivalEntry();step(comparable);expect(comparable.getState().enemies).toEqual(old.getState().enemies);
  step(sim,180);expect(sim.getState().machineGunReleaseAtSeconds).toBe(s.elapsedSeconds);
  expect(make().getState()).toEqual(initial);
});

it('admits timed alternating Grunt batches, caps active enemies, and consumes blocked slots', () => {
  const sim=carnivalEntry();step(sim);const s=sim.getState(),start=s.elapsedSeconds;
  s.enemies=[];
  const advance=(elapsed:number)=>{s.elapsedSeconds=start+elapsed;s.carnival=advanceCarnival(s.carnival,s,17);};
  advance(1.99);expect(s.enemies).toHaveLength(0);
  advance(2);expect(s.enemies).toHaveLength(36);expect(new Set(s.enemies.map(e=>e.lane))).toEqual(new Set([0,1]));
  expect(s.enemies.every(e=>e.archetype==='grunt' && e.hp===1)).toBe(true);
  s.enemies=[];advance(3.5);expect(new Set(s.enemies.map(e=>e.lane))).toEqual(new Set([3,4]));
  for(const elapsed of [5,6.5,8,9.5])advance(elapsed);
  expect(s.enemies).toHaveLength(80);const id=s.enemyStream!.nextEnemyId;
  advance(11);expect(s.enemyStream!.nextEnemyId).toBe(id);expect(s.carnival!.nextWaveIndex).toBe(7);
  s.enemies=[];advance(11.5);expect(s.enemies).toHaveLength(0);
  advance(20);expect(s.enemies).toHaveLength(36); // At most one opportunity on a large step.
  advance(24);expect(s.carnival!.status).toBe('complete');const end=s.enemyStream!.nextEnemyId;
  advance(50);expect(s.enemyStream!.nextEnemyId).toBe(end);
});

it('keeps authored waves through real Lv7, then hands off once with no queued ordinary waves or Giants', () => {
  const sim=withoutNaval(carnivalEntry(17));let lv7:number|null=null,ordinaryAfter=0;
  for(let tick=0;tick<60*31;tick++) {
    const b=sim.getState();if(tick%12===0){const lane=carnivalPilotLane(b);if(lane!==b.player.selectedLane)sim.stepLane(lane<b.player.selectedLane! ? -1:1);}
    step(sim);const s=sim.getState();
    if(s.progression!.level===7)lv7??=s.carnival!.elapsedSeconds;
    const added=s.enemies.filter(e=>e.id>=b.enemyStream!.nextEnemyId);
    if(s.carnival!.status==='active') {
      expect(s.postCapSurvival!.startedAtSeconds).toBeNull();
      expect(added.some(e=>e.archetype==='giant')).toBe(false);
      if(b.machineGunReleaseAtSeconds!==null)expect(added.every(e=>e.archetype==='grunt')).toBe(true);
    } else if(s.carnival!.status==='complete') {
      expect(s.carnival!.elapsedSeconds).toBe(24);
      expect(s.postCapSurvival!.startedAtSeconds).toBeCloseTo(s.machineGunReleaseAtSeconds!+24);
      if(added.length){ordinaryAfter++;expect(added).toHaveLength(3);expect(added.every(e=>e.archetype==='heavy')).toBe(true);}
    }
    expect(s.reinforcement!.arrived).toBe(false);sim.consumePresentationEvents();
  }
  expect(lv7).toBeGreaterThan(0);expect(lv7).toBeLessThan(20);expect(ordinaryAfter).toBeGreaterThan(0);
});

it.each([0,1,120,121,720,1440,1441,1500])('restores phase/weapon/spawn clocks at tick %i with identical continuation', tick => {
  const sim=carnivalEntry();step(sim,tick);const snapshot=sim.getState(),clone=roundTrip(sim);
  step(sim,240);step(clone,240);expect(clone.getState()).toEqual(sim.getState());
  snapshot.carnival!.nextWaveIndex=999;expect(sim.getState().carnival!.nextWaveIndex).not.toBe(999);
});

it('continues naturally from Carnival through fallback into Lv8 without legacy reinforcement', () => {
  const sim=carnivalEntry(99);
  for(let tick=0;tick<60*90 && sim.getFrameState().progression!.level<8;tick++) {
    const s=sim.getFrameState();if(tick%12===0){const lane=carnivalPilotLane(s);
      if(lane!==s.player.selectedLane)sim.stepLane(lane<s.player.selectedLane! ? -1:1);}
    step(sim);sim.consumePresentationEvents();
  }
  const s=sim.getState();expect(s.progression).toEqual({level:8,xp:0});expect(s.squad.count).toBe(3);
  expect(s.carnival!.status).toBe('complete');expect(s.carnival!.elapsedSeconds).toBe(24);
  expect(s.elapsedSeconds).toBeGreaterThan(24);expect(s.reinforcement!.arrived).toBe(false);
});

it('migrates pre-P2 and six-level snapshots without retroactive Carnival', () => {
  for(const max of [6,8]) {
    const sim=carnivalEntry(),s=sim.getState();delete s.carnival;
    delete (s.catharsis!.balance as Partial<NonNullable<typeof s.catharsis>['balance']>).carnival;
    s.catharsis!.balance.progression.levelPlan=s.catharsis!.balance.progression.levelPlan.slice(0,max);
    s.catharsis!.balance.progression.xpRequirements=s.catharsis!.balance.progression.xpRequirements.slice(0,max-1);
    s.machineGunReleaseAtSeconds=0;sim.restoreState(s);step(sim,180);
    expect(sim.getState().carnival!.status).toBe('skipped');
    expect(sim.getState().postCapSurvival!.startedAtSeconds).not.toBeNull();
    expect(sim.getState().catharsis!.balance.carnival.enabled).toBe(false);
  }
});

it('rejects corrupt phase clocks and simultaneous ownership without mutating the simulation', () => {
  const sim=carnivalEntry();step(sim,181);const initial=sim.getState();
  for(const patch of [{status:'pending'},{elapsedSeconds:99},{startedAtSeconds:99},{nextWaveIndex:-1},{extra:true}]) {
    const s=sim.getState();Object.assign(s.carnival!,patch);expect(()=>sim.restoreState(s)).toThrow();expect(sim.getState()).toEqual(initial);
  }
  const s=sim.getState();s.postCapSurvival={startedAtSeconds:0,nextGiantAtSeconds:24,nextGrenadeSupplyAtSeconds:30};
  expect(()=>sim.restoreState(s)).toThrow('cannot own spawning together');
});

it('can disable Carnival at runtime without replaying it or accumulating a spawn backlog', () => {
  const sim=withoutNaval(carnivalEntry());step(sim,600);sim.setCatharsisBalance({...sim.getState().catharsis!.balance,
    carnival:{...carnivalConfig.catharsis!.carnival,enabled:false}});step(sim);
  expect(sim.getState().carnival!.status).toBe('complete');expect(sim.getState().postCapSurvival!.startedAtSeconds).not.toBeNull();
  sim.setCatharsisBalance(carnivalConfig.catharsis!);step(sim);expect(sim.getState().carnival!.status).toBe('complete');
  expect(()=>roundTrip(sim)).not.toThrow();
});

it('validates data-driven timing, lane groups and cap; old config defaults disabled', () => {
  for(const patch of [{waveIntervalSeconds:0},{durationSeconds:1},{groupSize:200},{activeEnemyLimit:20},{laneGroups:[[0,0],[5]]}]) {
    const bad=structuredClone(data);Object.assign(bad.catharsis.carnival,patch);expect(()=>GameConfigSchema.parse(bad)).toThrow();
  }
});

it.each([1,17,42,99,2026])('meets Carnival availability and survival targets deterministically for seed %i', seed => {
  const a=runCarnivalPilot(seed),b=runCarnivalPilot(seed);expect(b).toEqual(a);
  expect(a.duration).toBe(24);expect(a.availabilityFirst20Percent).toBeGreaterThanOrEqual(85);
  expect(a.longestGapSeconds).toBeLessThanOrEqual(2);expect(a.casualties).toBe(0);expect(a.failure).toBe(false);
  expect(a.spawned.heavies).toBe(1);expect(a.peakEnemies).toBeLessThanOrEqual(80);
});
