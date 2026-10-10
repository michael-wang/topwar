import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture, type DevReviewFixture } from './helpers/ReviewFixtures';
import hashes from './fixtures/review-state-hashes.json';

// Captured before cleanup at 2081abe: migration must preserve every scenario,
// including the retained human entries delegated to the runtime factory.
it.each(Object.entries(hashes))('preserves the complete accepted %s fixture state', async (role, hash) => {
  const c = GameConfigSchema.parse(gameData);
  const simulation = createDevReviewFixture({ seed: 17, level: LevelDefinitionSchema.parse(levelData),
    startSquad: 1, startRocketCount: 0, tiers: c.tiers,
    catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } }, c.weapon.rifle.fireRate, role as DevReviewFixture);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(simulation.getState())));
  expect(Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('')).toBe(hash);
});
