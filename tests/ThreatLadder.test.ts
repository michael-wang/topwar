import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from './helpers/ReviewFixtures';
import { Simulation } from '../src/simulation/Simulation';
import { laneCompositionForRow, laneWave } from '../src/simulation/enemies/laneComposition';
import { pressureGroupSize, pressureWaveSettings } from '../src/simulation/enemies/latePressure';
import { pilotTuning } from '../scripts/qa/p15Pilot';

const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const options = { seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1,
  startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: config.track.halfWidth } };
const step = (sim: Simulation, ticks = 1) => { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, pilotTuning); };

it.each([[4, 63, 24, 4, 38], [5, 55, 30, 3, 44], [6, 0, 60, 3, 74]])(
  'authors exact Lv%i composition without changing total population or HP', (level, xp, population, fronts, debt) => {
    const authored = { ...balance, ...pressureWaveSettings(balance, { level, xp }), groupSize: pressureGroupSize(balance, level) };
    for (const seed of [1, 17, 42]) for (let wave = 0; wave < 12; wave++) {
      const group = laneCompositionForRow(wave * balance.waveRows, seed, authored, 3.2);
      expect(group).toHaveLength(population);
      expect(new Set(group.map(e => e.lane)).size).toBe(fronts);
      expect(group.filter(e => e.archetype === 'heavy')).toHaveLength(1);
      expect(group.reduce((sum, e) => sum + (e.archetype === 'heavy' ? balance.heavyHp : 1), 0)).toBe(debt);
      const heavy = group.find(e => e.archetype === 'heavy')!;
      expect(group.filter(e => e.lane === heavy.lane && e.archetype === 'grunt')
        .every(e => e.z >= heavy.z + balance.heavyFrontClearance)).toBe(true);
    }
  });

it('rotates Heavy lanes across waves and fills each front before repeating a lane', () => {
  const authored = { ...balance, pressureLaneCount: 3, heavyCount: 1 };
  const lanes = [0, 1, 2].map(wave => laneCompositionForRow(wave * balance.waveRows, 17, authored, 3.2)
    .find(e => e.archetype === 'heavy')!.lane);
  expect(new Set(lanes).size).toBe(3);
  expect(lanes).toEqual(laneWave(0, 17, authored).lanes);
  for (const count of [0, 2, 3, 5]) {
    const group = laneCompositionForRow(0, 17, { ...authored, heavyCount: count }, 3.2);
    const heavies = group.filter(e => e.archetype === 'heavy');
    expect(heavies).toHaveLength(count);
    expect(new Set(heavies.map(e => e.lane)).size).toBe(Math.min(3, count));
  }
});

it('preserves old chance-authored phases and rejects ambiguous/oversized counts', () => {
  const old = { ...balance, pressureRamp: { lv4: { xpFraction: .35, pressureLaneCount: 4, heavyChance: .35 },
    lv5: { xpFraction: .25, pressureLaneCount: 4, heavyChance: .5 } } };
  expect(GameConfigSchema.parse({ ...data, catharsis: old }).catharsis!.pressureRamp).toEqual(old.pressureRamp);
  expect(pressureWaveSettings(old, { level: 5, xp: 55 })).toEqual({ pressureLaneCount: 4, heavyChance: .5 });
  expect(pressureGroupSize(old, 6)).toBe(32);
  for (const patch of [{ heavyCount: 25 }, { heavyChance: .5 }, { heavyCount: -1 }, { heavyCount: 1.5 }]) {
    const bad = structuredClone(data); Object.assign(bad.catharsis.pressureRamp.lv4, patch);
    expect(() => GameConfigSchema.parse(bad)).toThrow();
  }
  expect(pressureGroupSize(balance, 7)).toBe(35);
  expect(pressureWaveSettings(balance, { level: 7, xp: 0 }).heavyCount).toBeUndefined();
});

