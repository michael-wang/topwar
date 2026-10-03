import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { createThreatReview, threatReviewEnabled, THREAT_REVIEW_SEED } from '../src/app/ThreatReview';
const config = GameConfigSchema.parse(data);
const options = { seed: 17, level: LevelDefinitionSchema.parse(levelData),
  startSquad: config.player.startSquad, startRocketCount: config.player.startRocketCount,
  tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
const make = () => createThreatReview(options, config.weapon.rifle.fireRate);
it('only enables the explicit threat review query', () => {
  expect(threatReviewEnabled('?review=threats')).toBe(true);
  for (const query of ['', '?review=other', '?threats', '?perf=1']) expect(threatReviewEnabled(query)).toBe(false);
});
it.each([
  ['', true, 7], ['?review=threats', true, 7], ['?review=normal', true, 1],
  ['', false, 1], ['?review=threats', false, 7], ['?review=normal', false, 1],
])('resolves boot %s (development %s) to Level %s, including Retry', (search, development, level) => {
  const enabled = threatReviewEnabled(search, development);
  const boot = () => enabled ? make() : new Simulation(options);
  for (const state of [boot().getState(), boot().getState()]) {
    expect(state.progression).toEqual({ level, xp: 0 });
    expect(state.squad.count).toBe(level === 7 ? 2 : 1);
    expect(state.reinforcement!.arrived).toBe(level === 7);
    expect(state.enemies.some(enemy => enemy.archetype === 'giant')).toBe(level === 7);
  }
});
it('restores valid Level 7 XP, arrived reinforcement and all three actual threat roles', () => {
  const state = make().getState();
  expect(state.progression).toEqual({ level: 7, xp: 0 });
  expect(state.seed).toBe(THREAT_REVIEW_SEED);
  expect(state.reinforcement).toEqual({ startedAtSeconds: 0, arrived: true });
  expect(state.squad.count).toBe(2);
  expect(state.weapons.rifleMemberCooldowns).toHaveLength(2);
  expect(state.enemies.map(e => e.archetype)).toEqual(['grunt', 'heavy', 'giant']);
  expect(new Set(state.enemies.map(e => e.lane)).size).toBe(3);
  expect(state.enemies.every(e => e.z >= 8)).toBe(true);
  expect(state.catharsis!.balance).toEqual(config.catharsis);
  const restored = new Simulation(options); restored.restoreState(state);
  expect(restored.getState()).toEqual(state);
  expect(Object.keys(state).some(key => /review/i.test(key))).toBe(false);
});
it('reconstructs the same preset on Retry without reusing combat state', () => {
  const first = make(); const initial = first.getState();
  const changed = first.getState(); changed.enemies[0].hp = .5; first.restoreState(changed);
  expect(make().getState()).toEqual(initial);
});
it('leaves ordinary Level 1, reinforcement and encounter scheduling intact', () => {
  const state = new Simulation(options).getState();
  expect(state.progression).toEqual({ level: 1, xp: 0 });
  expect(state.squad.count).toBe(config.player.startSquad);
  expect(state.reinforcement!.arrived).toBe(false);
  expect(state.giantEncounter).toEqual({ scheduledAtSeconds: null, spawned: false });
  expect(state.enemies.some(e => e.archetype === 'giant')).toBe(false);
});
it('runs ordinary movement, firing and damage after the opening', () => {
  const sim = make(); const initial = sim.getState();
  sim.stepLane(1);
  const tuning = { moveSpeed: config.player.moveSpeed, forwardSpeed: config.player.forwardSpeed,
    trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset,
    formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
    normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
    rifle: config.weapon.rifle, rocket: config.weapon.rocket };
  for (let i = 0; i < 120; i++) sim.step(1 / 60, { targetX: 0 }, tuning);
  const next = sim.getState();
  expect(next.weapons.nextProjectileId).toBeGreaterThan(initial.weapons.nextProjectileId);
  expect(next.enemies.find(e => e.id === 3)!.z).toBeLessThan(initial.enemies[2].z);
  expect(next.enemies.find(e => e.id === 2)?.hp ?? 0).toBeLessThan(initial.enemies[1].hp);
  expect(next.squad.count).toBe(2);
});
