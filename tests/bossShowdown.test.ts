import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { compactRifleValue, rifleDefenseValue } from '../src/simulation/squad/composition';
import { bossMaxHpForTier, bossRowForTier, exchangeValueForTier } from '../src/simulation/tiers/tierRules';

const config = GameConfigSchema.parse(configData);
const authored = LevelDefinitionSchema.parse(levelData);
const level = { ...authored, enemyStream: { ...authored.enemyStream!, spawnAheadDistance: 110 } };
const dt = 1 / 60;
const tuning: SimulationTuning = {
  moveSpeed: 5, forwardSpeed: 2, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
  normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket },
};

function setup(value: bigint, rocketCount = 0): Simulation {
  const simulation = new Simulation({ seed: 17, level, startSquad: 1,
    startRocketCount: 0, tiers: config.tiers });
  const state = simulation.getState();
  const boss = state.boss!;
  state.player.z = boss.z - 2.1;
  state.enemies = [];
  state.streamRewards = [];
  state.squad = compactRifleValue(value, config.tiers.mergeCount, rocketCount);
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  simulation.restoreState(state);
  simulation.step(dt, { targetX: 0 }, tuning);
  expect(simulation.getState().boss?.engaged).toBe(true);
  return simulation;
}

function advance(simulation: Simulation, ticks: number): void {
  for (let index = 0; index < ticks; index++) simulation.step(dt, { targetX: 0 }, tuning);
}

describe('Boss melee showdown', () => {
  it('engages without instant wipe, freezes forward stream, and allows horizontal movement and fire', () => {
    const simulation = setup(100n);
    const before = simulation.getState();
    expect(before.squad.count).toBeGreaterThan(0);
    expect(before.boss?.slamCooldownRemainingSeconds).toBe(.6);
    const cursor = { ...before.enemyStream };
    const z = before.player.z;
    simulation.step(dt, { targetX: 1 }, tuning);
    expect(simulation.getState().player.x).toBeGreaterThan(0);
    expect(simulation.getState().player.z).toBe(z);
    expect(simulation.getState().enemyStream).toEqual(cursor);
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    simulation.step(dt, { targetX: 1 }, tuning);
    expect(simulation.getState().weapons.nextProjectileId).toBeGreaterThan(state.weapons.nextProjectileId);
  });

  it('waits for wind-up, removes an exact Tier-equivalent value, then repeats every two seconds', () => {
    const loss = exchangeValueForTier(2, config.tiers.mergeCount);
    const simulation = setup(3n * loss);
    advance(simulation, 35);
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(3n * loss);
    expect(simulation.getState().boss?.slamCount).toBe(0);
    advance(simulation, 1);
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(2n * loss);
    expect(simulation.getState().boss?.slamCount).toBe(1);
    advance(simulation, 119);
    expect(simulation.getState().boss?.slamCount).toBe(1);
    advance(simulation, 1);
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(loss);
    expect(simulation.getState().boss?.slamCount).toBe(2);
  });

  it('demotes higher tiers and preserves mixed exact remainder and rockets', () => {
    const simulation = setup(100n + 13n, 2);
    advance(simulation, 36);
    const squad = simulation.getState().squad;
    expect(rifleDefenseValue(squad, 10)).toBe(103n);
    expect(squad.rocketCount).toBe(2);
    const higher = setup(exchangeValueForTier(20, 10) + 7n);
    advance(higher, 36);
    expect(rifleDefenseValue(higher.getState().squad, 10))
      .toBe(exchangeValueForTier(20, 10) - 3n);
  });

  it('uses exact Tier 20 Boss damage and never advances a second Boss while engaged', () => {
    const simulation = setup(20n);
    const state = simulation.getState();
    const tier = 20;
    const loss = exchangeValueForTier(tier + 1, 10);
    state.squad = compactRifleValue(2n * loss + 7n, 10);
    state.boss!.tier = tier;
    state.boss!.z = level.enemyStream.startZ
      + bossRowForTier(tier, level.enemyStream.tierProgression) * level.enemyStream.spacing;
    state.boss!.maxHp = bossMaxHpForTier(tier, level.enemyStream.tierProgression, config.tiers);
    state.boss!.hp = state.boss!.maxHp;
    state.player.z = state.boss!.z - 2.1;
    state.enemyStream!.nextRowIndex = bossRowForTier(tier, level.enemyStream.tierProgression) + 1;
    state.enemyStream!.nextBossTier = tier + 1;
    simulation.restoreState(state);
    const cursor = simulation.getState().enemyStream;
    advance(simulation, 36);
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(loss + 7n);
    expect(simulation.getState().enemyStream).toEqual(cursor);
    expect(simulation.getState().boss?.tier).toBe(20);
  });

  it('uses existing last-loss rocket casualty semantics', () => {
    const simulation = setup(0n, 12);
    advance(simulation, 36);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 2,
      rifleCounts: [], rifleRemainder: 0 });
  });

  it('cancels pending attack on death and resumes progression on the next tick', () => {
    const simulation = setup(20n);
    const state = simulation.getState();
    state.boss!.hp = 1;
    state.projectiles = [{ id: state.weapons.nextProjectileId++, kind: 'rifle', tier: 1,
      x: 0, z: state.boss!.z - 0.5, speed: 60, damage: 10, remainingRange: 80,
      blastRadius: 0, penetrationRemaining: 0 }];
    simulation.restoreState(state);
    simulation.step(dt, { targetX: 0 }, tuning);
    expect(simulation.getState().boss).toBeNull();
    const z = simulation.getState().player.z;
    simulation.step(dt, { targetX: 0 }, tuning);
    expect(simulation.getState().player.z).toBeGreaterThan(z);
  });

  it('keeps fatal battlefield static, clears bullets, and roundtrips snapshots', () => {
    const simulation = setup(10n);
    const snapshot = JSON.parse(JSON.stringify(simulation.getState()));
    const restored = setup(10n);
    restored.restoreState(snapshot);
    expect(restored.getState()).toEqual(snapshot);
    advance(simulation, 36);
    const dead = simulation.getState();
    expect(dead.squad).toEqual({ count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 });
    expect(dead.boss?.slamCount).toBe(1);
    expect(dead.projectiles).toHaveLength(0);
    advance(simulation, 10_000);
    expect(simulation.getState()).toEqual(dead);
  });
});
