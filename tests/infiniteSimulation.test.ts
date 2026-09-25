import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState,
  StreamRewardSimulationState } from '../src/simulation/SimulationState';
import { enemyPowerForTier, bossRowForTier, rewardTierForRow } from '../src/simulation/tiers/tierRules';
import { rewardPlacementForBlock } from '../src/simulation/enemies/streamRewards';
import { squadDefenseValue, damageFeedback } from '../src/app/combatFeedback';
import { compactRifleValue } from '../src/simulation/squad/composition';

const config = GameConfigSchema.parse(configData);
const level = LevelDefinitionSchema.parse(levelData);
const stillLevel: LevelDefinition = { id: 'isolated', length: 1000, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, normalEnemyRadius: 0.3,
  bossRadius: config.bosses.basic.radius,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket },
};
const idle = { targetX: 0 };
const create = (selectedLevel = stillLevel) => new Simulation({ seed: 17, level: selectedLevel,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers });
const enemy = (id: number, tier: number, z: number, x = 0): EnemySimulationState =>
  ({ id, tier, x, z, hp: enemyPowerForTier(tier, config.tiers) });
const reward = (id: number, tier: number, z: number, hitProgress = 0): StreamRewardSimulationState =>
  ({ id, tier, x: 0, z, hitProgress, hitsRequired: 10 });
const shot = (id: number, tier: number, z = 0): ProjectileSimulationState => ({
  id, kind: 'rifle', tier, x: 0, z, speed: 100,
  damage: enemyPowerForTier(tier, config.tiers), remainingRange: 100, blastRadius: 0,
  penetrationRemaining: tier === 1 ? 0 : 10 ** (tier - 1),
});
function restoreWith(simulation: Simulation, change: (state: SimulationState) => void): void {
  const state = simulation.getState();
  change(state);
  simulation.restoreState(state);
}
function step(simulation: Simulation, override: Partial<SimulationTuning> = {}): void {
  simulation.step(0.2, idle, { ...tuning, rifle: { ...tuning.rifle, fireRate: 0.01 }, ...override });
}

