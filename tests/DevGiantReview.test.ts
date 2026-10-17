import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';

const c = GameConfigSchema.parse(gameData), level = LevelDefinitionSchema.parse(levelData);
const options = { seed: 19, level, startSquad: c.player.startSquad,
  startRocketCount: c.player.startRocketCount, tiers: c.tiers,
  catharsis: { trackHalfWidth: c.track.halfWidth, balance: c.catharsis! } };
const tuning = { moveSpeed: c.player.moveSpeed, forwardSpeed: c.player.forwardSpeed,
  trackHalfWidth: c.track.halfWidth, defenseLineOffset: c.track.defenseLineOffset,
  formationSpacing: c.player.formationSpacing, memberRadius: c.player.memberRadius,
  normalEnemyRadius: c.tiers.normalEnemyRadius, bossRadius: c.bosses.basic.radius,
  rifle: c.weapon.rifle, rocket: c.weapon.rocket };
const make = () => createDevReviewFixture(options, c.weapon.rifle.fireRate, 'giant');

it('stages one full-HP GIANT and authored Lv9 MGs without mutating ordinary configuration', () => {
  const before = structuredClone(options), state = make().getState();
  expect(options).toEqual(before);
  expect(state.enemies).toHaveLength(1);
  expect(state.enemies[0]).toMatchObject({ archetype: 'giant', hp: c.catharsis!.giant.hp, lane: 2 });
  expect(state.progression).toEqual({ level: 9, xp: 0 });
  expect(state.squad.count).toBe(2);
  expect(state.enemyStream).toBeNull();
  expect(state.grenade!.inventory).toBe(0);
  expect(state.catharsis!.balance.giant).toEqual(c.catharsis!.giant);
  expect(state.catharsis!.balance.defenseTank).toBeUndefined();
  expect(state.catharsis!.balance.commanderSupport).toBeUndefined();
  expect(make().getState()).toEqual(state);
});

it('delivers nonlethal MG hits then a real lethal hit quickly, with deterministic restore and repeat', () => {
  const sim = make(), restored = make();
  let nonlethal = 0, tick = 0;
  const hp = c.catharsis!.giant.hp;
  for (; tick < 1200 && sim.getFrameState().enemies.length; tick++) {
    sim.step(1 / 60, { targetX: 0 }, tuning);
    if (tick === 120) restored.restoreState(JSON.parse(JSON.stringify(sim.getState())));
    else restored.step(1 / 60, { targetX: 0 }, tuning);
    const enemy = sim.getFrameState().enemies[0];
    if (enemy && enemy.hp < hp) nonlethal++;
  }
  expect(nonlethal).toBeGreaterThan(30);
  expect(tick / 60).toBeLessThan(15);
  expect(sim.getFrameState().squad.count).toBe(2);
  expect(sim.getState()).toEqual(restored.getState());
  expect(sim.getState().progression!.xp).toBeGreaterThan(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().enemies).toEqual([]);
  expect(make().getState()).toEqual(make().getState());
});
