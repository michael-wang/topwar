import { expect, it, vi } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { TANK_ARTILLERY_REVIEWS } from '../src/app/DevTankArtilleryReview';
import { PLAYTEST_ENTRIES } from '../src/app/PlaytestScenarios';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { readCheckpoint, simulationFromCheckpoint, writeCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 19, level, tiers: config.tiers, startSquad: 1, startRocketCount: 0,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
const make = (role: typeof TANK_ARTILLERY_REVIEWS[number]['role']) => createDevReviewFixture(options, config.weapon.rifle.fireRate, role);

it.each([2, 3] as const)('Phase %i A/B fixtures differ only by policy mode and retain the real combat rules', phase => {
  const original = structuredClone(options), a = make(`boss-rhythm-${phase}-a`).getState(), b = make(`boss-rhythm-${phase}-b`).getState();
  expect(a.catharsis!.balance.defenseTank!.salvoPolicy!.mode).toBe('randomSimultaneous');
  expect(b.catharsis!.balance.defenseTank!.salvoPolicy!.mode).toBe('randomStaggered');
  b.catharsis!.balance.defenseTank!.salvoPolicy!.mode = 'randomSimultaneous'; expect(b).toEqual(a);
  expect(options).toEqual(original); expect(config.catharsis!.defenseTank!.salvoPolicy).toBeUndefined();
  expect(a.progression).toEqual({ level: 9, xp: 0 }); expect(a.squad.count).toBe(2);
  expect(a.player).toEqual({ x: 0, z: 0, selectedLane: 2 });
  expect(a.defenseTank).toMatchObject({ status: 'active', phase, nextAttackAtSeconds: a.elapsedSeconds + 1 });
  expect(a.enemies).toHaveLength(phase === 2 ? 8 : 12);
  expect(a.enemies.every(e => e.lane === 0 || e.lane === 4)).toBe(true);
  expect(new Set(a.enemies.map(e => e.archetype))).toEqual(new Set(['heavy', 'grunt']));
  const real = structuredClone(a.catharsis!.balance.defenseTank!); delete real.salvoPolicy;
  expect(real).toEqual(config.catharsis!.defenseTank);
  expect(a.catharsis!.balance.commanderSupport).toEqual(config.catharsis!.commanderSupport);
});
it.each(TANK_ARTILLERY_REVIEWS)('$role supports actual movement, firing, paused DEV Continue and deterministic Retry', review => {
  const sim = make(review.role), initial = sim.getState();
  for (let tick = 0; tick < 80; tick++) sim.step(1 / 60, { targetX: 0 }, tuning);
  const saved = sim.getState(); expect(saved.artillery!.shells.length).toBe(review.mode === 'randomSimultaneous' ? review.phase : 1);
  expect(saved.combatStats!.shotsFired).toBeGreaterThan(0); expect(saved.defenseTank!.hp).toBeLessThan(initial.defenseTank!.hp);
  expect(sim.stepLane(-1)).toBe(true); sim.step(1 / 60, { targetX: 0 }, tuning); expect(sim.getState().player.x).toBeLessThan(0);
  sim.restoreState(saved); sim.consumeArtilleryEvents();
  const c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense', savedAt: 1,
    build: 'tank-rhythm', paused: true, hidden: false, reason: 'pause', fixture: review.role,
    config, level, tuning: defaultRuntimeTuning(config, level), state: saved };
  let text: string | null = null;
  const storage = { getItem: () => text, setItem: (_k: string, v: string) => { text = v; }, removeItem: () => { text = null; } };
  expect(writeCheckpoint(c, storage).ok).toBe(true);
  const result = readCheckpoint(storage); expect(result.status).toBe('valid'); if (result.status !== 'valid') throw Error('Rejected review');
  const copy = simulationFromCheckpoint(result.checkpoint); expect(copy.getState()).toEqual(saved); expect(copy.consumeArtilleryEvents()).toEqual([]);
  expect(sim.getState()).toEqual(saved); // Pausing performs no scheduler work.
  // One explicit manual dodge; the fixture itself never supplies movement inputs.
  const locked = [...saved.artillery!.shells.map(s => s.targetLane), ...saved.defenseTank!.rhythm!.pendingShots.map(s => s.targetLane)];
  const target = [0, 1, 2, 3, 4].find(lane => !locked.includes(lane))!;
  for (const runner of [sim, copy]) while (runner.getState().player.selectedLane !== target)
    runner.stepLane(target < runner.getState().player.selectedLane! ? -1 : 1);
  for (let tick = 0; tick < 250; tick++) {
    sim.step(1 / 60, { targetX: 0 }, tuning); copy.step(1 / 60, { targetX: 0 }, tuning);
    expect(copy.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents());
  }
  expect(copy.getState()).toEqual(sim.getState()); expect(sim.getState().squad.count).toBe(2);
  expect(make(review.role).getState()).toEqual(initial);
  vi.stubEnv('DEV', false); try { expect(readCheckpoint(storage).status).toBe('invalid'); } finally { vi.unstubAllEnvs(); }
});
it('keeps all four shared scenes and existing DEV reviews unchanged', () => {
  expect(PLAYTEST_ENTRIES.map(e => e.role)).toEqual(['naval', 'boss-intro', 'victory', 'air-support']);
  expect(createDevReviewFixture(options, 27, 'boss-dense').getState().enemies).toHaveLength(67);
  expect(createDevReviewFixture(options, 27, 'air-threshold-5').getState().squad.count).toBe(5);
});