describe('unbounded enemy and Boss stream', () => {
  it('starts with the same T1 stream geometry and gameplay RNG', () => {
    const simulation = create(level);
    const state = simulation.getState();
    expect(state.rngState).toBe(17);
    expect(state.enemies.length).toBeGreaterThan(700);
    expect(state.enemies.filter((entry) => entry.tier === 2).length).toBeGreaterThan(0);
    expect(state.enemyStream?.nextBossTier).toBe(1);
    expect(state.streamRewards.every((entry) => entry.tier === 1)).toBe(true);
    expect(create(level).getState()).toEqual(state);
  });

  it('keeps the reward horizon independent of already generated enemy rows', () => {
    const simulation = create(level);
    const initial = simulation.getState();
    const stream = level.enemyStream!;
    expect(initial.enemies.some((entry) => entry.z > stream.rewards!.spawnAheadDistance + 30)).toBe(true);
    expect(initial.streamRewards.every((entry) => entry.z < stream.rewards!.spawnAheadDistance + 1)).toBe(true);
    const nextBlock = initial.enemyStream!.nextRewardBlockIndex;
    const placement = rewardPlacementForBlock(nextBlock, stream.columns, stream.rewards!);
    const nextRowZ = stream.startZ + placement.rowIndex * stream.spacing;
    restoreWith(simulation, (state) => { state.player.z = nextRowZ - stream.rewards!.spawnAheadDistance + 0.1; });
    simulation.step(0.01, idle, tuning);
    const advanced = simulation.getState();
    expect(advanced.enemyStream!.nextRewardBlockIndex).toBeGreaterThan(nextBlock);
    expect(advanced.streamRewards.some((entry) => entry.id === initial.enemyStream!.nextRewardId)).toBe(true);
  });

  it('rejects malformed generic tiers transactionally on restore', () => {
    const simulation = create(level);
    const original = simulation.getState();
    for (const mutate of [
      (state: SimulationState) => { state.enemies[0].tier = 0; },
      (state: SimulationState) => { state.streamRewards[0].tier = -1; },
      (state: SimulationState) => { state.squad.rifleCounts = [10]; state.squad.count = 10; },
      (state: SimulationState) => { state.squad.rifleRemainder = -1; },
      (state: SimulationState) => { state.squad.rifleCounts = [1, 0, 1]; state.squad.count = 2; },
      (state: SimulationState) => { state.squad.rifleCounts = [0, 0, 1]; state.squad.rifleRemainder = 10; },
      (state: SimulationState) => { state.squad.rifleCounts = []; state.squad.count = 0; state.squad.rifleRemainder = 1; },
      (state: SimulationState) => { state.enemyStream!.nextBossTier = 10; },
    ]) {
      const candidate = simulation.getState();
      mutate(candidate);
      expect(() => simulation.restoreState(candidate)).toThrow();
      expect(simulation.getState()).toEqual(original);
    }
  });

  it('spawns formula Bosses, skips only their own rows, and keeps later rows flowing', () => {
    const stream = level.enemyStream!;
    const nearFirst = { ...level, enemyStream: { ...stream, spawnAheadDistance: 110 } };
    const simulation = create(nearFirst);
    const state = simulation.getState();
    expect(state.boss).toMatchObject({ tier: 1, maxHp: 12000,
      z: stream.startZ + bossRowForTier(1, stream.tierProgression) * stream.spacing });
    expect(state.enemyStream?.nextBossTier).toBe(2);
    expect(state.enemies.some((entry) => entry.id === state.boss?.id)).toBe(false);
    expect(state.enemies.some((entry) => entry.z > state.boss!.z + 1)).toBe(true);
    expect(state.enemyStream!.nextRowIndex).toBeGreaterThan(136);
    const after = simulation.getState();
    after.boss = null;
    simulation.restoreState(after);
    expect(simulation.getState().enemyStream?.nextBossTier).toBe(2);
    expect(simulation.getState().boss).toBeNull();
  });

  it('advances Boss cursor through Tier-3 and Tier-4 without authored encounters', () => {
    const stream = level.enemyStream!;
    const accelerated = { ...level, enemyStream: { ...stream, spawnAheadDistance: 107 } };
    const simulation = create(accelerated);
    const target = [2, 3, 4];
    for (const tier of target) {
      restoreWith(simulation, (state) => { state.boss = null; state.squad = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 }; });
      const row = bossRowForTier(tier, stream.tierProgression);
      const current = simulation.getState();
      const neededZ = stream.startZ + row * stream.spacing - accelerated.enemyStream.spawnAheadDistance;
      restoreWith(simulation, (state) => { state.player.z = neededZ - 0.1; });
      simulation.step(0.2, idle, { ...tuning, forwardSpeed: 1, rifle: { ...tuning.rifle, fireRate: 0.01 } });
      const spawned = simulation.getState();
      expect(spawned.boss?.tier).toBe(tier);
      expect(spawned.boss?.maxHp).toBe(enemyPowerForTier(tier, config.tiers) * 1000);
      expect(spawned.enemyStream?.nextBossTier).toBe(tier + 1);
      expect(spawned.enemyStream!.nextRowIndex).toBeGreaterThan(row);
      expect(spawned.rngState).toBe(current.rngState);
    }
  });

  it('restores Tier-4 enemies, Tier-4 rewards, and a high Boss cursor', () => {
    const simulation = create(level);
    const state = simulation.getState();
    state.enemies = [enemy(99999, 4, 40)];
    state.enemyStream!.nextEnemyId = 100000;
    state.streamRewards = [reward(999, 4, 45, 6)];
    state.enemyStream!.nextRewardId = 1000;
    state.squad = { count: 1, rocketCount: 0, rifleCounts: [0, 0, 0, 1], rifleRemainder: 6 };
    // A high cursor requires a corresponding generated row cursor.
    state.enemyStream!.nextRowIndex = bossRowForTier(3, level.enemyStream!.tierProgression) + 1;
    state.enemyStream!.nextBossTier = 4;
    simulation.restoreState(state);
    expect(simulation.getState()).toEqual(state);
    const replay = create(level);
    replay.restoreState(state);
    expect(replay.getState()).toEqual(simulation.getState());
    step(simulation);
    step(replay);
    expect(replay.getState()).toEqual(simulation.getState());
  });

  it('rejects a second Boss while the previous Boss is still active', () => {
    const stream = level.enemyStream!;
    expect(() => create({ ...level, enemyStream: { ...stream, spawnAheadDistance: 240 } }))
      .toThrow(/another Boss is active/);
  });

  it('restores a live Tier-3 Boss and reproduces its future', () => {
    const stream = level.enemyStream!;
    const accelerated = { ...level, enemyStream: { ...stream, spawnAheadDistance: 107 } };
    const simulation = create(accelerated);
    for (const tier of [2, 3]) {
      restoreWith(simulation, (state) => { state.boss = null; });
      const row = bossRowForTier(tier, stream.tierProgression);
      restoreWith(simulation, (state) => {
        state.player.z = stream.startZ + row * stream.spacing - 107 - 0.1;
        state.player.x = 3;
        state.enemies = [];
        state.enemyStream!.nextRowIndex = row;
      });
      simulation.step(0.2, idle, { ...tuning, forwardSpeed: 1,
        rifle: { ...tuning.rifle, fireRate: 0.01 } });
      expect(simulation.getState().squad.count).toBeGreaterThan(0);
      expect(simulation.getState().boss?.tier).toBe(tier);
    }
    const saved = simulation.getState();
    expect(saved.boss?.tier).toBe(3);
    expect(saved.boss?.maxHp).toBe(3000000);
    expect(saved.enemyStream?.nextBossTier).toBe(4);
    const replay = create(accelerated);
    replay.restoreState(saved);
    step(simulation);
    step(replay);
    expect(replay.getState()).toEqual(simulation.getState());
  });
});

