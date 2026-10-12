import { expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { readCheckpoint, simulationFromCheckpoint, writeCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
function step(sim: Simulation, ticks = 1) {
  for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning);
}
function until(sim: Simulation, age: number) {
  const frame = sim.getFrameState();
  step(sim, Math.max(0, Math.ceil((frame.machineGunReleaseAtSeconds! + age - frame.elapsedSeconds) * 60 - 1e-7)));
  expect(sim.getFrameState().elapsedSeconds).toBeCloseTo(frame.machineGunReleaseAtSeconds! + age, 7);
}
// Real Lv5 -> Lv6 kill/evolution, then quiet weapons so admission assertions
// don't depend on aiming, casualties or incidental XP during these short windows.
function evolution(c = config) {
  const sim = new Simulation({ seed: 17, level, startSquad: 3, startRocketCount: 0,
    tiers: c.tiers, catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } });
  const s = sim.getState();
  s.progression = { level: 5, xp: 219 }; s.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: s.player.x, z: 10, hp: 1 }];
  s.enemyStream!.nextEnemyId = 2;
  s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: 1, flight: null, supply: null };
  s.weapons.rifleCooldownRemainingSeconds = 100; s.weapons.rifleMemberCooldowns = [100, 100, 100];
  sim.restoreState(s); sim.step(1 / 60, { targetX: 0, throwGrenade: true }, tuning);
  for (let i = 0; i < 60 && sim.getFrameState().progression!.level === 5; i++) step(sim);
  expect(sim.getFrameState().progression!.level).toBe(6);
  const evolved = sim.getState();
  evolved.weapons.rifleCooldownRemainingSeconds = 100; evolved.weapons.rifleMemberCooldowns = [100];
  evolved.projectiles = []; sim.restoreState(evolved);
  return sim;
}

it('hands Carnival to AHEAD at +3.2, first mixed wave at +4.2, with no extra waves or naval timing change', () => {
  const sim = evolution(), initial = sim.getState(), release = initial.machineGunReleaseAtSeconds!;
  expect(initial.enemies).toHaveLength(60); expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(1);
  until(sim, 2 - 1 / 60); expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(initial.enemyStream!.nextEnemyId);
  until(sim, 2);
  const carnival = sim.getState(), grunts = carnival.enemies.filter(e => e.id >= initial.enemyStream!.nextEnemyId);
  expect(grunts).toHaveLength(20); expect(grunts.every(e => e.archetype === 'grunt')).toBe(true);
  until(sim, 3.2 - 1 / 60); expect(sim.getFrameState().postCapSurvival!.startedAtSeconds).toBeNull();
  until(sim, 3.2);
  const handoff = sim.getState(), nextId = handoff.enemyStream!.nextEnemyId;
  expect(nextId).toBe(carnival.enemyStream!.nextEnemyId);
  expect(handoff.carnival).toMatchObject({ status: 'complete', elapsedSeconds: 3.2, nextWaveIndex: 1 });
  expect(handoff.levelEncounters).toMatchObject({ ordinaryEnabled: true, survivalEnabled: true });
  expect(handoff.navalPresence!.status).toBe('stationed');
  expect(handoff.postCapSurvival!.startedAtSeconds).toBeCloseTo(release + 3.2, 7);
  expect(handoff.defenseWaves!.nextAtSeconds).toBeCloseTo(release + 4.2, 7);
  until(sim, 4.2 - 1 / 60); expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(nextId);
  until(sim, 4.2);
  const first = sim.getState(), wave = first.enemies.filter(e => e.id >= nextId);
  expect(wave).toHaveLength(30); expect(wave.filter(e => e.archetype === 'heavy')).toHaveLength(4);
  expect(wave.filter(e => e.archetype === 'grunt')).toHaveLength(26);
  expect(new Set(wave.map(e => e.lane)).size).toBe(3);
  expect(first.defenseWaves!.nextAtSeconds).toBeCloseTo(release + 10.2, 7);
  until(sim, 8.5); expect(sim.getFrameState().navalBarrage!.enabled).toBe(true);
  expect(sim.getFrameState().navalBarrage!.enabledAtSeconds).toBeCloseTo(release + 8.5, 7);
  until(sim, 10.5 - 1 / 60); expect(sim.consumeArtilleryEvents()).toEqual([]);
  expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(nextId + 60);
  until(sim, 10.5);
  const launches = sim.consumeArtilleryEvents().filter(e => e.kind === 'artilleryLaunch');
  expect(launches.length).toBeGreaterThan(0);
  expect(launches.every(e => Math.abs(e.shell.launchedAtSeconds - release - 10.5) < 1e-7)).toBe(true);
});

