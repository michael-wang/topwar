import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { type MachineGunReviewFixture } from '../src/app/DevMachineGunReview';
import { pilotTuning } from '../scripts/qa/DefensePilot';

const config = GameConfigSchema.parse(gameData);
const options = { seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1, startRocketCount: 0,
  tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
const make = (role: MachineGunReviewFixture) => createDevReviewFixture(options, config.weapon.rifle.fireRate, role);
const presets = [['mg6', 6, 1, 18], ['mg7', 7, 1, 22.5], ['mg8', 8, 1, 27], ['mg9', 9, 2, 27], ['mg10', 10, 3, 27]] as const;

it.each(presets)('%s compares the same deterministic crowd at authored Lv%i / %i MGs / %i Hz per member', (role, level, count, rate) => {
  const sim = make(role), initial = sim.getState(), reference = make('mg6').getState();
  expect(initial.progression).toEqual({ level, xp: 0 });
  expect(initial.squad.count).toBe(count);
  expect(initial.weapons.rifleMemberCooldowns).toEqual(Array.from({ length: count }, (_, i) => i / (rate * count)));
  expect(initial.seed).toBe(reference.seed); expect(initial.rngState).toEqual(reference.rngState);
  expect(initial.enemies).toEqual(reference.enemies); expect(initial.player).toEqual(reference.player);
  expect(initial.enemies).toHaveLength(65);
  expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(5);
  expect(initial.enemyStream).toBeNull(); expect(initial.carnival!.status).toBe('skipped');
  expect(initial.destroyer!.status).toBe('skipped'); expect(initial.postCapSurvival!.startedAtSeconds).toBeNull();
  for (let i = 0; i < 60; i++) sim.step(1 / 60, { targetX: 0 }, pilotTuning);
  let nextId = sim.getState().weapons.nextProjectileId;
  const shots = Array(count).fill(0);
  for (let i = 0; i < 600; i++) {
    if (i === 150) sim.stepLane(1);
    sim.step(1 / 60, { targetX: 0 }, pilotTuning);
    const state = sim.getFrameState();
    for (const shot of state.projectiles.filter(p => p.id >= nextId)) {
      expect(shot.kind).toBe('machineGun'); expect(shot.lane).toBe(state.player.selectedLane);
      expect(shot.damage).toBe(config.tiers.tier1Power); shots[shot.memberIndex!]++;
    }
    nextId = state.weapons.nextProjectileId;
  }
  expect(shots).toEqual(Array(count).fill(rate * 10));
  expect(sim.getState().enemies.length).toBeLessThan(65);
  expect(sim.getState().progression!.level).toBe(level);
  const saved = sim.getState(), clone = make(role); clone.restoreState(JSON.parse(JSON.stringify(saved)));
  for (let i = 0; i < 120; i++) { sim.step(1 / 60, { targetX: 0 }, pilotTuning); clone.step(1 / 60, { targetX: 0 }, pilotTuning); }
  expect(clone.getState()).toEqual(sim.getState());
  expect(make(role).getState()).toEqual(initial);
  expect(createDevReviewFixture({ ...options, seed: 99 }, 3, role).getState()).toEqual(initial);
});

it('leaves authored balance and main review fixtures unchanged', () => {
  const original = structuredClone(options);
  for (const [role] of presets) make(role);
  expect(options).toEqual(original);
  const late = createDevReviewFixture(options, 3, 'late').getState();
  expect(late.enemies).toHaveLength(42); expect(late.postCapSurvival!.startedAtSeconds).toBe(0);
  expect(createDevReviewFixture(options, 3, 'crate8').getState().squad.count).toBe(1);
  expect(createDevReviewFixture(options, 3, 'naval').getState().destroyer!.status).toBe('active');
});
