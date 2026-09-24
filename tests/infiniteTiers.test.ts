import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { addRifleSoldiers, afterCasualties, normalizeRifleSquad, rifleDefenseValue, validateSquad } from '../src/simulation/squad/composition';
import { rewardPlacementForBlock, rewardPlacementForRow } from '../src/simulation/enemies/streamRewards';
import { bossMaxHpForTier, bossRowForTier, enemyTierForRow, exchangeValueForTier,
  fullSaturationRow, powerForTier, rewardTierForRow, tierProbabilityForRow, tierRollForSlot,
  transitionStartRow } from '../src/simulation/tiers/tierRules';
import { SeededRng } from '../src/core/Rng';

const game = GameConfigSchema.parse(gameData);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;
const rule = stream.tierProgression;
const power = game.tiers;

describe('formula-driven tier data', () => {
  it('retains committed inputs and rejects obsolete authored tiers', () => {
    expect(rule).toEqual({ firstTransitionStartRow: 48, transitionRows: 96, stableRows: 96,
      curvePower: 2, bossLeadRows: 8, firstBossHpMultiplier: 5000, laterBossHpMultiplier: 1000 });
    expect(power).toEqual({ mergeCount: 10, tier1Power: 3, tier2Power: 300,
      higherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 });
    expect(() => LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream,
      bruteRamp: { startRow: 48, fullRow: 144, curvePower: 2 } } })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream,
      bosses: [{ row: 136, tier: 1, hpMultiplier: 5000 }] } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...game, enemies: { grunt: { hp: 3, radius: 0.3 } } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...game, weapon: { ...game.weapon,
      rifle: { ...game.weapon.rifle, damage: 3 } } })).toThrow();
  });

  it('validates formula boundaries strictly', () => {
    for (const patch of [{ transitionRows: 0 }, { stableRows: 0 }, { bossLeadRows: 0 },
      { bossLeadRows: 96 }, { curvePower: 0 }, { firstBossHpMultiplier: Infinity },
      { laterBossHpMultiplier: 0 }, { firstTransitionStartRow: -1 }]) {
      expect(() => LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream,
        tierProgression: { ...rule, ...patch } } })).toThrow();
    }
    for (const patch of [{ mergeCount: 1 }, { tier1Power: 0 }, { tier2Power: Infinity },
      { higherTierPowerMultiplier: 1 }, { normalEnemyRadius: 0 }]) {
      expect(() => GameConfigSchema.parse({ ...game, tiers: { ...power, ...patch } })).toThrow();
    }
  });

  it('derives every transition and Boss handoff without authored future rows', () => {
    for (const [tier, start, full, bossRow] of [
      [2, 48, 144, 328], [3, 240, 336, 520], [4, 432, 528, 712], [5, 624, 720, 904],
    ]) {
      expect(transitionStartRow(tier, rule)).toBe(start);
      expect(fullSaturationRow(tier, rule)).toBe(full);
      expect(bossRowForTier(tier - 1, rule)).toBe(full - 8);
      expect(bossRowForTier(tier, rule)).toBe(bossRow);
    }
    expect(bossRowForTier(1, rule)).toBe(136);
    expect(bossRowForTier(2, rule)).toBe(328);
    expect(bossRowForTier(3, rule)).toBe(520);
    expect(bossRowForTier(4, rule)).toBe(712);
    expect(transitionStartRow(10, rule)).toBe(1584);
  });

  it('derives unbounded power, exchange value, and Boss HP', () => {
    for (const [tier, value] of [[1, 3], [2, 300], [3, 3000], [4, 30000], [5, 300000], [10, 30000000000]]) {
      expect(powerForTier(tier, power)).toBe(value);
    }
    expect([1, 2, 3, 4, 7, 10].map((tier) => exchangeValueForTier(tier, 10)))
      .toEqual([1, 10, 100, 1000, 1000000, 1000000000]);
    expect([1, 2, 3, 4].map((tier) => bossMaxHpForTier(tier, rule, power)))
      .toEqual([15000, 300000, 3000000, 30000000]);
    expect(bossMaxHpForTier(2, rule, { ...power, tier2Power: 600 })).toBe(600000);
    expect(() => powerForTier(400, power)).toThrow(/range/);
    expect(() => exchangeValueForTier(30, 10)).toThrow(/range/);
  });

  it('keeps only adjacent enemy tiers in each cycle', () => {
    const rows = [0, 48, 49, 143, 144, 239, 240, 241, 335, 336, 431, 432, 433, 527, 528, 624, 720];
    for (const row of rows) {
      const tiers = new Set(Array.from({ length: 64 }, (_, column) =>
        enemyTierForRow(row, column, 3, stream.seed, rule)));
      const established = rewardTierForRow(row, rule);
      expect([...tiers].every((tier) => tier === established || tier === established + 1)).toBe(true);
    }
    expect(enemyTierForRow(432, 3, 3, stream.seed, rule)).toBe(4);
    expect(enemyTierForRow(432, 2, 3, stream.seed, rule)).toBe(3);
    expect(enemyTierForRow(624, 3, 3, stream.seed, rule)).toBe(5);
    expect(Array.from({ length: 7 }, (_, column) => enemyTierForRow(528, column, 3, stream.seed, rule)))
      .toEqual(Array(7).fill(4));
    expect(tierProbabilityForRow(136, 2, rule)).toBeCloseTo((88 / 96) ** 2);
    expect(tierRollForSlot(stream.seed, 4, 500, 2)).toBe(tierRollForSlot(stream.seed, 4, 500, 2));
  });

  it('switches reward tier only at full saturation', () => {
    expect([143, 144, 335, 336, 527, 528, 720].map((row) => rewardTierForRow(row, rule)))
      .toEqual([1, 2, 2, 3, 3, 4, 5]);
  });

  it('preserves one deterministic side reward per eight rows and gameplay RNG', () => {
    const rng = new SeededRng(17);
    const rngState = rng.getState();
    const rewards = stream.rewards!;
    for (let block = 0; block < 128; block++) {
      const selected = rewardPlacementForBlock(block, stream.columns, rewards);
      expect(selected).toEqual(rewardPlacementForBlock(block, stream.columns, rewards));
      const rows = Array.from({ length: rewards.rowsPerReward }, (_, offset) =>
        rewardPlacementForRow(block * rewards.rowsPerReward + offset, stream.columns, rewards));
      expect(rows.filter(Boolean)).toHaveLength(1);
      expect(Math.abs(selected.side * rewards.sideX)).toBe(2.2);
    }
    expect(rng.getState()).toBe(rngState);
  });
});

