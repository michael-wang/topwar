import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { advanceLandingAssault, emptyLandingAssault, landingComposition, landingPrimaryLanes } from '../src/simulation/enemies/landingAssault';
import type { EnemySimulationState } from '../src/simulation/SimulationState';
const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = (enabled = true) => new Simulation({ seed: 17, level: LevelDefinitionSchema.parse(levelData),
  startSquad: 1, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: { ...balance, landingAssault: { ...balance.landingAssault, enabled } }, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: .6, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: config.weapon.rifle, rocket: config.weapon.rocket };
const step = (s: Simulation, n: number) => { for (let i = 0; i < n; i++) s.step(1/60, { targetX: 0 }, tuning); };
it('preserves early stream and progression exactly', () => {
  const a = make(), b = make(false); step(a, 1200); step(b, 1200);
  expect(a.getState().enemies).toEqual(b.getState().enemies);
  expect(a.getState().progression).toEqual(b.getState().progression);
  expect(a.getState().weapons).toEqual(b.getState().weapons);
});
it('gives the actual reinforcement arrival ten full seconds before assault, with snapshot replay', () => {
  const a = make(), s = a.getState(); s.progression = { level: 7, xp: 0 }; a.restoreState(s);
  step(a, 67); const arrival = a.getState(); expect(arrival.reinforcement!.arrived).toBe(true);
  expect(arrival.landingAssault!.reinforcementActiveAtSeconds).toBeCloseTo(arrival.elapsedSeconds);
  const b = make(); b.restoreState(JSON.parse(JSON.stringify(arrival)));
  step(a, 599); step(b, 599); expect(a.getState()).toEqual(b.getState());
  expect(a.getState().landingAssault!.startedAtSeconds).toBeNull();
  step(a, 1); expect(a.getState().landingAssault!.startedAtSeconds).toBeCloseTo(arrival.elapsedSeconds + 10);
});
it('generates bounded deterministic 46/20 concentration and changing primary pairs', () => {
  for (const seed of [1,17,42,0xffffffff]) for (let index = 0; index < 10; index++) {
    const group = landingComposition(index, seed, balance, 3.2), pair = landingPrimaryLanes(index, seed, 5);
    expect(group).toEqual(landingComposition(index, seed, balance, 3.2)); expect(group).toHaveLength(66);
    expect(group.filter(e => pair.includes(e.lane))).toHaveLength(46);
    expect(new Set(group.map(e => e.lane)).size).toBe(5);
    expect(group.every(e => Math.abs(e.x) <= 2.8 + 1e-12 && e.z >= -9 && e.z <= 0)).toBe(true);
    expect(pair).not.toEqual(landingPrimaryLanes(index + 1, seed, 5));
  }
});
it('delays at the soft cap without despawn or catch-up bursts, retaining configured cadence', () => {
  const enemies: EnemySimulationState[] = Array.from({length: 120}, (_, id) => ({id,tier:1,x:0,z:20,hp:1,lane:2,archetype:'grunt'}));
  const cursor = {nextEnemyId:120,nextRowIndex:0,nextRewardId:1,nextRewardBlockIndex:0,nextBossTier:1};
  const state = {...emptyLandingAssault(), reinforcementActiveAtSeconds:0};
  const blocked = advanceLandingAssault(state, 10, 0, balance, 3.2, 17, 6, enemies, cursor);
  expect(enemies).toHaveLength(120); expect(blocked.waveIndex).toBe(0);
  enemies.splice(0, 10);
  const admitted = advanceLandingAssault(blocked, 20, 0, balance, 3.2, 17, 6, enemies, cursor);
  expect(enemies).toHaveLength(176); expect(admitted.nextWaveAtSeconds).toBeCloseTo(25.28);
  expect(admitted.waveIndex).toBe(1);
});
it('retains the old one-Giant encounter policy when loaded from older effective balance', () => {
  const legacy = {...balance,landingAssault:{...balance.landingAssault,secondGiantDelaySeconds:30,maxSimultaneousGiants:1}};
  const enemies: EnemySimulationState[] = [{id:1,tier:1,x:0,z:20,hp:172,lane:2,archetype:'giant'}];
  const cursor = {nextEnemyId:2,nextRowIndex:0,nextRewardId:1,nextRewardBlockIndex:0,nextBossTier:1};
  let state: ReturnType<typeof emptyLandingAssault> = {...emptyLandingAssault(),reinforcementActiveAtSeconds:0,startedAtSeconds:10,nextWaveAtSeconds:1000,waveIndex:1};
  state = advanceLandingAssault(state, 39.9, 0, legacy, 3.2, 17, 6, enemies, cursor);
  expect(state.secondGiantSpawned).toBe(false);
  state = advanceLandingAssault(state, 40, 0, legacy, 3.2, 17, 6, enemies, cursor);
  expect(enemies).toHaveLength(1); expect(state.secondGiantSpawned).toBe(false);
  enemies.length = 0;
  state = advanceLandingAssault(state, 41, 0, legacy, 3.2, 17, 6, enemies, cursor);
  expect(enemies[0].hp).toBe(172); expect(enemies[0].z).toBe(legacy.defenseSpawnAheadDistance - legacy.crowdDepthSpan); expect(state.secondGiantSpawned).toBe(true);
  enemies.length = 0; advanceLandingAssault(state, 42, 0, legacy, 3.2, 17, 6, enemies, cursor);
  expect(enemies).toHaveLength(0);
});
it('rejects corrupt phase clocks and initializes Retry cleanly', () => {
  const a = make(), s = a.getState(); s.landingAssault!.waveIndex = -1;
  expect(() => a.restoreState(s)).toThrow('landing assault');
  expect(make().getState().landingAssault).toEqual(emptyLandingAssault());
});

it('restores an active capped phase without changing the next deterministic wave or Giant', () => {
  const a = make(), state = a.getState(); state.enemies = []; state.elapsedSeconds = 40; state.tick = 2400;
  state.progression = { level: 7, xp: 0 }; state.reinforcement = { startedAtSeconds: 0, arrived: true };
  state.giantEncounter = { scheduledAtSeconds: 4, spawned: true };
  state.squad = { ...state.squad, count: 2, rifleCounts: [2] };
  state.landingAssault = { reinforcementActiveAtSeconds: 1.1, startedAtSeconds: 11.1,
    nextWaveAtSeconds: 40, waveIndex: 3, secondGiantSpawned: false };
  a.restoreState(state); const b = make(); b.restoreState(JSON.parse(JSON.stringify(a.getState())));
  step(a, 120); step(b, 120); expect(a.getState()).toEqual(b.getState());
  expect(a.getState().landingAssault!.secondGiantSpawned).toBe(true);
  expect(a.getState().enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
});


it('keeps live pressure tuning in snapshots and leaves existing enemies untouched', () => {
  const a = make(), before = a.getState().enemies;
  a.setCatharsisBalance({ ...balance, landingAssault: { ...balance.landingAssault, groupSize: 70, cadenceMultiplier: .9 } });
  expect(a.getState().enemies).toEqual(before);
  const b = make(); b.restoreState(JSON.parse(JSON.stringify(a.getState())));
  expect(b.getState().catharsis!.balance.landingAssault.groupSize).toBe(70);
  expect(b.getState().catharsis!.balance.landingAssault.cadenceMultiplier).toBe(.9);
});

it('admits staggered overlapping Giants in different lanes, waits at two, and restores its follow-up clock', () => {
  const enemies: EnemySimulationState[] = [{id:1,tier:1,x:0,z:20,hp:172,lane:2,archetype:'giant'}];
  const cursor={nextEnemyId:2,nextRowIndex:0,nextRewardId:1,nextRewardBlockIndex:0,nextBossTier:1};
  let state: ReturnType<typeof emptyLandingAssault>={...emptyLandingAssault(),reinforcementActiveAtSeconds:0,
    startedAtSeconds:10,nextWaveAtSeconds:1000,waveIndex:1};
  state=advanceLandingAssault(state,27.9,0,balance,3.2,17,6,enemies,cursor); expect(enemies).toHaveLength(1);
  state=advanceLandingAssault(state,28,0,balance,3.2,17,6,enemies,cursor);
  expect(enemies).toHaveLength(2); expect(new Set(enemies.map(e=>e.lane)).size).toBe(2);
  expect(state.nextGiantAtSeconds).toBe(38);
  const restored=JSON.parse(JSON.stringify(state));
  state=advanceLandingAssault(restored,38,0,balance,3.2,17,6,enemies,cursor); expect(enemies).toHaveLength(2);
  enemies.splice(0,1); state=advanceLandingAssault(state,39,0,balance,3.2,17,6,enemies,cursor);
  expect(enemies).toHaveLength(2); expect(new Set(enemies.map(e=>e.lane)).size).toBe(2);
  expect(state.nextGiantAtSeconds).toBeNull(); expect(enemies.every(e=>e.hp===172)).toBe(true);
  enemies.length=0; advanceLandingAssault(state,100,0,balance,3.2,17,6,enemies,cursor); expect(enemies).toHaveLength(0);
});
it('increases expected Heavy proportion twofold without HP inflation or extra population', () => {
  let total=0, two=0;
  for(let index=0;index<2000;index++){
    const group=landingComposition(index,17,balance,3.2),heavies=group.filter(e=>e.archetype==='heavy');
    total+=heavies.length; if(heavies.length===2)two++;
    expect(group).toHaveLength(66); expect(heavies.length).toBeLessThanOrEqual(2);
    for(const heavy of heavies)expect(group.filter(e=>e!==heavy&&e.lane===heavy.lane).every(e=>e.z>=-6.5)).toBe(true);
  }
  expect(total/2000).toBeCloseTo(.25/35*66*2,1); expect(two).toBeGreaterThan(200);
  expect(balance.heavyHp).toBe(15); expect(balance.giant.hp).toBe(172);
});

it('serializes the pending second post-assault Giant and resumes it identically', () => {
  const a=make(), s=a.getState(); s.elapsedSeconds=40;s.tick=2400;s.enemies=[];
  s.progression={level:7,xp:0};s.reinforcement={startedAtSeconds:0,arrived:true};
  s.giantEncounter={scheduledAtSeconds:4,spawned:true};
  s.squad={...s.squad,count:2,rifleCounts:[2]};
  s.landingAssault={...emptyLandingAssault(),reinforcementActiveAtSeconds:1.1,startedAtSeconds:11.1,
    nextWaveAtSeconds:40,waveIndex:3};a.restoreState(s);step(a,1);
  const pending=a.getState();expect(pending.landingAssault!.nextGiantAtSeconds).toBeCloseTo(50+1/60);
  const b=make();b.restoreState(JSON.parse(JSON.stringify(pending)));step(a,601);step(b,601);
  expect(a.getState()).toEqual(b.getState());expect(a.getState().landingAssault!.nextGiantAtSeconds).toBeNull();
  const giants=a.getState().enemies.filter(e=>e.archetype==='giant');expect(giants).toHaveLength(2);
  expect(Math.abs(giants[0].lane!-giants[1].lane!)).toBeGreaterThanOrEqual(2);
  const corrupt=a.getState();corrupt.landingAssault!.nextGiantAtSeconds=-1;
  expect(()=>a.restoreState(corrupt)).toThrow('landing assault');
});

it('keeps overlapping Giant placement valid when playtesting three lanes', () => {
  const small={...balance,laneCount:3}, enemies: EnemySimulationState[]=[{id:1,tier:1,x:0,z:20,hp:172,lane:1,archetype:'giant'}];
  const cursor={nextEnemyId:2,nextRowIndex:0,nextRewardId:1,nextRewardBlockIndex:0,nextBossTier:1};
  const state={...emptyLandingAssault(),reinforcementActiveAtSeconds:0,startedAtSeconds:10,nextWaveAtSeconds:1000,waveIndex:1};
  advanceLandingAssault(state,28,0,small,3.2,17,6,enemies,cursor);
  expect(enemies).toHaveLength(2); expect(enemies[1].lane).not.toBe(1); expect(Math.abs(enemies[1].x)).toBeCloseTo(2.8);
});
