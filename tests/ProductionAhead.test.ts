import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import historicalData from './fixtures/pre-b6b4-game.json';
import presets from '../src/config/survivalExperiment.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { survivalReviewConfig } from '../src/app/DevSurvivalReview';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { postCapOrdinarySettings } from '../src/simulation/postCapSurvival';

it('ships the exact phone-approved AHEAD profiles without changing shared Survival rules', () => {
  const c = GameConfigSchema.parse(data), old = GameConfigSchema.parse(historicalData);
  const { advancedProfile: _, ...shared } = old.catharsis!.postCapSurvival;
  expect(c.catharsis!.postCapSurvival).toEqual({ ...shared, ...presets.ahead });
  const state = { startedAtSeconds: 0, nextGiantAtSeconds: 24, nextGrenadeSupplyAtSeconds: 30 };
  const b = c.catharsis!;
  expect(postCapOrdinarySettings(b, state, 7)).toMatchObject({ groupSize: 30, heavyCount: 4, pressureLaneCount: 3 });
  expect(postCapOrdinarySettings(b, state, 8, 244)).toMatchObject({ groupSize: 42, heavyCount: 11, pressureLaneCount: 4, survivalSpeedMultiplier: 1.4, waveIntervalSeconds: 6 });
  expect(postCapOrdinarySettings(b, state, 8, 245)).toMatchObject({ groupSize: 42, heavyCount: 11, pressureLaneCount: 5, survivalSpeedMultiplier: 1.6, waveIntervalSeconds: 6 });
  expect(postCapOrdinarySettings(b, state, 9)).toMatchObject({ heavyCount: 15, pressureLaneCount: 5, survivalSpeedMultiplier: 1.6, waveIntervalSeconds: 5 });
  expect(postCapOrdinarySettings(b, state, 10)).toMatchObject({ heavyCount: 19, pressureLaneCount: 5, survivalSpeedMultiplier: 1.6, waveIntervalSeconds: 4 });
  for (const mode of ['baseline', 'experimental', 'staged', 'ahead'] as const)
    expect(survivalReviewConfig(b.postCapSurvival, mode)).toEqual(survivalReviewConfig(old.catharsis!.postCapSurvival, mode));
});

it('uses production AHEAD for the retained LATE entry with authored Lv10 weapons', () => {
  const c = GameConfigSchema.parse(data);
  const sim = createDevReviewFixture({ seed: 17, startSquad: 1, startRocketCount: 0, tiers: c.tiers,
    catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth }, level: LevelDefinitionSchema.parse(levelData) }, c.weapon.rifle.fireRate, 'late');
  const s = sim.getState();
  expect(s.progression).toEqual({ level: 10, xp: 0 });
  expect(s.squad.count).toBe(3);
  expect(s.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(19);
  expect(s.enemies).toHaveLength(42);
  expect(s.weapons.rifleMemberCooldowns).toEqual([0, 1 / 81, 2 / 81]);
  expect(s.defenseWaves!.nextAtSeconds).toBe(4);
});
