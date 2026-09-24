import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { rewardPlacementForBlock } from '../src/simulation/enemies/streamRewards';
import type { ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(gameData);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;
const tuning: SimulationTuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, bruteRadius: 0.3, tier3Radius: 0.3, bossRadius: config.bosses.basic.radius,
  rifle: { ...config.weapon.rifle, fireRate: 0.01, projectileSpeed: 1, range: 1 },
  rocket: { ...config.weapon.rocket, fireRate: 0.01, projectileSpeed: 1, range: 1 } };
const create = (gruntHp = 3) => new Simulation({ seed: 7, level, startSquad: 1,
  startRocketCount: 0, gruntHp, bruteHp: 300, tier3Hp: 3000,
  bossHpMultiplier: config.bosses.basic.hpMultiplier });
const shot = (kind: ProjectileSimulationState['kind'], damage: number, id = 1): ProjectileSimulationState =>
  ({ id, kind, x: 0, z: 47.5, speed: 100, damage, remainingRange: 40,
    blastRadius: kind === 'rocket' ? 1.25 : 0,
    penetrationRemaining: kind === 'heavyRifle' ? 10 : 0 });
function prepare(sim: Simulation, projectiles: ProjectileSimulationState[]): void {
  const state = sim.getState();
  state.enemies = [];
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = Math.max(2, ...projectiles.map((projectile) => projectile.id + 1));
  sim.restoreState(state);
}
const step = (sim: Simulation, dt = 0.1, changes: Partial<SimulationTuning> = {}) =>
  sim.step(dt, { targetX: 0 }, { ...tuning, ...changes });