describe('generic projectile exchange and rewards', () => {
  it('fires only visible adjacent tiers and leaves remainder without a firing lane', () => {
    const simulation = create();
    restoreWith(simulation, (state) => { state.squad = compactRifleValue(176, 10); });
    simulation.step(0.01, idle, tuning);
    const state = simulation.getState();
    expect(state.squad).toEqual({ count: 8, rocketCount: 0, rifleCounts: [0, 7, 1], rifleRemainder: 6 });
    expect(state.projectiles).toHaveLength(8);
    expect(state.projectiles.filter((projectile) => projectile.tier === 1)).toHaveLength(0);
    expect(state.projectiles.filter((projectile) => projectile.tier === 2)).toHaveLength(7);
    expect(state.projectiles.filter((projectile) => projectile.tier === 3)).toHaveLength(1);
    expect(squadDefenseValue(state.squad, 10)).toBe(176);
  });

  it('fires one generic rifle kind with formula damage and captured penetration', () => {
    for (const tier of [1, 2, 3, 4, 7]) {
      const simulation = create();
      restoreWith(simulation, (state) => { state.squad = { count: 1, rocketCount: 0,
        rifleCounts: [...Array(tier - 1).fill(0), 1], rifleRemainder: 0 }; });
      simulation.step(0.01, idle, tuning);
      expect(simulation.getState().projectiles[0]).toMatchObject({ kind: 'rifle', tier,
        damage: enemyPowerForTier(tier, config.tiers),
        penetrationRemaining: tier === 1 ? 0 : 10 ** (tier - 1) });
    }
  });

  it('pierces a deterministic mixture of lower tiers and stops on same tier', () => {
    const simulation = create();
    restoreWith(simulation, (state) => {
      state.enemies = [enemy(1, 3, 5), enemy(2, 3, 6), enemy(3, 2, 7), enemy(4, 1, 8), enemy(5, 4, 9), enemy(6, 1, 10)];
      state.projectiles = [shot(1, 4)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().enemies.map((entry) => entry.id)).toEqual([6]);
    expect(simulation.getState().projectiles).toHaveLength(0);
  });

  it('T4 spends 100 per T3, 10 per T2, and 1 per T1', () => {
    const simulation = create();
    restoreWith(simulation, (state) => {
      state.enemies = [enemy(1, 3, 5), enemy(2, 2, 6), enemy(3, 1, 7)];
      state.projectiles = [shot(1, 4)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().enemies).toHaveLength(0);
    expect(simulation.getState().projectiles[0].penetrationRemaining).toBe(889);
  });

  it.each([[3, 10], [2, 100]] as const)(
    'a T4 shot pierces ten equivalent Tier-%i bodies and cannot hit the next', (tier, limit) => {
      const simulation = create();
      restoreWith(simulation, (state) => {
        state.enemies = Array.from({ length: limit + 1 }, (_, index) =>
          enemy(index + 1, tier, 5 + index * 0.5));
        state.projectiles = [shot(1, 4)];
        state.weapons.nextProjectileId = 2;
        state.weapons.rifleCooldownRemainingSeconds = 100;
      });
      simulation.step(0.7, idle, { ...tuning, rifle: { ...tuning.rifle, fireRate: 0.01 } });
      expect(simulation.getState().enemies.map((entry) => entry.id)).toEqual([limit + 1]);
      expect(simulation.getState().projectiles).toHaveLength(0);
    });

  it('any rifle progresses any reward and stops, including an unlocking high-tier shot', () => {
    const simulation = create(level);
    restoreWith(simulation, (state) => {
      state.streamRewards = [reward(1, 4, 5, 0)];
      state.projectiles = [shot(1, 1)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toHaveLength(0);
    restoreWith(simulation, (state) => {
      state.streamRewards = [reward(1, 1, 5, 9)];
      state.projectiles = [shot(2, 4)];
      state.weapons.nextProjectileId = 3;
    });
    step(simulation);
    expect(simulation.getState().streamRewards.find((entry) => entry.id === 1)).toBeUndefined();
    expect(simulation.getState().squad.rifleCounts[0]).toBe(2);
    expect(simulation.getState().projectiles).toHaveLength(0);
  });

  it.each([
    { projectileTier: 1, rewardTier: 1 },
    { projectileTier: 1, rewardTier: 4 },
    { projectileTier: 4, rewardTier: 4 },
    { projectileTier: 4, rewardTier: 3 },
    { projectileTier: 7, rewardTier: 4 },
    { projectileTier: 10, rewardTier: 9 },
  ])('consumes every rifle tier at reward $projectileTier → $rewardTier',
    ({ projectileTier, rewardTier }) => {
      const simulation = create(level);
      restoreWith(simulation, (state) => {
        state.streamRewards = [reward(1, rewardTier, 5)];
        state.projectiles = [shot(1, projectileTier)];
        state.weapons.nextProjectileId = 2;
        state.weapons.rifleCooldownRemainingSeconds = 100;
      });
      step(simulation);
      expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
      expect(simulation.getState().projectiles).toHaveLength(0);
    });

  it('spends high-tier fire on the reward instead of clearing an enemy behind it', () => {
    const simulation = create(level);
    restoreWith(simulation, (state) => {
      state.streamRewards = [reward(1, 2, 5)];
      state.enemies = [enemy(1, 1, 5.6)];
      state.projectiles = [shot(1, 10)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().enemies).toHaveLength(1);
    expect(simulation.getState().projectiles).toHaveLength(0);
  });

  it('unlocks exactly one soldier of the reward tier after ten mixed rifle hits', () => {
    const simulation = create(level);
    restoreWith(simulation, (state) => {
      state.streamRewards = [reward(1, 2, 5)];
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    for (let hit = 0; hit < 10; hit++) {
      restoreWith(simulation, (state) => {
        state.projectiles = [shot(hit + 1, hit % 2 ? 10 : 1)];
        state.weapons.nextProjectileId = hit + 2;
      });
      step(simulation);
      expect(simulation.getState().projectiles).toHaveLength(0);
      if (hit < 9) expect(simulation.getState().streamRewards[0].hitProgress).toBe(hit + 1);
    }
    expect(simulation.getState().streamRewards.find((entry) => entry.id === 1)).toBeUndefined();
    expect(simulation.getState().squad.rifleCounts).toEqual([1, 1]);
  });

  it('leaves rewards transparent to rocket fire', () => {
    const simulation = create(level);
    restoreWith(simulation, (state) => {
      state.streamRewards = [reward(1, 4, 5)];
      state.projectiles = [{ ...shot(1, 1), kind: 'rocket', tier: 0,
        damage: 15, blastRadius: 1.25, penetrationRemaining: 0 }];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);
    expect(simulation.getState().projectiles).toHaveLength(1);
  });

  it('generic contact cost demotes Tier-4 and rocket defense remains last', () => {
    const simulation = create();
    restoreWith(simulation, (state) => {
      state.squad = { count: 2, rocketCount: 1, rifleCounts: [0, 0, 0, 1], rifleRemainder: 0 };
      state.enemies = [enemy(1, 3, 0)];
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 10, rocketCount: 1, rifleCounts: [0, 0, 9], rifleRemainder: 0 });
    expect(squadDefenseValue(simulation.getState().squad, 10)).toBe(901);
    expect(damageFeedback(1001, 901)).toBe('normal');
  });

  it('awards Tier-4 from ten Tier-3 rewards and preserves a Tier-4 snapshot', () => {
    const simulation = create(level);
    restoreWith(simulation, (state) => {
      state.squad = { count: 9, rocketCount: 0, rifleCounts: [0, 0, 9], rifleRemainder: 0 };
      state.streamRewards = [reward(1, 3, 5, 9)];
      state.projectiles = [shot(1, 4)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
    });
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0,
      rifleCounts: [0, 0, 0, 1], rifleRemainder: 0 });
    const replay = create(level);
    replay.restoreState(simulation.getState());
    expect(replay.getState()).toEqual(simulation.getState());
  });

  it('all rifle tiers stop on Boss and Boss contact remains fatal', () => {
    const stream = level.enemyStream!;
    const nearFirst = { ...level, enemyStream: { ...stream, spawnAheadDistance: 110 } };
    for (const tier of [1, 2, 3, 4]) {
      const simulation = create(nearFirst);
      const boss = simulation.getState().boss!;
      restoreWith(simulation, (state) => {
        state.enemies = [];
        state.projectiles = [shot(1, tier, boss.z - 4)];
        state.weapons.nextProjectileId = 2;
        state.weapons.rifleCooldownRemainingSeconds = 100;
      });
      step(simulation);
      expect(simulation.getState().projectiles).toHaveLength(0);
      expect(simulation.getState().boss?.hp ?? 0).toBe(Math.max(0, boss.hp - enemyPowerForTier(tier, config.tiers)));
    }
    const simulation = create(nearFirst);
    const bossZ = simulation.getState().boss!.z;
    restoreWith(simulation, (state) => { state.player.z = bossZ - 2.1; state.enemies = []; });
    simulation.step(0.2, idle, { ...tuning, forwardSpeed: 1,
      rifle: { ...tuning.rifle, fireRate: 0.01 } });
    expect(simulation.getState().squad.count).toBe(0);
  });
});
