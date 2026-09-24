import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';
import { addRifleSoldiers, afterCasualties, normalizeRifleSquad, tier1RifleCount } from '../src/simulation/squad/composition';
import { squadDefenseValue, damageFeedback } from '../src/app/combatFeedback';
import { GameConfigSchema } from '../src/config/configSchema';
import gameData from '../public/game-data/game.json';

const level: LevelDefinition = { id: 'tier3-test', length: 100, enemyGroups: [], upgradeGates: [],
  enemyStream: { enemy: 'grunt', startZ: 5, spawnAheadDistance: 5.5, columns: 1,
    spacing: 10, jitter: 0, seed: 1, bruteRamp: { startRow: 48, fullRow: 144, curvePower: 2 },
    rewards: { rowsPerReward: 8, spawnAheadDistance: 5.5, hitsRequired: 10, seed: 2, sideX: 2.2 } } };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, bruteRadius: 0.3, tier3Radius: 0.3, bossRadius: 2,
  rifle: { damage: 3, tier2DamageMultiplier: 100, tier3DamageMultiplier: 1000,
    fireRate: 7, projectileSpeed: 28, range: 40 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 },
};
const create = (startSquad = 1) => new Simulation({ seed: 11, level, startSquad,
  startRocketCount: 0, gruntHp: 3, bruteHp: 300, tier3Hp: 3000 });
const enemy = (id: number, type: EnemySimulationState['type'], z: number): EnemySimulationState =>
  ({ id, type, x: 0, z, hp: type === 'grunt' ? 3 : type === 'brute' ? 300 : 3000 });
const tier3Shot = (): ProjectileSimulationState => ({ id: 1, kind: 'tier3Rifle', x: 0, z: 0,
  speed: 100, damage: 3000, remainingRange: 40, blastRadius: 0, penetrationRemaining: 100 });

function withShot(enemies: EnemySimulationState[], rewards: SimulationState['streamRewards'] = []) {
  const sim = create();
  const state = sim.getState();
  state.enemies = enemies;
  state.streamRewards = rewards;
  state.enemyStream!.nextEnemyId = Math.max(1, ...enemies.map((target) => target.id + 1));
  state.enemyStream!.nextRewardId = Math.max(1, ...rewards.map((target) => target.id + 1));
  state.projectiles = [tier3Shot()];
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = 2;
  sim.restoreState(state);
  return sim;
}

describe('player Tier-3 composition', () => {
  it('cascades ten Tier-2 rifles and a hundred Tier-1 rifles into Tier-3', () => {
    const t1 = (count: number) => normalizeRifleSquad({ count, rocketCount: 0,
      tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(t1(99)).toEqual({ count: 18, rocketCount: 0, tier2RifleCount: 9, tier3RifleCount: 0 });
    expect(t1(100)).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 1 });
    expect(normalizeRifleSquad({ count: 10, rocketCount: 0, tier2RifleCount: 10,
      tier3RifleCount: 0 })).toEqual(t1(100));
    expect(addRifleSoldiers(t1(90), 1, 2)).toEqual(t1(100));
    expect(addRifleSoldiers(t1(100), 1, 3)).toMatchObject({ tier3RifleCount: 2, count: 2 });
    const mixed = normalizeRifleSquad({ count: 102, rocketCount: 2, tier2RifleCount: 0,
      tier3RifleCount: 0 });
    expect(mixed).toEqual({ count: 3, rocketCount: 2, tier2RifleCount: 0, tier3RifleCount: 1 });
    expect(tier1RifleCount(mixed)).toBe(0);
  });

  it('rejects invalid Tier-3 counts and demotes by exact defense value with rockets last', () => {
    expect(() => tier1RifleCount({ count: 1, rocketCount: 0, tier2RifleCount: 0,
      tier3RifleCount: 2 })).toThrow();
    const restored = create();
    const invalid = restored.getState();
    invalid.squad = { count: 1, rocketCount: 0, tier2RifleCount: 1, tier3RifleCount: 1 };
    expect(() => restored.restoreState(invalid)).toThrow();
    expect(restored.getState().squad.tier3RifleCount).toBe(0);
    const t3 = { count: 1, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 1 };
    expect(squadDefenseValue(t3)).toBe(100);
    for (const [cost, t2, t1] of [[1, 9, 9], [10, 9, 0], [15, 8, 5],
      [99, 0, 1], [100, 0, 0]]) {
      const result = afterCasualties(t3, cost);
      expect(result).toEqual({ count: t2 + t1, rocketCount: 0,
        tier2RifleCount: t2, tier3RifleCount: 0 });
      expect(squadDefenseValue(result)).toBe(100 - cost);
    }
    expect(damageFeedback(100, squadDefenseValue(afterCasualties(t3, 1)))).toBe('normal');
    expect(afterCasualties({ count: 2, rocketCount: 1, tier2RifleCount: 0,
      tier3RifleCount: 1 }, 100)).toMatchObject({ count: 1, rocketCount: 1 });
  });
});

