import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { ProjectileSimulationState } from '../src/simulation/SimulationState';
import { rifleHitRadiusBonusForTier } from '../src/simulation/weapons/rifleHitRadius';

const config = GameConfigSchema.parse(gameData);
const isolated = LevelDefinitionSchema.parse({ id: 'corridor', length: 1000,
  enemyGroups: [], upgradeGates: [] });
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, normalEnemyRadius: 0.3, bossRadius: 2,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket },
};
const make = (level = isolated) => new Simulation({ seed: 1, level,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers });
const shot = (tier: number, bonus = rifleHitRadiusBonusForTier(tier, 0.45, 0.9)): ProjectileSimulationState => ({
  id: 1, kind: 'rifle', tier, x: 0, z: 0, speed: 100, damage: tier === 1 ? 3 : 300,
  remainingRange: 100, blastRadius: 0, hitRadiusBonus: bonus,
  penetrationRemaining: tier === 1 ? 0 : (10n ** BigInt(tier - 1)).toString(),
});
const advance = (simulation: Simulation) => simulation.step(0.2, { targetX: 0 }, tuning);

describe('tier rifle fire corridor', () => {
  it('uses authored bounded tier bonuses and rejects invalid config', () => {
    expect([1, 2, 3, 20].map((tier) => rifleHitRadiusBonusForTier(tier, 0.45, 0.9)))
      .toEqual([0, 0.45, 0.9, 0.9]);
    expect(rifleHitRadiusBonusForTier(20, 0, 0.9)).toBe(0);
    expect(rifleHitRadiusBonusForTier(20, 0.45, 0)).toBe(0);
    for (const [key, value] of [['tierHitRadiusStep', -1], ['tierHitRadiusStep', Infinity],
      ['maxHitRadiusBonus', -1], ['maxHitRadiusBonus', NaN]] as const) {
      expect(() => GameConfigSchema.parse({ ...config, weapon: { ...config.weapon,
        rifle: { ...config.weapon.rifle, [key]: value } } })).toThrow();
    }
  });

  it('captures the bonus at fire time, including zero for rockets, and roundtrips state', () => {
    for (const [tier, bonus] of [[1, 0], [2, 0.45], [3, 0.9], [20, 0.9]]) {
      const simulation = make();
      const state = simulation.getState();
      state.squad = { count: 1, rocketCount: 0,
        rifleCounts: [...Array(tier - 1).fill(0), 1], rifleRemainder: 0 };
      simulation.restoreState(state);
      simulation.step(0.01, { targetX: 0 }, tuning);
      expect(simulation.getState().projectiles[0].hitRadiusBonus).toBe(bonus);
      const saved = JSON.parse(JSON.stringify(simulation.getState()));
      simulation.restoreState(saved);
      expect(simulation.getState().projectiles[0].hitRadiusBonus).toBe(bonus);
      simulation.step(0.01, { targetX: 0 }, { ...tuning,
        rifle: { ...tuning.rifle, tierHitRadiusStep: 0, maxHitRadiusBonus: 0 } });
      expect(simulation.getState().projectiles[0].hitRadiusBonus).toBe(bonus);
    }
    const simulation = make();
    const state = simulation.getState();
    state.squad = { count: 1, rocketCount: 1, rifleCounts: [], rifleRemainder: 0 };
    simulation.restoreState(state);
    simulation.step(0.01, { targetX: 0 }, tuning);
    expect(simulation.getState().projectiles[0].hitRadiusBonus).toBe(0);
  });

  it('rejects malformed captured projectile widths', () => {
    const simulation = make();
    for (const bonus of [-1, Infinity, NaN]) {
      const state = simulation.getState();
      state.projectiles = [{ ...shot(2), hitRadiusBonus: bonus }];
      state.weapons.nextProjectileId = 2;
      expect(() => simulation.restoreState(state)).toThrow(/hitRadiusBonus/);
    }
    const rocket = simulation.getState();
    rocket.projectiles = [{ ...shot(1), kind: 'rocket', tier: 0,
      blastRadius: 1.25, hitRadiusBonus: 0.45 }];
    rocket.weapons.nextProjectileId = 2;
    expect(() => simulation.restoreState(rocket)).toThrow(/hitRadiusBonus/);
  });

  it('widens normal-enemy hits only by the captured tier radius', () => {
    for (const [tier, offset, hit] of [[1, 0.4, false], [2, 0.6, true],
      [2, 0.9, false], [3, 1.1, true], [20, 1.25, false]] as const) {
      const simulation = make();
      const state = simulation.getState();
      state.enemies = [{ id: 1, tier: 1, x: offset, z: 5, hp: 3 }];
      state.projectiles = [shot(tier)];
      state.weapons.nextProjectileId = 2;
      state.weapons.rifleCooldownRemainingSeconds = 100;
      simulation.restoreState(state);
      advance(simulation);
      expect(simulation.getState().enemies.length === 0).toBe(hit);
    }
  });

  it('uses the existing penetration budget across columns and still stops at same tier', () => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies = [{ id: 1, tier: 1, x: -0.6, z: 5, hp: 3 },
      { id: 2, tier: 1, x: 0.6, z: 6, hp: 3 },
      { id: 3, tier: 2, x: 0, z: 7, hp: 300 },
      { id: 4, tier: 1, x: 0, z: 8, hp: 3 }];
    state.projectiles = [shot(2)];
    state.weapons.nextProjectileId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    advance(simulation);
    expect(simulation.getState().enemies.map((enemy) => enemy.id)).toEqual([4]);
    expect(simulation.getState().projectiles).toHaveLength(0);
  });

  it('does not widen side reward or Boss targeting', () => {
    const level = LevelDefinitionSchema.parse(levelData);
    const simulation = make(level);
    const state = simulation.getState();
    state.enemies = [];
    state.streamRewards = [{ id: state.enemyStream!.nextRewardId, tier: 1,
      x: 0.7, z: 5, hitProgress: 0, hitsRequired: 10 }];
    state.enemyStream!.nextRewardId++;
    state.projectiles = [shot(3)];
    state.weapons.nextProjectileId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    advance(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);

    const bossLevel = LevelDefinitionSchema.parse({ ...levelData,
      enemyStream: { ...levelData.enemyStream, spawnAheadDistance: 116 } });
    const bossSimulation = make(bossLevel);
    const withBoss = bossSimulation.getState();
    const boss = withBoss.boss!;
    withBoss.enemies = [];
    withBoss.projectiles = [{ ...shot(3), x: boss.x + 2.3, z: boss.z - 4 }];
    withBoss.weapons.nextProjectileId = 2;
    withBoss.weapons.rifleCooldownRemainingSeconds = 100;
    bossSimulation.restoreState(withBoss);
    advance(bossSimulation);
    expect(bossSimulation.getState().boss?.hp).toBe(boss.hp);
  });
});
