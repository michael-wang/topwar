import { expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createTankReview } from '../src/app/DevTankReview';
import { Simulation } from '../src/simulation/Simulation';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { attackLanePositions } from '../src/simulation/enemies/laneComposition';
import { emptyCommanderSupport, advanceCommanderSupport, validateCommanderSupport } from '../src/simulation/commanderSupport';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 17, level, startSquad: 3, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
function boss(danger = false) {
  const sim = createTankReview(options, config.weapon.rifle.fireRate, 'boss-phase2'), s = sim.getState();
  s.weapons.rifleMemberCooldowns = Array(s.squad.count).fill(100); s.weapons.rifleCooldownRemainingSeconds = 100;
  s.commanderSupport!.giantSeen = true;
  if (danger) {
    // Isolate support accounting from player shots, scheduled admissions and shell damage.
    s.defenseTank!.startedAtSeconds = 50; s.defenseTank!.activeAtSeconds = 52.5;
    s.defenseTank!.nextFlankAtSeconds = 100; s.defenseTank!.nextGiantAtSeconds = 100;
    s.defenseTank!.nextAttackAtSeconds = 100;
    const lanes = attackLanePositions(5, config.track.halfWidth, config.catharsis!.edgeInset);
    for (const lane of [0, 4]) for (let i = 0; i < 20; i++) s.enemies.push({
      id: s.enemyStream!.nextEnemyId++, tier: 1, lane, x: lanes[lane], z: 12 + i * .15,
      archetype: 'heavy', hp: config.catharsis!.heavyHp, bossFlankSpeedUnitsPerSecond: 1.7 });
    s.enemies.push({ id: s.enemyStream!.nextEnemyId++, tier: 1, lane: 2, x: 0, z: 15, archetype: 'grunt', hp: 1 });
  }
  sim.restoreState(s); return sim;
}
function step(sim: Simulation, ticks: number) { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning); }
function recover(sim: Simulation) {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; }, removeItem: () => { stored = null; } };
  const cp: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense', savedAt: 1,
    build: 'commander', paused: true, hidden: false, reason: 'pause', fixture: null, config, level,
    tuning: defaultRuntimeTuning(config, level), state: sim.getState() };
  expect(writeCheckpoint(cp, storage).ok).toBe(true);
  const result = readCheckpoint(storage); expect(result.status).toBe('valid');
  if (result.status !== 'valid') throw Error('Invalid checkpoint');
  return simulationFromCheckpoint(result.checkpoint);
}

it('announces the actual first Giant spawn, once per attempt, without guessing the unlock level', () => {
  const sim = new Simulation(options), s = sim.getState();
  s.progression = { level: 4, xp: 0 }; s.enemies = []; s.defenseWaves!.nextAtSeconds = 100;
  s.weapons.rifleMemberCooldowns = [100, 100, 100]; s.weapons.rifleCooldownRemainingSeconds = 100;
  sim.restoreState(s); step(sim, 1);
  if (config.catharsis!.giant.introDelaySeconds > 0) expect(sim.getState().commanderSupport!.giantAtSeconds).toBeNull();
  step(sim, Math.ceil(config.catharsis!.giant.introDelaySeconds * 60));
  const seen = sim.getState(); expect(seen.giantEncounter!.spawned).toBe(true);
  expect(seen.enemies.some(e => e.archetype === 'giant')).toBe(true);
  expect(seen.commanderSupport!.giantAtSeconds).toBeCloseTo(seen.elapsedSeconds);
  const restored = recover(sim); step(sim, 20); step(restored, 20);
  expect(restored.getState()).toEqual(sim.getState());
  expect(sim.getState().commanderSupport!.giantAtSeconds).toBe(seen.commanderSupport!.giantAtSeconds);
  expect(new Simulation(options).getState().commanderSupport!.giantSeen).toBe(false);
});

it('requires an active phase 2/3 Boss and Heavy/Giant danger in both flanks, after the introduction', () => {
  const s = boss(true).getState(), c = config.catharsis!.commanderSupport!;
  for (const block of ['phase1', 'entering', 'intro', 'one-flank', 'distant'] as const) {
    const frame = structuredClone(s); frame.commanderSupport = emptyCommanderSupport(true, true);
    if (block === 'phase1') frame.defenseTank!.phase = 1;
    if (block === 'entering') frame.defenseTank!.status = 'entering';
    if (block === 'intro') frame.defenseTank!.startedAtSeconds = frame.elapsedSeconds;
    if (block === 'one-flank') frame.enemies = frame.enemies.filter(e => e.lane !== 4);
    if (block === 'distant') frame.enemies.forEach(e => e.z = 25);
    advanceCommanderSupport(frame, c, frame.commanderSupport);
    expect(frame.commanderSupport.airstrike!.status).toBe('ready');
  }
  advanceCommanderSupport(s, c, s.commanderSupport!);
  expect(s.commanderSupport!.airstrike).toMatchObject({ status: 'waiting', triggeredAtSeconds: 60, bombAtSeconds: 61.25 });
});