describe('generic rifle composition and defense', () => {
  const empty = { count: 0, rocketCount: 0, rifleCounts: [] as number[] };
  it('cascades merges through Tier 7 without a tier branch', () => {
    expect(normalizeRifleSquad({ count: 10, rocketCount: 0, rifleCounts: [10] }, 10).rifleCounts).toEqual([0, 1]);
    expect(normalizeRifleSquad({ count: 100, rocketCount: 0, rifleCounts: [100] }, 10).rifleCounts).toEqual([0, 0, 1]);
    expect(normalizeRifleSquad({ count: 1000, rocketCount: 0, rifleCounts: [1000] }, 10).rifleCounts).toEqual([0, 0, 0, 1]);
    let squad = empty;
    for (let index = 0; index < 10; index++) squad = addRifleSoldiers(squad, 1, 6, 10);
    expect(squad).toEqual({ count: 1, rocketCount: 0, rifleCounts: [0, 0, 0, 0, 0, 0, 1] });
    expect(addRifleSoldiers(empty, 1, 10, 10).rifleCounts[9]).toBe(1);
  });

  it('demotes arbitrary high tiers by equivalent defense value, preserving rockets last', () => {
    const t4 = { count: 1, rocketCount: 0, rifleCounts: [0, 0, 0, 1] };
    expect(rifleDefenseValue(t4, 10)).toBe(1000);
    expect(afterCasualties(t4, 1, 10)).toEqual({ count: 27, rocketCount: 0, rifleCounts: [9, 9, 9] });
    expect(afterCasualties(t4, 100, 10)).toEqual({ count: 9, rocketCount: 0, rifleCounts: [0, 0, 9] });
    expect(afterCasualties(t4, 1000, 10)).toEqual(empty);
    expect(afterCasualties({ count: 2, rocketCount: 1, rifleCounts: [0, 0, 0, 1] }, 1001, 10)).toEqual(empty);
    expect(afterCasualties({ count: 2, rocketCount: 1, rifleCounts: [0, 0, 0, 1] }, 1000, 10).rocketCount).toBe(1);
  });

  it('strictly validates dense visible counts', () => {
    expect(() => validateSquad({ count: 2, rocketCount: 0, rifleCounts: [1] })).toThrow();
    expect(() => validateSquad({ count: 1, rocketCount: 0, rifleCounts: [-1, 2] })).toThrow();
    expect(() => validateSquad({ count: 1, rocketCount: 0, rifleCounts: [, 1] as number[] })).toThrow();
    expect(() => validateSquad({ count: 1, rocketCount: 0, rifleCounts: [0, 0, 0, 1] })).not.toThrow();
  });
});
