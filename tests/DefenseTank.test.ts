import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src/core/Rng';
import { attackLanePositions } from '../src/simulation/enemies/laneComposition';
import { makeArtilleryShell } from '../src/simulation/artillery';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { emptyCarnival } from '../src/simulation/carnival';
import { emptyDestroyer } from '../src/simulation/destroyer';
import { tankPhase, startDefenseTank, admitTankFlanks, clearTankEntrance, advanceTankPosition } from '../src/simulation/defenseTank';
import { enemyApproachSpeed } from '../src/simulation/enemies/latePressure';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { CHECKPOINT_KEY, readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { clearResultRows } from '../src/ui/StageClearOverlay';
import { combatResults } from '../src/simulation/combatStats';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config), tankConfig = structuredClone(config.catharsis!.defenseTank!);
// Released snapshots keep the original simultaneous/fixed scheduler.
delete tankConfig.salvoPolicy;
function fixture(playerLevel = 9) {
  const balance = structuredClone(config.catharsis!); balance.defenseTank = structuredClone(tankConfig);
  balance.levelEncounters!.triggers = []; balance.carnival.enabled = false;
  const sim = new Simulation({ seed: 17, level, startSquad: 2, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance, trackHalfWidth: config.track.halfWidth } });
  const s = sim.getState(); s.tick = 1800; s.elapsedSeconds = 30; s.enemies = []; s.projectiles = [];
  s.carnival = emptyCarnival(true); s.destroyer = emptyDestroyer(true);
  s.levelEncounters!.survivalEnabled = true; s.machineGunReleaseAtSeconds = 0;
  s.progression = { level: playerLevel, xp: 0 }; s.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  if (playerLevel === 8) s.squad = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
  s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0, inventory: 20, flight: null, supply: null };
  s.defenseWaves!.nextAtSeconds = 30; sim.restoreState(s);
  return sim;
}
function step(sim: Simulation, ticks = 1) { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning); }
function active(phase: 1 | 2 | 3 = 1) {
  const sim = fixture();
  const s = sim.getState(); s.defenseTank = startDefenseTank(27.5, s.seed, tankConfig);
  s.defenseTank.status = 'active'; s.defenseTank.z = tankConfig.battleZ;
  s.defenseTank.hp = phase === 1 ? 6500 : phase === 2 ? 4550 : 2275; s.defenseTank.phase = phase;
  sim.restoreState(s); return sim;
}
function suppressFire(sim: Simulation) {
  const s = sim.getState(); s.weapons.rifleCooldownRemainingSeconds = 100;
  s.weapons.rifleMemberCooldowns = [100, 100]; sim.restoreState(s);
}

