import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { rewardPlacementForBlock } from '../src/simulation/enemies/streamRewards';
import { enemyPowerForTier, riflePowerForTier } from '../src/simulation/tiers/tierRules';

const config = GameConfigSchema.parse(gameData);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;
const make = (rewardRowsPerReward = 8) => new Simulation({ seed: 1, level,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, rewardRowsPerReward });
const baseline = { rewardRowsPerReward: 8, enemyHigherTierPowerMultiplier: 10,
  rifleHigherTierPowerMultiplier: 10 };
const emptyLevel = LevelDefinitionSchema.parse({ id: 'tuning-isolated', length: 1000,
  enemyGroups: [], upgradeGates: [] });
const movement = { moveSpeed: 5, forwardSpeed: 1.5, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  normalEnemyRadius: 0.3, bossRadius: 2,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket } };

describe('temporary runtime tuning', () => {
  it('starts from the committed eight authored defaults and rejects obsolete mouse sensitivity', () => {
    expect(defaultRuntimeTuning(config, level)).toEqual({ bulletSpeed: 28, bulletRange: 40,
      rewardRowsPerReward: 8, enemyHigherTierPowerMultiplier: 10,
      rifleHigherTierPowerMultiplier: 10, fireRate: 7, moveSpeed: 5, forwardSpeed: 1.5 });
    expect(() => GameConfigSchema.parse({ ...gameData, controls: { mouseSensitivity: 1 } })).toThrow();
  });

  it('splits enemy and rifle growth above the unchanged Tier-1/Tier-2 bootstrap', () => {
    expect(enemyPowerForTier(1, config.tiers)).toBe(3);
    expect(enemyPowerForTier(2, config.tiers)).toBe(300);
    expect(enemyPowerForTier(3, config.tiers)).toBe(3000);
    expect(riflePowerForTier(3, config.tiers)).toBe(3000);
    const enemyTuned = { ...config.tiers, enemyHigherTierPowerMultiplier: 12 };
    expect(enemyPowerForTier(3, enemyTuned)).toBe(3600);
    expect(riflePowerForTier(3, enemyTuned)).toBe(3000);
    const bothTuned = { ...enemyTuned, rifleHigherTierPowerMultiplier: 8 };
    expect(enemyPowerForTier(3, bothTuned)).toBe(3600);
    expect(riflePowerForTier(3, bothTuned)).toBe(2400);
    expect(enemyPowerForTier(10, bothTuned)).toBe(300 * 12 ** 8);
    expect(riflePowerForTier(10, bothTuned)).toBe(300 * 8 ** 8);
  });

  it('uses live movement, speed, range, fire rate, and rifle power on subsequent steps', () => {
    const simulation = new Simulation({ seed: 1, level: emptyLevel,
      startSquad: 1, startRocketCount: 0, tiers: config.tiers });
    const state = simulation.getState();
    state.squad = { count: 1, rocketCount: 0, rifleCounts: [0, 0, 1], rifleRemainder: 0 };
    simulation.restoreState(state);
    simulation.setRuntimeBalance({ ...baseline, rifleHigherTierPowerMultiplier: 8 });
    simulation.step(0.01, { targetX: 2.5 }, { ...movement, moveSpeed: 10,
      forwardSpeed: 2, rifle: { fireRate: 7, projectileSpeed: 50, range: 60 } });
    const after = simulation.getState();
    expect(after.player.x).toBeCloseTo(0.1);
    expect(after.player.z).toBeCloseTo(0.02);
    expect(after.projectiles[0]).toMatchObject({ speed: 50, damage: 2400 });
    expect(after.projectiles[0].remainingRange).toBeCloseTo(59.5);

    const slow = new Simulation({ seed: 1, level: emptyLevel,
      startSquad: 1, startRocketCount: 0, tiers: config.tiers });
    const fast = new Simulation({ seed: 1, level: emptyLevel,
      startSquad: 1, startRocketCount: 0, tiers: config.tiers });
    for (const sim of [slow, fast]) sim.step(0.01, { targetX: 0 }, movement);
    slow.step(0.2, { targetX: 0 }, { ...movement, rifle: { ...movement.rifle, fireRate: 1 } });
    fast.step(0.2, { targetX: 0 }, { ...movement, rifle: { ...movement.rifle, fireRate: 15 } });
    expect(fast.getState().weapons.nextProjectileId).toBeGreaterThan(slow.getState().weapons.nextProjectileId);
  });

  it('rescales living high-tier enemy health by fraction without changing gameplay RNG', () => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies[0] = { ...state.enemies[0], tier: 3, hp: 1500 };
    simulation.restoreState(state);
    const before = simulation.getState();
    simulation.setRuntimeBalance({ ...baseline, enemyHigherTierPowerMultiplier: 12 });
    const after = simulation.getState();
    expect(after.enemies[0].hp).toBe(1800);
    expect(after.rngState).toBe(before.rngState);
    simulation.setRuntimeBalance(baseline);
    expect(simulation.getState().enemies[0].hp).toBe(1500);
  });

  it('recomputes an active higher-tier Boss max HP and preserves its health fraction', () => {
    const customLevel = LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream,
      startZ: 5, spacing: 1, spawnAheadDistance: 11,
      rewards: { ...stream.rewards!, spawnAheadDistance: 10 },
      tierProgression: { ...stream.tierProgression,
        firstTransitionStartRow: 2, transitionRows: 4, stableRows: 4, bossLeadRows: 1 } } });
    const simulation = new Simulation({ seed: 1, level: customLevel,
      startSquad: 1, startRocketCount: 0, tiers: config.tiers });
    const tuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5,
      defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
      normalEnemyRadius: 0.3, bossRadius: 2,
      rifle: { ...config.weapon.rifle, fireRate: 0.01 }, rocket: { ...config.weapon.rocket } };
    for (const playerZ of [8, 16]) {
      const state = simulation.getState();
      state.boss = null;
      state.enemies = [];
      state.squad = { count: 1, rocketCount: 0, rifleCounts: [0, 0, 0, 1], rifleRemainder: 0 };
      state.player.z = playerZ;
      simulation.restoreState(state);
      simulation.step(0.01, { targetX: 0 }, tuning);
    }
    const before = simulation.getState();
    expect(before.boss?.tier).toBe(3);
    before.boss!.hp = before.boss!.maxHp / 2;
    simulation.restoreState(before);
    simulation.setRuntimeBalance({ ...baseline, enemyHigherTierPowerMultiplier: 12 });
    const after = simulation.getState();
    expect(after.boss?.maxHp).toBe(3600 * 1000);
    expect(after.boss?.hp).toBe(after.boss!.maxHp / 2);
    expect(after.rngState).toBe(before.rngState);
    const advance = simulation.getState();
    const firstNewEnemyId = advance.enemyStream!.nextEnemyId;
    advance.player.z = 17;
    simulation.restoreState(advance);
    simulation.step(0.01, { targetX: 0 }, tuning);
    const newlyGenerated = simulation.getState().enemies.filter((enemy) => enemy.id >= firstNewEnemyId);
    expect(newlyGenerated.length).toBeGreaterThan(0);
    expect(newlyGenerated.every((enemy) => enemy.hp === enemyPowerForTier(enemy.tier,
      { ...config.tiers, enemyHigherTierPowerMultiplier: 12 }))).toBe(true);
  });

  it('reanchors future deterministic reward blocks without replacing active rewards or backfilling', () => {
    const simulation = make();
    const before = simulation.getState();
    const active = before.streamRewards.map((reward) => ({ ...reward }));
    const previousId = before.enemyStream!.nextRewardId;
    const oldLastBlock = before.enemyStream!.nextRewardBlockIndex - 1;
    const oldLastRow = rewardPlacementForBlock(oldLastBlock, stream.columns, stream.rewards!).rowIndex;
    simulation.setRuntimeBalance({ ...baseline, rewardRowsPerReward: 2 });
    const changed = simulation.getState();
    expect(changed.streamRewards).toEqual(active);
    expect(changed.enemyStream!.nextRewardId).toBe(previousId);
    const twoRowConfig = { ...stream.rewards!, rowsPerReward: 2 };
    const next = rewardPlacementForBlock(changed.enemyStream!.nextRewardBlockIndex,
      stream.columns, twoRowConfig);
    expect(next.rowIndex).toBeGreaterThan(oldLastRow);
    const replay = make();
    replay.setRuntimeBalance({ ...baseline, rewardRowsPerReward: 2 });
    expect(replay.getState()).toEqual(changed);
    expect(make(2).getState().streamRewards.length).toBeGreaterThan(active.length);
    simulation.setRuntimeBalance(baseline);
    const reset = simulation.getState();
    const resetNext = rewardPlacementForBlock(reset.enemyStream!.nextRewardBlockIndex,
      stream.columns, stream.rewards!);
    expect(resetNext.rowIndex).toBeGreaterThan(next.rowIndex);
    expect(reset.streamRewards).toEqual(active);
  });

  it('materializes the next new-density reward once with a strictly increasing ID', () => {
    const simulation = make();
    simulation.setRuntimeBalance({ ...baseline, rewardRowsPerReward: 2 });
    const changed = simulation.getState();
    const next = rewardPlacementForBlock(changed.enemyStream!.nextRewardBlockIndex,
      stream.columns, { ...stream.rewards!, rowsPerReward: 2 });
    changed.player.z = stream.startZ + next.rowIndex * stream.spacing
      - stream.rewards!.spawnAheadDistance + 0.1;
    simulation.restoreState(changed);
    const tuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5,
      defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
      normalEnemyRadius: 0.3, bossRadius: 2,
      rifle: { ...config.weapon.rifle, fireRate: 0.01 }, rocket: { ...config.weapon.rocket } };
    simulation.step(0.01, { targetX: 0 }, tuning);
    const after = simulation.getState();
    const newRewards = after.streamRewards.filter((reward) => reward.id >= changed.enemyStream!.nextRewardId);
    expect(newRewards.map((reward) => reward.id)).toEqual([changed.enemyStream!.nextRewardId]);
    expect(new Set(after.streamRewards.map((reward) => reward.id)).size).toBe(after.streamRewards.length);
    expect(after.enemyStream!.nextRewardBlockIndex).toBeGreaterThan(changed.enemyStream!.nextRewardBlockIndex);
  });
});