it('clears 80% of each flank nearest-first in three volleys without XP, kills, Boss damage or schedule changes', () => {
  const sim = boss(true), before = sim.getState(); step(sim, 1);
  const pending = sim.getState().commanderSupport!.airstrike!;
  expect(pending.targets).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), ...Array.from({ length: 16 }, (_, i) => i + 21)]);
  step(sim, 120); const after = sim.getState();
  expect(after.commanderSupport!.airstrike).toMatchObject({ status: 'completed', strikesCompleted: 3, targets: [] });
  for (const lane of [0, 4]) expect(after.enemies.filter(e => e.lane === lane)).toHaveLength(4);
  expect(after.enemies.filter(e => e.lane === 2).map(e => e.id)).toEqual([41]);
  expect(after.progression).toEqual(before.progression); expect(after.combatStats).toEqual(before.combatStats);
  expect(after.defenseTank!.hp).toBe(before.defenseTank!.hp);
  expect(after.defenseTank!.nextFlankAtSeconds).toBe(before.defenseTank!.nextFlankAtSeconds);
  expect(after.defenseTank!.nextAttackAtSeconds).toBe(before.defenseTank!.nextAttackAtSeconds);
  expect(after.grenade).toEqual(before.grenade); expect(after.artillery).toEqual(before.artillery);
  const events = sim.consumeSupportEvents(); expect(events.filter(e => e.kind === 'supportBomb')).toHaveLength(3);
  expect(events.filter(e => e.kind === 'supportFlyover')).toHaveLength(1);
  step(sim, 120); expect(sim.consumeSupportEvents()).toEqual([]);
});

it.each([1, 80, 101, 120])('restores after %i ticks and executes only remaining strikes', ticks => {
  const sim = boss(true); step(sim, ticks); sim.consumeSupportEvents(); const restored = recover(sim);
  expect(restored.consumeSupportEvents()).toEqual([]);
  const frozen = restored.getState(); expect(restored.getState()).toEqual(frozen); // No wall-clock advancement during Pause.
  step(sim, 125); step(restored, 125);
  expect(restored.getState()).toEqual(sim.getState()); expect(restored.consumeSupportEvents()).toEqual(sim.consumeSupportEvents());
});

it('naturally triggers from the accepted phase-2 spawn distance, interval and speed before troops reach the line', () => {
  const sim = boss(); let warnedAt: number | null = null;
  for (let tick = 0; tick < 11 * 60; tick++) {
    step(sim, 1); const s = sim.getState();
    if (s.commanderSupport!.airstrike!.status === 'waiting') { warnedAt = s.elapsedSeconds; break; }
  }
  expect(warnedAt).not.toBeNull(); expect(warnedAt! - 60).toBeCloseTo((28 - 14) / 1.7, 1);
  expect(sim.getState().squad.count).toBeGreaterThan(0);
  expect(sim.getState().defenseTank!.hp).toBe(4225);
});

it('keeps historical embedded settings and does not arm retroactive support on restore', () => {
  const sim = boss(true), s = sim.getState(); delete s.catharsis!.balance.commanderSupport; delete s.commanderSupport;
  sim.restoreState(s); expect(sim.getState().catharsis!.balance.commanderSupport).toBeUndefined();
  step(sim, 120); expect(sim.consumeSupportEvents()).toEqual([]);
  expect(sim.getState().commanderSupport).toBeUndefined();
  const missingState = boss(true).getState(); delete missingState.commanderSupport;
  sim.restoreState(missingState); step(sim, 1); expect(sim.getState().commanderSupport).toBeUndefined();
});

it.each(['defeated', 'game-over'] as const)('cancels remaining strikes after %s', outcome => {
  const s = boss(true).getState(), c = config.catharsis!.commanderSupport!;
  advanceCommanderSupport(s, c, s.commanderSupport!);
  s.elapsedSeconds += 2;
  if (outcome === 'defeated') s.defenseTank!.status = 'defeated'; else s.squad.count = 0;
  const ids = s.enemies.map(e => e.id);
  expect(advanceCommanderSupport(s, c, s.commanderSupport!)).toEqual([]);
  expect(s.enemies.map(e => e.id)).toEqual(ids); expect(s.commanderSupport!.airstrike!.status).toBe('cancelled');
  expect(validateCommanderSupport(s.commanderSupport, c, s.elapsedSeconds)).toEqual(s.commanderSupport);
});

it('rejects corrupt timing or duplicate target IDs transactionally', () => {
  const sim = boss(true); step(sim, 1); const before = sim.getState();
  for (const corrupt of ['clock', 'targets'] as const) {
    const s = structuredClone(before);
    if (corrupt === 'clock') s.commanderSupport!.airstrike!.bombAtSeconds! += 1;
    else s.commanderSupport!.airstrike!.targets.push(s.commanderSupport!.airstrike!.targets[0]);
    expect(() => sim.restoreState(s)).toThrow(); expect(sim.getState()).toEqual(before);
  }
});