it('admits one shoreline release on real evolution; snapshots, survivors and consumed row continue identically', () => {
  const sim = createDevReviewFixture(options, config.weapon.rifle.fireRate, 'evolve');
  const initial = sim.getState(), restored = new Simulation(options);
  restored.restoreState(JSON.parse(JSON.stringify(initial)));
  while (sim.getState().progression!.level === 5) { step(sim); step(restored); }
  const evolved = sim.getState(); expect(restored.getState()).toEqual(evolved);
  const released = evolved.enemies.filter(e => e.id >= initial.enemyStream!.nextEnemyId);
  expect(released).toHaveLength(60); expect(released.filter(e => e.archetype === 'heavy')).toHaveLength(1);
  expect(new Set(released.map(e => e.lane)).size).toBe(3);
  expect(released.every(e => e.z - evolved.player.z >= 38 && e.z - evolved.player.z <= 47)).toBe(true);
  expect(evolved.enemies.some(e => e.id < initial.enemyStream!.nextEnemyId)).toBe(true);
  expect(evolved.machineGunReleaseAtSeconds).toBe(evolved.elapsedSeconds);
  expect(evolved.enemyStream!.nextRowIndex % balance.waveRows).toBe(1);
  restored.restoreState(JSON.parse(JSON.stringify(evolved)));
  step(sim, 180); step(restored, 180);
  expect(restored.getState()).toEqual(sim.getState());
  expect(sim.getState().enemyStream!.nextEnemyId).toBe(initial.enemyStream!.nextEnemyId + 60);
  expect(sim.consumePresentationEvents()).toEqual([]);
  expect(new Simulation(options).getState().machineGunReleaseAtSeconds).toBeNull();
});

it('migrates older Lv6 snapshots without injecting a release and validates the new clock', () => {
  const sim = createDevReviewFixture(options, 3, 'machineGun'), old = sim.getState();
  delete old.machineGunReleaseAtSeconds; sim.restoreState(old);
  expect(sim.getState().machineGunReleaseAtSeconds).toBe(0);
  for (const clock of [-1, NaN, Infinity, 1]) {
    const bad = sim.getState(); bad.machineGunReleaseAtSeconds = clock;
    expect(() => sim.restoreState(bad)).toThrow();
  }
});

it('consumes the immediate group row and resumes ordinary sixty-person groups at six-second cadence', () => {
  const sim = createDevReviewFixture(options, 3, 'evolve'), start = sim.getState();
  start.enemyStream!.nextRowIndex = 30;
  start.defenseWaves = { nextAtSeconds: balance.defenseWaves.firstWaveDelaySeconds }; sim.restoreState(start);
  while (sim.getState().progression!.level === 5) step(sim);
  const released = sim.getState(), releasedId = released.enemyStream!.nextEnemyId;
  expect(released.enemyStream!.nextRowIndex).toBe(31);
  released.weapons.rifleMemberCooldowns = [1000]; sim.restoreState(released);
  const admissions: number[] = []; let previousId = releasedId;
  for (let tick = 0; tick < 60 * 20; tick++) {
    step(sim); const state = sim.getState();
    if (state.enemyStream!.nextEnemyId > previousId) {
      expect(state.enemyStream!.nextEnemyId - previousId).toBe(60);
      expect(state.enemies.filter(e => e.id >= previousId && e.archetype === 'heavy')).toHaveLength(1);
      admissions.push(state.elapsedSeconds); previousId = state.enemyStream!.nextEnemyId;
    }
  }
  expect(admissions.length).toBeGreaterThanOrEqual(2);
  expect(admissions[0] - released.elapsedSeconds).toBeGreaterThan(6);
  expect(admissions[1] - admissions[0]).toBeCloseTo(6);
  expect(sim.getState().machineGunReleaseAtSeconds).toBe(released.machineGunReleaseAtSeconds);
});

