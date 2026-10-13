import { expect, it } from 'vitest';
import shipping from './helpers/ShippingConfig';
// Released C4 six-round checkpoints retain their embedded phase-2 trigger and three Tank hits.
const config = structuredClone(shipping);
delete config.catharsis!.commanderSupport!.heavyRaid!.lastStand;
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createAirSupportPlaytest } from '../src/app/TankPlaytest';
import { Simulation } from '../src/simulation/Simulation';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 17, level, startSquad: 3, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
function raid() {
  const sim = createAirSupportPlaytest(options, config.weapon.rifle.fireRate), s = sim.getState();
  s.defenseTank!.hp = 4225; s.defenseTank!.phase = 2;
  s.weapons.rifleMemberCooldowns = Array(s.squad.count).fill(100); s.weapons.rifleCooldownRemainingSeconds = 100;
  s.defenseTank!.nextAttackAtSeconds = 1000; s.defenseTank!.nextFlankAtSeconds = 1000; s.defenseTank!.nextGiantAtSeconds = 1000;
  s.artillery = { version: 1, nextId: 1, shells: [] };
  // Also verify central infantry and untouched inner flanks with real enemy wire state.
  for (const lane of [1, 2, 3]) s.enemies.push({ id: s.enemyStream!.nextEnemyId++, tier: 1, lane, x: lane - 2, z: 24, archetype: 'heavy', hp: config.catharsis!.heavyHp });
  sim.restoreState(s); return sim;
}
function step(sim: Simulation, ticks: number) { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: sim.getState().player.x }, tuning); }
function recover(sim: Simulation) {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, v: string) => { stored = v; }, removeItem: () => { stored = null; } };
  const cp: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense', savedAt: 1,
    build: 'raid', paused: true, hidden: false, reason: 'pause', fixture: 'air-support', config, level,
    tuning: defaultRuntimeTuning(config, level), state: sim.getState() };
  expect(writeCheckpoint(cp, storage).ok).toBe(true); const result = readCheckpoint(storage);
  expect(result.status).toBe('valid'); if (result.status !== 'valid') throw Error('Invalid raid checkpoint');
  return simulationFromCheckpoint(result.checkpoint);
}
it('waits for the full 6.766s voice, clears flank infantry, severely damages Giants and hits the Tank three distinct times', () => {
  const sim = raid(), before = sim.getState(); step(sim, 450);
  expect(sim.consumeSupportEvents()).toEqual([]); expect(sim.getState().defenseTank!.hp).toBe(4225);
  step(sim, 1); let s = sim.getState(); expect(s.commanderSupport!.airstrike!.strikesCompleted).toBe(1);
  expect(s.enemies.some(e => e.lane === 0 && e.archetype === 'heavy')).toBe(false);
  expect(s.enemies.find(e => e.lane === 0 && e.archetype === 'giant')!.hp).toBe(config.catharsis!.giant.hp);
  step(sim, 39); s = sim.getState(); expect(s.commanderSupport!.airstrike!.strikesCompleted).toBe(2);
  expect(s.enemies.some(e => e.lane === 4 && e.archetype !== 'giant')).toBe(false);
  expect(s.enemies.find(e => e.lane === 0 && e.archetype === 'giant')!.hp).toBeCloseTo(config.catharsis!.giant.hp * .15);
  step(sim, 39); expect(sim.getState().defenseTank!.hp).toBe(4225);
  for (const hp of [3725, 3225, 2725]) { step(sim, 39); expect(sim.getState().defenseTank!.hp).toBe(hp); }
  s = sim.getState(); expect(s.commanderSupport!.airstrike!.status).toBe('completed');
  expect(s.enemies.some(e => e.lane === 2)).toBe(false); expect(s.enemies.filter(e => e.lane === 1 || e.lane === 3)).toHaveLength(2);
  expect(s.progression).toEqual(before.progression); expect(s.combatStats).toEqual(before.combatStats);
  expect(s.grenade).toEqual(before.grenade); expect(s.defenseTank!.nextFlankAtSeconds).toBe(before.defenseTank!.nextFlankAtSeconds);
  expect(sim.consumeSupportEvents().filter(e => e.kind === 'supportBomb').map(e => e.tankDamage)).toEqual([0, 0, 0, 500, 500, 500]);
  step(sim, 120); expect(sim.consumeSupportEvents()).toEqual([]);
});
it.each([1, 451, 490, 529, 568, 607, 646])('restores at tick %i with only remaining damage, clocks and bounded visual anchors', tick => {
  const sim = raid(); step(sim, tick); sim.consumeSupportEvents(); const copy = recover(sim);
  expect(copy.consumeSupportEvents()).toEqual([]); step(sim, 650 - tick); step(copy, 650 - tick);
  expect(copy.getState()).toEqual(sim.getState()); expect(copy.consumeSupportEvents()).toEqual(sim.consumeSupportEvents());
});
it('bombs near-to-far spatial bands rather than silently removing an entire lane at the first impact', () => {
  const sim = raid(), s = sim.getState();
  const far = s.enemyStream!.nextEnemyId++, beyond = s.enemyStream!.nextEnemyId++;
  s.enemies.push({ id: far, tier: 1, archetype: 'heavy', hp: 15, lane: 0, x: -4, z: 48, bossFlankSpeedUnitsPerSecond: 1.7 },
    { id: beyond, tier: 1, archetype: 'heavy', hp: 15, lane: 4, x: 4, z: 65, bossFlankSpeedUnitsPerSecond: 1.7 });
  sim.restoreState(s); step(sim, 451); const near = sim.consumeSupportEvents();
  expect(near).toHaveLength(1); expect(near[0].kind === 'supportBomb' && near[0].blasts.map(p => p.z))
    .toEqual([7, sim.getState().commanderSupport!.airstrike!.tankZAtWarning! / 6, 7]);
  expect(sim.getState().enemies.some(e => e.id === far)).toBe(true);
  step(sim, 39); expect(sim.getState().enemies.some(e => e.id === far)).toBe(true);
  step(sim, 39); expect(sim.getState().enemies.some(e => e.id === far)).toBe(false);
  expect(sim.getState().enemies.some(e => e.id === beyond)).toBe(true); expect(sim.getState().defenseTank!.hp).toBe(4225);
});
it('never heals an already wounded Giant, switches Boss phase, and uses the existing clear boundary when a bomb is lethal', () => {
  const sim = raid(), s = sim.getState(); s.enemies.find(e => e.archetype === 'giant')!.hp = config.catharsis!.giant.hp * .1;
  s.defenseTank!.hp = 2400; s.defenseTank!.phase = 2; sim.restoreState(s); step(sim, 568);
  expect(sim.getState().defenseTank).toMatchObject({ hp: 1900, phase: 3 });
  expect(sim.getState().enemies.some(e => e.lane === 0 && e.archetype === 'giant')).toBe(false);
  const low = sim.getState(); low.defenseTank!.hp = 200; sim.restoreState(low);
  step(sim, 39); const done = sim.getState(); expect(done.defenseTank).toMatchObject({ hp: 0, status: 'defeated' });
  expect(done.enemies).toEqual([]); expect(done.artillery!.shells).toEqual([]);
  expect(done.commanderSupport!.airstrike!.status).toBe('cancelled'); expect(done.combatStats).toEqual(s.combatStats);
  const frozen = done; step(sim, 300); expect(sim.getState()).toEqual(frozen);
});
it.each([2, 3] as const)('naturally warns and finishes before flank troops reach the line in phase %i', phase => {
  const sim = raid(), s = sim.getState(), c = config.catharsis!.defenseTank!;
  s.enemies = []; s.defenseTank!.hp = c.hp * (phase === 2 ? .65 : .3); s.defenseTank!.phase = phase;
  s.defenseTank!.nextFlankAtSeconds = s.elapsedSeconds; sim.restoreState(s);
  let warned: number | null = null;
  for (let i = 0; i < 14 * 60; i++) {
    step(sim, 1); const now = sim.getState();
    if (now.commanderSupport!.airstrike!.triggeredAtSeconds !== null) warned ??= now.elapsedSeconds;
    if (now.commanderSupport!.airstrike!.status === 'completed') {
      expect(now.squad.count).toBe(s.squad.count); expect(now.enemies.every(e => e.z > 0)).toBe(true); break;
    }
  }
  expect(warned! - 60).toBeCloseTo((28 - 25) / c.phases[phase - 1].heavySpeedUnitsPerSecond!, 1);
  expect(sim.getState().commanderSupport!.airstrike!.status).toBe('completed');
});
it('does not launch pending raid damage after Game Over and rearms only a fresh attempt', () => {
  const sim = raid(); step(sim, 1); const s = sim.getState(); s.squad.count = 0; s.squad.rifleCounts = [];
  s.weapons.rifleMemberCooldowns = []; sim.restoreState(s); step(sim, 600);
  expect(sim.consumeSupportEvents()).toEqual([]); expect(sim.getState().defenseTank!.hp).toBe(4225);
  expect(new Simulation(options).getState().commanderSupport!.airstrike!.status).toBe('ready');
});
it('rejects corrupt sweep anchors or missing flight origin without partially restoring the simulation', () => {
  const sim = raid(); step(sim, 451); const before = sim.getState();
  for (const failure of ['clock', 'count', 'route', 'missing-impacts']) {
    const bad = structuredClone(before), air = bad.commanderSupport!.airstrike!;
    if (failure === 'clock') air.impacts![0].atSeconds = bad.elapsedSeconds + 1;
    if (failure === 'count') air.impacts!.pop();
    if (failure === 'route') delete air.tankZAtWarning;
    if (failure === 'missing-impacts') delete air.impacts;
    expect(() => sim.restoreState(bad)).toThrow(); expect(sim.getState()).toEqual(before);
  }
});