it.each([[7, 0, 30, 4, 3, 1], [8, 0, 42, 11, 4, 1.4], [8, 245, 42, 11, 5, 1.6]])(
  'retains Lv%i / XP %i profiles for the first AHEAD admission', (playerLevel, xp, count, heavies, lanes, speed) => {
    const sim = evolution(); until(sim, 3.2);
    const s = sim.getState(); s.progression = { level: playerLevel, xp };
    const nextId = s.enemyStream!.nextEnemyId, deadline = s.defenseWaves!.nextAtSeconds;
    sim.restoreState(s); until(sim, 4.2 - 1 / 60);
    expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(nextId);
    expect(sim.getFrameState().defenseWaves!.nextAtSeconds).toBe(deadline);
    until(sim, 4.2);
    const wave = sim.getFrameState().enemies.filter(e => e.id >= nextId);
    expect(wave).toHaveLength(count); expect(wave.filter(e => e.archetype === 'heavy')).toHaveLength(heavies);
    expect(new Set(wave.map(e => e.lane)).size).toBe(lanes);
    expect(wave.every(e => (e.survivalSpeedMultiplier ?? 1) === speed)).toBe(true);
    expect(sim.getFrameState().defenseWaves!.nextAtSeconds).toBeCloseTo(deadline + 6, 7);
  });

it('lets Lv9 Tank take over the pending AHEAD wave and naval fire', () => {
  const sim = evolution(); until(sim, 4.2 - 1 / 60);
  const s = sim.getState(); s.progression = { level: 9, xp: 0 };
  s.squad = { count: 2, rocketCount: 0, rifleCounts: [2], rifleRemainder: 0 };
  s.weapons.rifleMemberCooldowns = [100, 100]; sim.restoreState(s);
  const nextId = s.enemyStream!.nextEnemyId; step(sim);
  expect(sim.getFrameState().defenseTank).toMatchObject({ status: 'entering', hp: 6500 });
  expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(nextId);
  expect(sim.getFrameState().levelEncounters!.ordinaryEnabled).toBe(false);
  expect(sim.getFrameState().navalBarrage!.enabled).toBe(false);
  step(sim, 150);
  expect(sim.getFrameState().defenseTank!.status).toBe('active');
  const flanks = sim.getFrameState().enemies.filter(e => e.id >= nextId);
  expect(flanks).toHaveLength(8); expect(flanks.every(e => e.lane === 0 || e.lane === 4)).toBe(true);
});

it.each(['current', 'previous'] as const)('restores the %s embedded Carnival / handoff schedule through Checkpoint', policy => {
  const savedConfig = structuredClone(config);
  if (policy === 'previous') {
    savedConfig.catharsis!.carnival.durationSeconds = 24;
    const when = savedConfig.catharsis!.levelEncounters!.triggers.find(t => t.id === 'survival-handoff')!.when;
    if (when.kind !== 'machineGunRelease') throw Error('Wrong handoff anchor');
    when.delaySeconds = 27;
  }
  const sim = evolution(savedConfig); until(sim, 3.2);
  const saved: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
    build: 'handoff', savedAt: 0, paused: true, hidden: false, reason: 'pause', fixture: null,
    config: savedConfig, level, tuning: defaultRuntimeTuning(savedConfig, level), state: sim.getState() };
  let text: string | null = null;
  const storage = { getItem: () => text, setItem: (_key: string, value: string) => { text = value; }, removeItem: () => { text = null; } };
  expect(writeCheckpoint(saved, storage).ok).toBe(true);
  const found = readCheckpoint(storage); expect(found.status).toBe('valid');
  if (found.status !== 'valid') throw Error(found.status);
  const clone = simulationFromCheckpoint(found.checkpoint);
  expect(clone.getState()).toEqual(sim.getState());
  expect(clone.getFrameState().catharsis!.balance).toEqual(savedConfig.catharsis);
  expect(clone.consumeArtilleryEvents()).toEqual([]);
  if (policy === 'previous') {
    until(clone, 8.5); clone.commandEncounter('barrageOff'); // Isolate saved admission clocks from later combat casualties.
    until(clone, 24); expect(clone.getFrameState().carnival!.status).toBe('complete');
    until(clone, 27 - 1 / 60); expect(clone.getFrameState().postCapSurvival!.startedAtSeconds).toBeNull();
    until(clone, 27);
  }
  const start = clone.getFrameState().machineGunReleaseAtSeconds!, handoff = policy === 'previous' ? 27 : 3.2;
  expect(clone.getFrameState().postCapSurvival!.startedAtSeconds).toBeCloseTo(start + handoff, 7);
  const nextId = clone.getFrameState().enemyStream!.nextEnemyId;
  until(clone, handoff + 1);
  expect(clone.getFrameState().enemyStream!.nextEnemyId - nextId).toBe(30);
});