describe('Tier-3 rifle combat', () => {
  it('uses strict authored Tier-2 and Tier-3 damage multipliers', () => {
    expect(GameConfigSchema.parse(gameData).weapon.rifle).toMatchObject({ damage: 3,
      tier2DamageMultiplier: 100, tier3DamageMultiplier: 1000 });
    for (const field of ['tier2DamageMultiplier', 'tier3DamageMultiplier'] as const) {
      const invalid = structuredClone(gameData);
      invalid.weapon.rifle[field] = 0;
      expect(() => GameConfigSchema.parse(invalid)).toThrow();
    }
  });

  it('fires one 3000-damage shot at the shared rifle cadence with captured tuning', () => {
    const sim = create(100);
    sim.step(0.01, { targetX: 0 }, tuning);
    expect(sim.getState().squad).toMatchObject({ count: 1, tier3RifleCount: 1 });
    expect(sim.getState().projectiles).toMatchObject([{ kind: 'tier3Rifle', damage: 3000,
      speed: 28, remainingRange: expect.any(Number), penetrationRemaining: 100 }]);
    const saved = JSON.parse(JSON.stringify(sim.getState())) as SimulationState;
    const restored = create();
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(sim.getState());
    for (const value of [0, 101, 1.5]) {
      const invalid = structuredClone(saved);
      invalid.projectiles[0].penetrationRemaining = value;
      expect(() => restored.restoreState(invalid)).toThrow();
    }
    sim.step(0.01, { targetX: 0 }, { ...tuning,
      rifle: { ...tuning.rifle, damage: 4 } });
    expect(sim.getState().projectiles[0].damage).toBe(3000);
    const ready = sim.getState();
    ready.projectiles = [];
    ready.weapons.rifleCooldownRemainingSeconds = 0;
    sim.restoreState(ready);
    sim.step(0.01, { targetX: 0 }, { ...tuning,
      rifle: { ...tuning.rifle, damage: 4 } });
    expect(sim.getState().projectiles[0].damage).toBe(4000);
  });

  it('fires Tier-1, Tier-2, and Tier-3 roles once per shared volley', () => {
    const sim = create();
    const state = sim.getState();
    state.enemies = [];
    state.squad = { count: 3, rocketCount: 0, tier2RifleCount: 1,
      tier3RifleCount: 1 };
    state.weapons.rifleCooldownRemainingSeconds = 0;
    state.weapons.rocketCooldownRemainingSeconds = 100;
    sim.restoreState(state);
    sim.step(0.01, { targetX: 0 }, tuning);
    expect(sim.getState().projectiles.map((shot) => [shot.kind, shot.damage,
      shot.speed, shot.remainingRange, shot.blastRadius])).toEqual([
      ['rifle', 3, 28, 39.72, 0],
      ['heavyRifle', 300, 28, 39.72, 0],
      ['tier3Rifle', 3000, 28, 39.72, 0],
    ]);
  });

  it('spends one point per Tier-1, ten per Tier-2, and stops on Tier-3', () => {
    const targets = [enemy(1, 'grunt', 5), enemy(2, 'brute', 6),
      enemy(3, 'grunt', 7), enemy(4, 'tier3', 8), enemy(5, 'grunt', 9)];
    const sim = withShot(targets);
    sim.step(0.2, { targetX: 0 }, tuning);
    expect(sim.getState().enemies).toEqual([enemy(5, 'grunt', 9)]);
    expect(sim.getState().projectiles).toEqual([]);
    const tenBrutes = withShot(Array.from({ length: 11 }, (_, i) => enemy(i + 1, 'brute', 4 + i * 0.6)));
    tenBrutes.step(0.2, { targetX: 0 }, tuning);
    expect(tenBrutes.getState().enemies).toEqual([enemy(11, 'brute', 10)]);
    expect(tenBrutes.getState().projectiles).toEqual([]);
    const manyGrunts = withShot(Array.from({ length: 101 }, (_, i) => enemy(i + 1, 'grunt', 4 + i * 0.1)));
    manyGrunts.step(0.2, { targetX: 0 }, tuning);
    expect(manyGrunts.getState().enemies).toEqual([enemy(101, 'grunt', 14)]);
  });

  it('progresses lower-tier rewards without spending penetration or stopping', () => {
    const sim = withShot([enemy(1, 'grunt', 11), enemy(2, 'brute', 12)], [
      { id: 1, tier: 1, x: 0, z: 9, hitProgress: 0, hitsRequired: 10 },
      { id: 2, tier: 2, x: 0, z: 10, hitProgress: 0, hitsRequired: 10 },
    ]);
    sim.step(0.2, { targetX: 0 }, tuning);
    expect(sim.getState().streamRewards.map((r) => r.hitProgress)).toEqual([1, 1]);
    expect(sim.getState().enemies).toEqual([]);
    expect(sim.getState().projectiles).toMatchObject([{ penetrationRemaining: 89 }]);
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(sim.getState())) as SimulationState);
    sim.step(0.1, { targetX: 0 }, tuning);
    restored.step(0.1, { targetX: 0 }, tuning);
    expect(restored.getState()).toEqual(sim.getState());
  });

  it('stops on a Boss even with penetration remaining', () => {
    const bossLevel: LevelDefinition = { ...level,
      enemyStream: { ...level.enemyStream!, boss: { row: 1, tier: 1 } } };
    const sim = new Simulation({ seed: 11, level: bossLevel, startSquad: 1,
      startRocketCount: 0, gruntHp: 3, bruteHp: 300, tier3Hp: 3000,
      bossHpMultiplier: 5000 });
    const state = sim.getState();
    state.enemies = [];
    state.enemyStream!.nextRowIndex = 2;
    state.enemyStream!.nextEnemyId = 3;
    state.enemyStream!.bossSpawned = true;
    state.boss = { id: 2, tier: 1, x: 0, z: 15, hp: 15000, maxHp: 15000 };
    state.projectiles = [tier3Shot()];
    state.weapons.nextProjectileId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    sim.restoreState(state);
    sim.step(0.2, { targetX: 0 }, tuning);
    expect(sim.getState().boss?.hp).toBe(12000);
    expect(sim.getState().projectiles).toEqual([]);
  });
});