it('handles Grenade XP overflow with one release while a pending Lv5 Giant survives evolution', () => {
  const sim = createDevReviewFixture(options, 3, 'evolve'), state = sim.getState();
  state.giantEncounter = { scheduledAtSeconds: 3, spawned: false };
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: 1, supply: null, flight: null };
  state.enemies = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, tier: 1,
    archetype: 'grunt', lane: 2, x: 0, z: 10 + index * .03, hp: 1 }));
  state.enemyStream!.nextEnemyId = 31; state.weapons.rifleMemberCooldowns = [1000, 1000, 1000];
  state.weapons.rifleCooldownRemainingSeconds = 1000;
  sim.restoreState(state); sim.step(1 / 60, { targetX: 0, throwGrenade: true }, pilotTuning);
  const snapshot = JSON.parse(JSON.stringify(sim.getState())), restored = new Simulation(options);
  restored.restoreState(snapshot); step(sim, 39); step(restored, 39);
  const evolved = sim.getState(); expect(evolved).toEqual(restored.getState());
  expect(evolved.progression).toEqual({ level: 6, xp: 20 }); expect(evolved.squad.count).toBe(1);
  expect(evolved.enemies).toHaveLength(60); expect(evolved.enemyStream!.nextEnemyId).toBe(91);
  const blast = sim.consumeGrenadeEvents().find(event => event.kind === 'grenadeDetonated');
  expect(blast?.kind === 'grenadeDetonated' && blast.victims.filter(v => v.killed).length).toBe(30);
  expect(evolved.giantEncounter).toEqual({ scheduledAtSeconds: 3, spawned: false });
  step(sim, 140); const introduced = sim.getState();
  expect(introduced.enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
  expect(introduced.enemyStream!.nextEnemyId).toBe(92);
  expect(introduced.machineGunReleaseAtSeconds).toBe(evolved.machineGunReleaseAtSeconds);
});

it('CURVE resets deterministically, crosses Lv5 through XP and schedules Giant on that exact tick', () => {
  const make = () => createDevReviewFixture(options, 3, 'curve');
  const sim = make(), initial = sim.getState();
  expect(initial.progression).toEqual({ level: 4, xp: 150 });
  expect(initial.squad.count).toBe(2); expect(initial.player.selectedLane).toBe(2);
  expect(initial.enemies).toHaveLength(48); expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(2);
  expect(initial.giantEncounter).toEqual({ scheduledAtSeconds: null, spawned: false });
  expect(initial).toEqual(make().getState());
  for (let tick = 0; tick < 1800 && sim.getState().progression!.level === 4; tick++) {
    const state = sim.getState(), nearest = [...state.enemies].sort((a,b) => a.z-b.z || a.id-b.id)[0];
    if (nearest && tick % 12 === 0) while (sim.getState().player.selectedLane !== nearest.lane)
      sim.stepLane(nearest.lane! > sim.getState().player.selectedLane! ? 1 : -1);
    step(sim);
  }
  const lv5 = sim.getState(); expect(lv5.progression!.level).toBe(5); expect(lv5.squad.count).toBe(3);
  expect(lv5.giantEncounter!.scheduledAtSeconds).toBeCloseTo(lv5.elapsedSeconds + 6);
  const restored = new Simulation(options); restored.restoreState(JSON.parse(JSON.stringify(lv5)));
  step(sim, 360); step(restored, 360); expect(restored.getState()).toEqual(sim.getState());
  expect(sim.getState().enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
  const ongoing = sim.getState(); ongoing.progression = { level: 6, xp: 0 };
  ongoing.squad = { ...ongoing.squad, count: 1, rifleCounts: [1] }; ongoing.weapons.rifleMemberCooldowns = [1000];
  sim.restoreState(ongoing); step(sim);
  expect(sim.getState().enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
  const defeated = sim.getState(); defeated.enemies = defeated.enemies.filter(e => e.archetype !== 'giant');
  sim.restoreState(defeated); step(sim, 600);
  expect(sim.getState().enemies.some(e => e.archetype === 'giant')).toBe(false);
  expect(make().getState()).toEqual(initial);
});