describe('Stage 1 Defense tank and released fixed-policy checkpoints', () => {
  it('uses 3 Heavy per lane / 4s flank / 12s Giant phase-2 slots without backlog, retaining old embedded settings', () => {
    const s = active(2).getState(), tank = s.defenseTank!;
    expect(tankConfig.phases.map(p => p.heaviesPerLane)).toEqual([3, 3, 5]);
    expect(tankConfig.phases.map(p => p.flankIntervalSeconds)).toEqual([6, 4, 4]);
    expect(tankConfig.phases.map(p => p.giantIntervalSeconds)).toEqual([null, 12, 12]);
    admitTankFlanks(s, tank, tankConfig); expect(s.enemies).toHaveLength(8);
    for (const lane of [0, 4]) expect(s.enemies.filter(e => e.lane === lane && e.archetype === 'heavy')).toHaveLength(3);
    expect(tank.nextFlankAtSeconds).toBe(34); expect(tank.nextGiantAtSeconds).toBe(42);
    s.elapsedSeconds = 34 - 1 / 60; admitTankFlanks(s, tank, tankConfig); expect(s.enemies).toHaveLength(8);
    s.elapsedSeconds = 34; admitTankFlanks(s, tank, tankConfig); expect(s.enemies).toHaveLength(16);
    s.elapsedSeconds = 42 - 1 / 60; admitTankFlanks(s, tank, tankConfig);
    expect(s.enemies.filter(e => e.archetype === 'giant')).toHaveLength(0);
    s.elapsedSeconds = 42; admitTankFlanks(s, tank, tankConfig);
    expect(s.enemies.filter(e => e.archetype === 'giant')).toHaveLength(1); expect(tank.nextGiantAtSeconds).toBe(54);
    const count = s.enemies.length; s.elapsedSeconds = 84; admitTankFlanks(s, tank, tankConfig);
    expect(s.enemies).toHaveLength(count + 9); expect(tank.nextFlankAtSeconds).toBeGreaterThan(84);
    expect(tank.nextGiantAtSeconds).toBeGreaterThan(84);
    admitTankFlanks(s, tank, tankConfig); expect(s.enemies).toHaveLength(count + 9);
    const old = active(2).getState(), oldConfig = old.catharsis!.balance.defenseTank!;
    oldConfig.phases[1].heaviesPerLane = 4;
    oldConfig.phases[1].flankIntervalSeconds = 5; oldConfig.phases[1].giantIntervalSeconds = 12;
    const replay = active(2); replay.restoreState(old); step(replay);
    const restored = replay.getState();
    expect(restored.defenseTank!.nextFlankAtSeconds).toBe(35);
    expect(restored.defenseTank!.nextGiantAtSeconds).toBe(restored.elapsedSeconds + 12);
    expect(restored.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(8);
    expect(restored.catharsis!.balance.defenseTank!.phases[1]).toEqual(oldConfig.phases[1]);
  });
  it.each([1, 2, 3] as const)('phase %i admits only the existing flank counts at 28 units with persistent Boss speeds', phase => {
    const sim = active(phase), s = sim.getState(), p = tankConfig.phases[phase - 1];
    const oldHeavy = { id: 100, tier: 1, archetype: 'heavy' as const, lane: 0, x: -2.8, z: 35, hp: 15 };
    s.enemies = [oldHeavy]; s.enemyStream!.nextEnemyId = 101;
    admitTankFlanks(s, s.defenseTank!, tankConfig);
    const admitted = s.enemies.slice(1);
    expect(admitted).toHaveLength(2 * (p.heaviesPerLane + p.gruntsPerLane));
    expect(admitted.every(e => e.lane === 0 || e.lane === 4)).toBe(true);
    expect(admitted.filter(e => e.archetype === 'heavy').every(e => e.bossFlankSpeedUnitsPerSecond === [1.4, 1.7, 2][phase - 1])).toBe(true);
    expect(admitted.filter(e => e.archetype === 'grunt').every(e => e.bossFlankSpeedUnitsPerSecond === undefined)).toBe(true);
    expect(Math.min(...admitted.map(e => e.z))).toBe(28);
    expect(s.defenseTank!.nextFlankAtSeconds).toBe(30 + p.flankIntervalSeconds);
    const ordinarySpeed = enemyApproachSpeed(oldHeavy, s.catharsis!.balance);
    sim.restoreState(s); expect(sim.getState().enemies).toEqual(s.enemies);
    step(sim);
    const after = sim.getState();
    expect(35 - after.enemies.find(e => e.id === 100)!.z).toBeCloseTo(ordinarySpeed / 60);
    expect(28 - after.enemies.find(e => e.id === 101)!.z).toBeCloseTo([1.4, 1.7, 2][phase - 1] / 60);
    const invalid = structuredClone(s); invalid.enemies[1].bossFlankSpeedUnitsPerSecond = 0;
    expect(() => sim.restoreState(invalid)).toThrow(); expect(sim.getState()).toEqual(after);
    if (phase > 1) {
      s.elapsedSeconds = s.defenseTank!.nextGiantAtSeconds!;
      admitTankFlanks(s, s.defenseTank!, tankConfig);
      const giant = s.enemies.find(e => e.archetype === 'giant')!;
      expect(giant.z).toBe(28); expect(giant.bossFlankSpeedUnitsPerSecond).toBe(phase === 2 ? 1.1 : 1.3);
      expect(s.defenseTank!.nextGiantAtSeconds).toBe(s.elapsedSeconds + p.giantIntervalSeconds!);
    }
  });
  it('preserves speeds already admitted across phases and the original settings of old Tank checkpoints', () => {
    const sim = active(), s = sim.getState();
    admitTankFlanks(s, s.defenseTank!, tankConfig);
    s.defenseTank!.phase = 2; s.defenseTank!.hp = 4550;
    s.defenseTank!.nextFlankAtSeconds = s.elapsedSeconds;
    admitTankFlanks(s, s.defenseTank!, tankConfig);
    expect(s.enemies[0].bossFlankSpeedUnitsPerSecond).toBe(1.4);
    expect(s.enemies[8].bossFlankSpeedUnitsPerSecond).toBe(1.7);
    sim.restoreState(s); expect(sim.getState().enemies).toEqual(s.enemies);
    const historical = structuredClone(tankConfig);
    delete historical.flankSpawnAheadDistance;
    for (const p of historical.phases) { delete p.heavySpeedUnitsPerSecond; delete p.giantSpeedUnitsPerSecond; }
    const old = active().getState(); old.catharsis!.balance.defenseTank = historical;
    admitTankFlanks(old, old.defenseTank!, historical);
    expect(Math.min(...old.enemies.map(e => e.z))).toBe(old.catharsis!.balance.defenseSpawnAheadDistance);
    expect(old.enemies.every(e => e.bossFlankSpeedUnitsPerSecond === undefined)).toBe(true);
    const replay = new Simulation({ seed: old.seed, level, startSquad: 2, startRocketCount: 0, tiers: config.tiers, catharsis: old.catharsis });
    replay.restoreState(old); expect(replay.getState().enemies).toEqual(old.enemies);
  });
  it('crushes only reached bodies throughout entry, with one shockwave and no XP or direct kills', () => {
    const sim = fixture(); suppressFire(sim);
    const initial = sim.getState();
    initial.enemies = Array.from({ length: 5 }, (_, lane) => ({ id: lane + 1, tier: 1,
      archetype: 'heavy' as const, lane, x: (lane - 2) * 1.4, z: 32, hp: 15 }));
    initial.enemies.push(...initial.enemies.map(e=>({...e,id:e.id+5,z:tankConfig.startZ})),
      {id:11,tier:1,archetype:'heavy',lane:2,x:0,z:44,hp:15},
      {id:12,tier:1,archetype:'heavy',lane:2,x:0,z:60,hp:15});
    initial.enemyStream!.nextEnemyId = 13; sim.restoreState(initial); step(sim, 16);
    const first=sim.consumeTankEntranceEvents();expect(first).toHaveLength(1);
    expect(first[0].shockwave).toBe(false);expect(first[0].victims.map(e=>e.id).sort()).toEqual([7,8,9]);
    expect(sim.getState().enemies.map(e=>e.id)).toEqual([1,2,3,4,5,6,10,11,12]);
    const before = sim.getState(), replay = fixture(); replay.restoreState(before);
    step(sim, 16); step(replay, 16);
    expect(replay.getState()).toEqual(sim.getState());
    const cleared = sim.getState(), event = sim.consumeTankEntranceEvents();
    expect(event).toHaveLength(1); expect(event[0].shockwave).toBe(true);expect(event[0].victims).toEqual([]);
    expect(cleared.progression).toEqual(before.progression); expect(cleared.combatStats).toEqual(before.combatStats);
    expect(cleared.defenseTank!.entranceCleared).toBe(true);
    expect(replay.consumeTankEntranceEvents()).toEqual(event);
    sim.restoreState(cleared);expect(sim.consumeTankEntranceEvents()).toEqual([]);step(sim,100);
    const later=sim.consumeTankEntranceEvents();expect(later).toHaveLength(1);
    expect(later[0].shockwave).toBe(false);expect(later[0].victims.map(e=>e.id)).toEqual([11]);
    expect(sim.getState().enemies.map(e=>e.id)).toEqual([1,2,3,4,5,6,10,12]);
    expect(sim.getState().progression).toEqual(initial.progression);expect(sim.getState().combatStats).toEqual(initial.combatStats);
    const old = active().getState(); delete old.defenseTank!.entranceCleared;
    sim.restoreState(old); expect(sim.getState().defenseTank!.entranceCleared).toBe(true);
  });
  it.each([0,1,2,3,4])('uses world X/Z rather than membership of lane %i',lane=>{
    const tank=startDefenseTank(0,17,tankConfig),x=(lane-2)*1.4;
    const previous=[{id:1,tier:1,lane,x,z:tankConfig.startZ,hp:15,archetype:'heavy' as const},
      {id:2,tier:1,lane,x,z:32,hp:15,archetype:'heavy' as const},
      {id:3,tier:1,lane,x,z:60,hp:15,archetype:'heavy' as const}];
    const enemies=previous.map(e=>({...e}));clearTankEntrance(tank,tankConfig,enemies,previous,1/60,1/60,tuning.normalEnemyRadius);
    expect(enemies.map(e=>e.id)).toEqual(lane>=1&&lane<=3?[2,3]:[1,2,3]);
    const offLane=[{...previous[0],x:0,lane:0}];
    expect(clearTankEntrance(tank,tankConfig,[...offLane],offLane,1/60,1/60,tuning.normalEnemyRadius)!.victims).toHaveLength(1);
  });
  it.each([-1,1])('uses existing enemy radius at the lateral edge (%i), including rounded corners',sign=>{
    for(const [dx,dz,hit] of [[.299,0,true],[.301,0,false],[.2,2.9,true],[.25,2.95,false]] as const){
      const tank=startDefenseTank(0,17,tankConfig),previous=[{id:1,tier:1,lane:2,
        x:sign*(tankConfig.halfWidth+dx),z:tankConfig.startZ+dz,hp:15,archetype:'heavy' as const}],enemies=[...previous];
      clearTankEntrance(tank,tankConfig,enemies,previous,.001,.001,tuning.normalEnemyRadius);
      expect(enemies.length,JSON.stringify({dx,dz,sign})).toBe(hit?0:1);
    }
  });
  it('sweeps relative movement, clips the entrance at landing and never checks the future route',()=>{
    const tank=startDefenseTank(0,17,tankConfig),enemy={id:1,tier:1,lane:2,x:0,z:44,hp:15,archetype:'heavy' as const};
    let enemies=[{...enemy}];expect(clearTankEntrance(tank,tankConfig,enemies,[enemy],.5,.5,.3)!.victims).toEqual([]);
    expect(enemies).toHaveLength(1);advanceTankPosition(tank,tankConfig,.5,.5);
    const event=clearTankEntrance(tank,tankConfig,enemies,[enemy],2,1.5,.3);
    expect(event!.victims).toHaveLength(1);expect(event!.shockwave).toBe(false);
    // An enemy beyond the rear can catch the moving body, but isn't removed early.
    const fast=startDefenseTank(0,17,tankConfig),rear={...enemy,z:58};enemies=[{...rear,z:50}];
    expect(clearTankEntrance(fast,tankConfig,enemies,[rear],1,1,.3)!.victims).toHaveLength(1);
    // Crossing a large step's entry/active boundary must not crush an enemy that
    // only approaches the rear after the entrance has already ended.
    const end=startDefenseTank(0,17,tankConfig);advanceTankPosition(end,tankConfig,2,2);
    const behind={...enemy,z:50};enemies=[{...behind,z:40}];
    clearTankEntrance(end,tankConfig,enemies,[behind],4,2,.3);expect(enemies).toHaveLength(1);
  });
  it.each([0,20,60,145,160])('restores entrance tick %i without replay, changed RNG or encounter/attack schedules',ticks=>{
    const sim=fixture();suppressFire(sim);const s=sim.getState();
    s.enemies=[{id:1,tier:1,lane:2,x:0,z:44,hp:15,archetype:'heavy'},
      {id:2,tier:1,lane:2,x:0,z:32,hp:15,archetype:'heavy'}];s.enemyStream!.nextEnemyId=3;sim.restoreState(s);
    step(sim,ticks);sim.consumeTankEntranceEvents();const saved=sim.getState(),copy=fixture();copy.restoreState(saved);
    expect(copy.consumeTankEntranceEvents()).toEqual([]);expect(copy.getState()).toEqual(saved);
    step(sim,180);step(copy,180);expect(copy.getState()).toEqual(sim.getState());
    expect(copy.consumeTankEntranceEvents()).toEqual(sim.consumeTankEntranceEvents());
    const control=fixture();suppressFire(control);const untouched={...s,enemies:[s.enemies[1]]};control.restoreState(untouched);step(control,ticks+180);
    const a=sim.getState(),b=control.getState();
    for(const key of ['defenseTank','levelEncounters','defenseWaves','machineGunReleaseAtSeconds','rngState','postCapSurvival','carnival','enemyStream'] as const)
      expect(a[key]).toEqual(b[key]);
    expect(a.combatStats).toEqual(b.combatStats);expect(a.progression).toEqual(b.progression);
  });
  it('keeps front-of-Tank enemies moving and intercepting bullets for normal XP, with normal casualty setbacks',()=>{
    const sim=fixture();suppressFire(sim);const s=sim.getState();
    s.enemies=[{id:1,tier:1,lane:2,x:0,z:32,hp:1,archetype:'heavy'}];s.enemyStream!.nextEnemyId=2;
    sim.restoreState(s);step(sim,151);const survivor=sim.getState();
    expect(survivor.enemies.find(e=>e.id===1)!.z).toBeLessThan(32);expect(survivor.defenseTank!.status).toBe('active');
    const hp=survivor.defenseTank!.hp;
    survivor.projectiles=[{id:survivor.weapons.nextProjectileId++,kind:'machineGun',tier:1,x:0,z:28,speed:900,lane:2,
      slopeX:0,memberIndex:0,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
    survivor.combatStats!.shotsFired++;sim.restoreState(survivor);step(sim);
    expect(sim.getState().defenseTank!.hp).toBe(hp);expect(sim.getState().combatStats!.heavyKills).toBe(1);
    expect(sim.getState().progression!.xp).toBe(10);
    const breach=sim.getState();breach.enemies=[{id:breach.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z:-10,hp:15,archetype:'heavy'}];
    sim.restoreState(breach);step(sim);expect(sim.getState().squad.count).toBe(1);
    expect(sim.getState().progression).toEqual({level:8,xp:0,pressure:{level:9,xp:10}});sim.restoreState(sim.getState());
  });
  it('starts exactly on earned Lv9, stops new naval fire and preserves incoming shells', () => {
    const sim = fixture(8), s = sim.getState(); s.progression!.xp = 349;
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: .6, hp: 1 }]; s.enemyStream!.nextEnemyId = 2;
    sim.restoreState(s);
    sim.launchArtillery({ source: { id: 'destroyer', type: 'destroyer', position: { x: 0, y: 2, z: 52 } }, targetLane: 0 });
    const before = sim.getState().artillery!.shells[0]; step(sim);
    const after = sim.getState(); expect(after.progression!.level).toBe(9); expect(after.defenseTank!.status).toBe('entering');
    expect(after.defenseTank!.activeAtSeconds - after.defenseTank!.startedAtSeconds).toBe(2.5);
    expect(after.artillery!.shells).toEqual([before]); expect(after.navalBarrage!.enabled).toBe(false);
    step(sim, 150); expect(sim.getState().defenseTank!.status).toBe('active');
    expect(sim.getState().artillery!.shells.every(x => x.source.type === 'defenseTank')).toBe(true);
    expect(sim.consumeArtilleryEvents().some(e => e.kind === 'artilleryImpact' && e.id === before.id)).toBe(true);
  });
  it.each([1, 2, 3] as const)('phase %i uses distinct lanes and its post-impact cooldown with no overlapping tank salvos', phase => {
    const sim = active(phase); suppressFire(sim); step(sim);
    const first = sim.getState().artillery!.shells;
    expect(first).toHaveLength(phase); expect(new Set(first.map(s => s.targetLane)).size).toBe(phase);
    // This checks cooldowns, so dodge the aimed salvo using real lane movement.
    const safeLane=[0,1,2,3,4].find(lane=>!first.some(s=>s.targetLane===lane))!;
    while(sim.getState().player.selectedLane!==safeLane)sim.stepLane(safeLane<sim.getState().player.selectedLane!?-1:1);
    const finalImpact = Math.max(...first.map(s => s.impactAtSeconds)), count = tankConfig.phases[phase - 1].shells;
    while (sim.getState().elapsedSeconds + 1 / 60 < finalImpact && sim.getState().squad.count) step(sim);
    expect(sim.getState().artillery!.nextId).toBe(count + 1);
    step(sim, 2); const cooldown = sim.getState().defenseTank!;
    expect(cooldown.nextAttackAtSeconds).toBeCloseTo(finalImpact + tankConfig.phases[phase - 1].cooldownSeconds);
    const deadline = cooldown.nextAttackAtSeconds!;
    while (sim.getState().elapsedSeconds + 1 / 60 < deadline - 1e-9 && sim.getState().squad.count) step(sim);
    expect(sim.getState().artillery!.shells).toHaveLength(0); step(sim);
    expect(sim.getState().artillery!.shells).toHaveLength(count);
  });
  it.each([1,2,3] as const)('phase %i aims first at physical X in all five lanes, then draws distinct dedicated-RNG lanes', phase=>{
    for(let lane=0;lane<5;lane++){
      const sim=active(phase);suppressFire(sim);const before=sim.getState();
      const positions=attackLanePositions(before.catharsis!.balance.laneCount,before.catharsis!.trackHalfWidth,before.catharsis!.balance.edgeInset);
      before.player.x=positions[lane];before.player.selectedLane=(lane+1)%5;sim.restoreState(before);
      const replay=active(phase);replay.restoreState(before);step(sim);step(replay);
      const after=sim.getState(),shells=after.artillery!.shells;
      expect(replay.getState()).toEqual(after);expect(shells).toHaveLength(phase);
      expect(shells[0].targetLane).toBe(lane);expect(shells[0].target.x).toBe(positions[lane]);
      expect(shells[0].targetLane).not.toBe(after.player.selectedLane);
      expect(new Set(shells.map(s=>s.targetLane)).size).toBe(phase);
      expect(shells.every(s=>s.flightSeconds>=2.4)).toBe(true);
      const rng=new SeededRng(before.defenseTank!.rngState);
      for(let i=1;i<phase;i++)rng.nextInt(5-i);
      expect(after.defenseTank!.rngState).toBe(rng.getState()); // Exactly one draw per random shell; none for aiming.
      expect(after.rngState).toBe(before.rngState);
      expect(after.navalBarrage).toEqual(before.navalBarrage);
    }
  });
  it('aims using physical X after this launch tick moves the player across a nearest-lane boundary',()=>{
    const sim=active();suppressFire(sim);const before=sim.getState();
    before.player.x=2;before.player.selectedLane=4;sim.restoreState(before);step(sim);
    const after=sim.getState();expect(after.player.x).toBeGreaterThan(2.1);
    expect(after.artillery!.shells[0].targetLane).toBe(4); // Previous X=2 was nearest lane 3.
  });
  it('retains historical in-flight targets through steering and checkpoint restore, then deterministically aims the next salvo',()=>{
    const sim=active(3);suppressFire(sim);step(sim);const historical=sim.getState();
    // Previously launched random-only salvo: a legal first lane unrelated to current physical X.
    const shells=historical.artillery!.shells;
    const positions=attackLanePositions(historical.catharsis!.balance.laneCount,historical.catharsis!.trackHalfWidth,historical.catharsis!.balance.edgeInset);
    for(let i=0;i<shells.length;i++)shells[i]=makeArtilleryShell(shells[i].id,{source:shells[i].source},i,
      positions,historical.player.z,shells[i].launchedAtSeconds,shells[i].flight,shells[i].radius);
    historical.defenseTank!.pendingImpactAtSeconds=Math.max(...shells.map(s=>s.impactAtSeconds));
    sim.restoreState(historical);sim.stepLane(1);sim.stepLane(1);step(sim,30);
    const checkpoint=sim.getState();expect(checkpoint.player.x).toBeCloseTo(2.8);
    expect(checkpoint.artillery!.shells).toEqual(shells);
    const replay=active(3);replay.restoreState(JSON.parse(JSON.stringify(checkpoint)));
    expect(replay.getState()).toEqual(checkpoint);expect(replay.consumeArtilleryEvents()).toEqual([]);
    sim.consumeArtilleryEvents();
    for(let tick=0;tick<360 && sim.getState().artillery!.nextId===checkpoint.artillery!.nextId;tick++){
      step(sim);step(replay);expect(replay.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents());
    }
    expect(replay.getState()).toEqual(sim.getState());
    expect(sim.getState().artillery!.nextId).toBeGreaterThan(checkpoint.artillery!.nextId);
    expect(sim.getState().artillery!.shells[0].targetLane).toBe(4);
  });
  it('keeps a paused checkpoint valid when a tank shell or the whole salvo is cancelled', () => {
    const sim = active(3); suppressFire(sim); step(sim);
    sim.cancelArtillery(sim.getState().artillery!.shells[0].id);
    const partial = sim.getState(); sim.restoreState(partial);
    expect(partial.defenseTank!.pendingImpactAtSeconds).toBe(Math.max(...partial.artillery!.shells.map(s => s.impactAtSeconds)));
    sim.cancelArtillery(); const cancelled = sim.getState(); sim.restoreState(cancelled);
    expect(cancelled.defenseTank!.pendingImpactAtSeconds).toBeNull();
    expect(cancelled.defenseTank!.nextAttackAtSeconds).toBeCloseTo(cancelled.elapsedSeconds + 2);
  });
  it.each([1, 2, 3])('middle lane %i damages the same armor while a closer enemy/supply blocks it', lane => {
    const sim = active(); suppressFire(sim); const s = sim.getState();
    s.player.selectedLane = lane;
    const shot = { id: 1, kind: 'machineGun' as const, tier: 1, x: lane * 1.4 - 2.8, z: 35, speed: 600,
      lane, slopeX: 0, memberIndex: 0, damage: config.tiers.tier1Power, remainingRange: 50,
      blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 };
    s.projectiles = [shot]; s.weapons.nextProjectileId = 2; s.combatStats!.shotsFired = 1;
    sim.restoreState(s); step(sim); expect(sim.getState().defenseTank!.hp).toBe(6499); expect(sim.getState().combatStats!.shotsHit).toBe(1);
    const blocked = sim.getState(); blocked.projectiles = [{ ...shot, id: 2 }]; blocked.weapons.nextProjectileId = 3; blocked.combatStats!.shotsFired = 2;
    blocked.enemies = [{ id: 1, lane, tier: 1, archetype: 'heavy', hp: 15, x: shot.x, z: 36 }]; blocked.enemyStream!.nextEnemyId = 2;
    sim.restoreState(blocked); step(sim); expect(sim.getState().defenseTank!.hp).toBe(6499);
    expect(sim.getState().enemies[0].hp).toBe(14); expect(sim.getState().combatStats!.shotsHit).toBe(2);
  });
  it('keeps outer lanes off armor, and Grenades damage armor once without affecting bullet accuracy', () => {
    const sim = active(); suppressFire(sim);
    const s = sim.getState(); s.player.selectedLane = 0; s.player.x = -2.8;
    s.projectiles = [{ id: 1, kind: 'machineGun', tier: 1, x: -2.8, z: 35, speed: 600, lane: 0, slopeX: 0, memberIndex: 0,
      damage: config.tiers.tier1Power, remainingRange: 50, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 }];
    s.weapons.nextProjectileId = 2; s.combatStats!.shotsFired = 1; sim.restoreState(s); step(sim);
    expect(sim.getState().defenseTank!.hp).toBe(6500);
    const empty = sim.getState(); empty.enemies = []; sim.restoreState(empty);
    sim.step(1 / 60, { targetX: 0, throwGrenade: true }, tuning);
    expect(sim.getState().grenade!.inventory).toBe(19); expect(sim.getState().combatStats!.grenadesUsed).toBe(1);
    step(sim, 40); expect(sim.getState().defenseTank!.hp).toBe(6491); expect(sim.getState().combatStats!.shotsHit).toBe(0);
  });
  it.each([1, 2, 3] as const)('phase %i takes one Grenade hit anywhere the blast overlaps its armor, preserving ordinary enemy damage', phase => {
    for (const [x, dz, expectedDamage] of [[0, 0, 9], [tankConfig.halfWidth + 3.9, 0, 9],
      [tankConfig.halfWidth + 2, tankConfig.halfDepth + 2, 9], [tankConfig.halfWidth + 4.1, 0, 0]]) {
      const sim = active(phase); suppressFire(sim); const s = sim.getState(), hp = s.defenseTank!.hp;
      const z = s.defenseTank!.z + dz;
      s.grenade!.flight = { startX: 0, startZ: 0, targetX: x, targetZ: z, startedAtSeconds: s.elapsedSeconds,
        flightSeconds: 1 / 60, damageEnemyHp: config.catharsis!.grenade.damageEnemyHp, blastRadius: config.catharsis!.grenade.blastRadius };
      s.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 4, x, z, hp: 15 }]; s.enemyStream!.nextEnemyId = 2;
      sim.restoreState(s); step(sim);
      expect(sim.getState().defenseTank!.hp).toBe(hp - expectedDamage);
      expect(sim.getState().enemies.find(e => e.id === 1)!.hp).toBe(6);
      expect(sim.getState().combatStats!.shotsHit).toBe(s.combatStats!.shotsHit);
      const blast = sim.consumeGrenadeEvents().find(e => e.kind === 'grenadeDetonated');
      expect(blast?.kind === 'grenadeDetonated' ? blast.tankDamage ?? 0 : undefined).toBe(expectedDamage);
      step(sim, 10); expect(sim.getState().defenseTank!.hp).toBe(hp - expectedDamage);
      expect(sim.consumeGrenadeEvents()).toEqual([]);
    }
  });
  it('owns flank waves and phase-specific Giants while preserving Supply and normal XP to Lv10', () => {
    const sim = active(2); suppressFire(sim); step(sim);
    let s = sim.getState(); expect(s.enemies.every(e => e.lane === 0 || e.lane === 4)).toBe(true);
    expect(s.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(6);
    const giantAt = s.defenseTank!.nextGiantAtSeconds!;
    while (sim.getState().elapsedSeconds < giantAt + .01 && sim.getState().squad.count) {
      const state=sim.getState(),shells=state.artillery?.shells??[];
      if(shells.length){const safe=[0,1,2,3,4].find(lane=>!shells.some(s=>s.targetLane===lane))!;
        if(state.player.selectedLane!==safe)sim.stepLane(safe<state.player.selectedLane!?-1:1);}
      step(sim);
    }
    s = sim.getState(); expect(s.enemies.some(e => e.archetype === 'giant' && [0, 4].includes(e.lane!))).toBe(true);
    expect(s.enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
    s.progression!.xp = 449; s.grenade!.flight = { startX: 0, startZ: 0, targetX: -2.8, targetZ: 10,
      startedAtSeconds: s.elapsedSeconds, flightSeconds: 1 / 60, damageEnemyHp: 9, blastRadius: 4 };
    s.enemies = [{ id: 100, lane: 0, x: -2.8, z: 10, tier: 1, archetype: 'grunt', hp: 1 }]; s.enemyStream!.nextEnemyId = 101;
    s.postCapSurvival!.nextGrenadeSupplyAtSeconds = s.elapsedSeconds;
    sim.restoreState(s); step(sim); s = sim.getState();
    expect(s.progression!.level).toBe(10); expect(s.squad.count).toBe(3); expect(s.grenade!.supply).not.toBeNull();
    expect(s.combatStats!.gruntKills).toBe(1);
  });
  it('crosses HP thresholds, keeps phase 3 advancing at phase 2 speed and loses the entire squad on breach', () => {
    expect(tankPhase(4550.1, tankConfig)).toBe(1); expect(tankPhase(4550, tankConfig)).toBe(2);
    expect(tankPhase(2275, tankConfig)).toBe(3);
    expect(tankConfig.phases.map(p => p.speedUnitsPerSecond)).toEqual([.12, .16, .16]);
    const sim = active(3), before = sim.getState().defenseTank!.z; step(sim);
    expect(before - sim.getState().defenseTank!.z).toBeCloseTo(.16 / 60);
    const s = sim.getState(); s.defenseTank!.z = tankConfig.halfDepth - tuning.defenseLineOffset + .001;
    sim.restoreState(s); step(sim); expect(sim.getState().squad.count).toBe(0);
    expect(sim.getState().defenseTank!.status).toBe('breached');
  });
  it('clears at Lv9, cancels shells and excludes the remaining enemies from direct kills; final stats freeze', () => {
    const sim = active(3); step(sim); const s = sim.getState(); s.defenseTank!.hp = 1;
    s.grenade!.flight = { startX: 0, startZ: 0, targetX: 0, targetZ: s.defenseTank!.z,
      startedAtSeconds: s.elapsedSeconds, flightSeconds: 1 / 60, damageEnemyHp: 9, blastRadius: 4 };
    const kills = combatResults(s.combatStats!, 0).totalKills; sim.restoreState(s); step(sim);
    const final = sim.getState(); expect(final.progression!.level).toBe(9); expect(final.defenseTank!.status).toBe('defeated');
    expect(final.enemies).toHaveLength(0); expect(final.projectiles).toHaveLength(0); expect(final.artillery!.shells).toHaveLength(0);
    expect(combatResults(final.combatStats!, 0).totalKills).toBe(kills);
    sim.restoreState(final); step(sim, 120); expect(sim.getState()).toEqual(final);
    expect(sim.launchArtillery({ source: { id: 'test', type: 'destroyer', position: { x: 0, y: 2, z: 52 } } })).toBeNull();
  });
  it.each(['entering', 'active', 'cooldown', 'previous-phase2', 'previous-phase3'] as const)('checkpoints %s with deterministic continuation and rejects malformed tank data transactionally', stage => {
    const sim = stage === 'entering' ? fixture() : active(stage === 'previous-phase3' ? 3 : 2), savedConfig = structuredClone(config);
    savedConfig.catharsis!.defenseTank = structuredClone(tankConfig);
    if (stage === 'previous-phase2') {
      const old = sim.getState(), phase = old.catharsis!.balance.defenseTank!.phases[1];
      Object.assign(phase, { heaviesPerLane: 4, flankIntervalSeconds: 3.5, giantIntervalSeconds: 9 });
      savedConfig.catharsis!.defenseTank!.phases[1] = structuredClone(phase);
      sim.restoreState(old);
    }
    if (stage === 'previous-phase3') {
      const old = sim.getState(); old.catharsis!.balance.defenseTank!.phases[2].speedUnitsPerSecond = .36;
      savedConfig.catharsis!.defenseTank!.phases[2].speedUnitsPerSecond = .36;
      sim.restoreState(old);
    }
    suppressFire(sim); step(sim);
    if (stage === 'cooldown') step(sim, 105);
    const s = sim.getState(), c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
      savedAt: 1, build: 'tank', paused: true, hidden: false, reason: 'pause', fixture: null,
      config: savedConfig, level, tuning: defaultRuntimeTuning(savedConfig, level), state: s };
    const map = new Map<string, string>(), storage = { getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
    expect(writeCheckpoint(c, storage).ok).toBe(true); expect(map.has(CHECKPOINT_KEY)).toBe(true);
    const found = readCheckpoint(storage); expect(found.status).toBe('valid'); if (found.status !== 'valid') throw Error('Invalid checkpoint');
    const replay = simulationFromCheckpoint(found.checkpoint); expect(replay.getState()).toEqual(s);
    expect(replay.getState().catharsis!.balance.defenseTank!.salvoPolicy).toBeUndefined();
    expect(replay.getState().defenseTank!.rhythm).toBeUndefined();
    expect(replay.getState().catharsis!.balance.defenseTank!.phases[1]).toEqual(savedConfig.catharsis!.defenseTank!.phases[1]);
    if (stage === 'previous-phase2') {
      expect(replay.getState().enemies.filter(e => e.archetype === 'heavy')).toHaveLength(8);
      expect(replay.getState().defenseTank!.nextFlankAtSeconds).toBe(33.5);
      expect(replay.getState().defenseTank!.nextGiantAtSeconds).toBe(replay.getState().elapsedSeconds + 9);
    }
    expect(replay.consumeArtilleryEvents()).toEqual([]);
    sim.consumeArtilleryEvents();
    for (let i = 0; i < 240; i++) { step(sim); step(replay); expect(replay.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents()); }
    expect(replay.getState()).toEqual(sim.getState());
    if (stage === 'previous-phase3') {
      expect(replay.getState().catharsis!.balance.defenseTank!.phases[2].speedUnitsPerSecond).toBe(.36);
      expect(s.defenseTank!.z - replay.getState().defenseTank!.z).toBeCloseTo(.36 * 4, 7);
    }
    const before = replay.getState(), bad = structuredClone(before); bad.defenseTank!.hp = -1;
    expect(() => replay.restoreState(bad)).toThrow(); expect(replay.getState()).toEqual(before);
  });
  it('reports exact totals, bullet-only accuracy, zero-shot accuracy and readable clear time', () => {
    const stats = { gruntKills: 5, heavyKills: 3, giantKills: 1, shotsFired: 100, shotsHit: 35, grenadesUsed: 20 };
    expect(combatResults(stats, 90).totalKills).toBe(9); expect(combatResults(stats, 90).accuracy).toBe(.35);
    expect(clearResultRows(stats, 90)).toContainEqual(['通關時間', '1:30.0']);
    expect(clearResultRows(stats, 90)).toContainEqual(['命中率', '35.0%']);
    expect(clearResultRows(stats, 90).map(row => row[0])).toEqual(['通關時間', '擊殺總數', '一般兵／重裝兵／巨人兵',
      '發射子彈', '命中子彈', '命中率', '使用手榴彈']);
    expect(combatResults({ ...stats, shotsFired: 0, shotsHit: 0 }, 0).accuracy).toBe(0);
  });
});