describe('first Tier-1 Boss', () => {
  it('validates the authored encounter and derives HP from Tier-1 HP', () => {
    expect(config.bosses.basic).toEqual({ hpMultiplier: 100, visualScale: 7, radius: 2 });
    expect(stream.boss).toEqual({ row: 44, tier: 1 });
    expect(create().getState().boss).toMatchObject({ id: 309, tier: 1, x: 0,
      z: 24 + 44 * 0.6, hp: 300, maxHp: 300 });
    expect(create(5).getState().boss).toMatchObject({ hp: 500, maxHp: 500 });
    for (const key of ['hp', 'moveSpeed']) {
      expect(() => GameConfigSchema.parse({ ...config, bosses: { basic: {
        ...config.bosses.basic, [key]: 1 } } })).toThrow();
    }
    for (const hpMultiplier of [0, -1, Infinity]) {
      expect(() => GameConfigSchema.parse({ ...config, bosses: { basic: {
        ...config.bosses.basic, hpMultiplier } } })).toThrow();
    }
    for (const visualScale of [1, 0, Infinity]) {
      expect(() => GameConfigSchema.parse({ ...config, bosses: { basic: {
        ...config.bosses.basic, visualScale } } })).toThrow();
    }
    for (const radius of [0, -1, Infinity]) {
      expect(() => GameConfigSchema.parse({ ...config, bosses: { basic: {
        ...config.bosses.basic, radius } } })).toThrow();
    }
    for (const boss of [{ row: -1, tier: 1 }, { row: 1.5, tier: 1 },
      { row: 44, tier: 2 }, { row: 44, tier: 1, extra: true }]) {
      expect(() => LevelDefinitionSchema.parse({ ...level,
        enemyStream: { ...stream, boss } })).toThrow();
    }
  });

  it('stops at row 44, defers future rewards, and resumes unchanged rows after death', () => {
    const sim = create();
    const initial = sim.getState();
    expect(initial.enemyStream).toMatchObject({ nextRowIndex: 45, nextEnemyId: 310, bossSpawned: true });
    expect(initial.enemies).toHaveLength(44 * 7);
    expect(initial.enemies.every((enemy) => enemy.z < initial.boss!.z)).toBe(true);
    expect(initial.enemies.every((enemy) => enemy.type === 'grunt')).toBe(true);
    expect(initial.enemies.some((enemy) => enemy.id === initial.boss!.id)).toBe(false);
    const clearLane = sim.getState();
    clearLane.enemies = [];
    clearLane.weapons.rifleCooldownRemainingSeconds = 100;
    clearLane.weapons.rocketCooldownRemainingSeconds = 100;
    sim.restoreState(clearLane);
    step(sim, 1, { forwardSpeed: 25 });
    const gated = sim.getState();
    expect(gated.boss).not.toBeNull();
    expect(gated.enemyStream!.nextRowIndex).toBe(45);
    expect(gated.streamRewards.every((reward) => reward.z < initial.boss!.z + 0.3)).toBe(true);
    const pendingBlock = Array.from({ length: 10 }, (_, index) => index).find((block) =>
      rewardPlacementForBlock(block, stream.columns, stream.rewards!).rowIndex > 44)!;
    expect(gated.enemyStream!.nextRewardBlockIndex).toBeLessThanOrEqual(pendingBlock);
    prepare(sim, [shot('heavyRifle', 300)]);
    step(sim);
    expect(sim.getState().boss).toBeNull();
    expect(sim.getState().enemyStream!.nextRowIndex).toBe(45);
    step(sim);
    const resumed = sim.getState();
    expect(resumed.enemyStream!.nextRowIndex).toBeGreaterThan(48);
    expect(resumed.enemies.some((enemy) => enemy.id === 310)).toBe(true);
    expect(resumed.enemies.some((enemy) => enemy.type === 'brute')).toBe(true);
    expect(resumed.streamRewards.some((reward) => reward.z > initial.boss!.z)).toBe(true);
    expect(resumed.boss).toBeNull();
    expect(resumed.enemyStream!.bossSpawned).toBe(true);
  });

  it('uses swept ordering and stops rifle, heavy, and rocket shots on the Boss', () => {
    for (const [kind, damage] of [['rifle', 3], ['heavyRifle', 300], ['rocket', 15]] as const) {
      const sim = create();
      prepare(sim, [shot(kind, damage)]);
      step(sim);
      expect(sim.getState().boss?.hp ?? 0).toBe(300 - damage);
      expect(sim.getState().projectiles).toEqual([]);
    }
    const sim = create();
    const state = sim.getState();
    state.enemies = [{ id: 1, type: 'grunt', x: 0, z: 47.8, hp: 3 },
      { id: 2, type: 'grunt', x: 0, z: 52.5, hp: 3 }];
    state.projectiles = [shot('heavyRifle', 300)];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    state.weapons.rocketCooldownRemainingSeconds = 100;
    state.weapons.nextProjectileId = 2;
    sim.restoreState(state);
    step(sim);
    expect(sim.getState().enemies.map((enemy) => enemy.id)).toEqual([2]);
    expect(sim.getState().boss).toBeNull();
  });

  it('makes geometric contact and defense-line passage fatal', () => {
    const contact = create();
    let state = contact.getState();
    state.enemies = [];
    state.player.z = 47;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    state.weapons.rocketCooldownRemainingSeconds = 100;
    contact.restoreState(state);
    step(contact, 1, { forwardSpeed: 2 });
    expect(contact.getState().squad).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0 });
    const cursor = contact.getState().enemyStream!.nextRowIndex;
    step(contact);
    expect(contact.getState().enemyStream!.nextRowIndex).toBe(cursor);

    const breach = create();
    state = breach.getState();
    state.enemies = [];
    state.player.z = state.boss!.z + 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    state.weapons.rocketCooldownRemainingSeconds = 100;
    breach.restoreState(state);
    step(breach);
    expect(breach.getState().squad.count).toBe(0);
  });

  it('restores alive/defeated progression and retries with one identical Boss', () => {
    const sim = create();
    prepare(sim, [shot('rifle', 3)]);
    step(sim);
    const damaged = sim.getState();
    expect(damaged.boss?.hp).toBe(297);
    const parsed = JSON.parse(JSON.stringify(damaged)) as SimulationState;
    const restored = create();
    restored.restoreState(parsed);
    expect(restored.getState()).toEqual(damaged);
    parsed.boss!.hp = 1;
    parsed.enemyStream!.nextRowIndex = 99;
    expect(restored.getState()).toEqual(damaged);
    prepare(sim, [shot('heavyRifle', 300)]);
    step(sim);
    const defeated = sim.getState();
    restored.restoreState(defeated);
    step(restored);
    expect(restored.getState().boss).toBeNull();
    expect(restored.getState().enemyStream!.nextRowIndex).toBeGreaterThan(45);
    expect(create().getState().boss).toEqual({ id: 309, tier: 1, x: 0,
      z: 50.4, hp: 300, maxHp: 300 });
    for (const change of [
      (value: SimulationState) => { value.boss!.hp = 301; },
      (value: SimulationState) => { value.boss!.id = value.enemies[0].id; },
      (value: SimulationState) => { value.enemyStream!.bossSpawned = false; },
      (value: SimulationState) => { value.boss!.tier = 2 as 1; },
    ]) {
      const alive = create().getState();
      change(alive);
      expect(() => create().restoreState(alive)).toThrow();
    }
  });
});
