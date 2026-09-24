import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, bossMaxHpForTier, type SimulationTuning } from '../src/simulation/Simulation';
import { rewardPlacementForBlock } from '../src/simulation/enemies/streamRewards';
import type { ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(gameData);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;
const bossRow = stream.bosses![0].row;
const bossZ = stream.startZ + bossRow * stream.spacing;
const tuning: SimulationTuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, bruteRadius: 0.3, tier3Radius: 0.3, bossRadius: config.bosses.basic.radius,
  rifle: { ...config.weapon.rifle, fireRate: 0.01, projectileSpeed: 1, range: 1 },
  rocket: { ...config.weapon.rocket, fireRate: 0.01, projectileSpeed: 1, range: 1 } };
const create = (gruntHp = 3) => new Simulation({ seed: 7, level, startSquad: 1,
  startRocketCount: 0, gruntHp, bruteHp: 300, tier3Hp: 3000 });
const step = (sim: Simulation, dt = 0.1, changes: Partial<SimulationTuning> = {}) =>
  sim.step(dt, { targetX: 0 }, { ...tuning, ...changes });

// A valid snapshot just before the Boss enters the enemy horizon keeps
// these tests focused on spatial materialization instead of hundreds of ticks.
function approachBoss(sim: Simulation, playerZ = bossZ - 25, encounterIndex = 0): void {
  const row = stream.bosses![encounterIndex].row;
  const state = sim.getState();
  state.player.z = playerZ;
  state.enemies = [];
  state.streamRewards = [];
  state.boss = null;
  state.enemyStream!.nextRowIndex = row;
  state.enemyStream!.nextBossIndex = encounterIndex;
  state.enemyStream!.nextEnemyId = row * stream.columns + encounterIndex + 1;
  state.enemyStream!.nextRewardBlockIndex = Math.floor(row / stream.rewards!.rowsPerReward) - 1;
  state.enemyStream!.nextRewardId = state.enemyStream!.nextRewardBlockIndex + 1;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  sim.restoreState(state);
}

function shot(kind: ProjectileSimulationState['kind'], damage: number): ProjectileSimulationState {
  return { id: 1, kind, x: 0, z: bossZ - 2.5, speed: 100, damage, remainingRange: 40,
    blastRadius: kind === 'rocket' ? 1.25 : 0,
    penetrationRemaining: kind === 'heavyRifle' ? 10 : 0 };
}

function prepareShot(sim: Simulation, projectile: ProjectileSimulationState): void {
  const state = sim.getState();
  state.enemies = [];
  state.projectiles = [projectile];
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = 2;
  sim.restoreState(state);
}

describe('embedded Boss encounters', () => {
  it('validates ordered encounters and derives HP from each normal enemy tier', () => {
    expect(config.bosses.basic).toEqual({ visualScale: 7, radius: 2 });
    expect(config.enemies.grunt.hp).toBe(3);
    expect(stream.bosses).toEqual([{ row: 136, tier: 1, hpMultiplier: 5000 },
      { row: 328, tier: 2, hpMultiplier: 1000 }]);
    expect(bossMaxHpForTier(1, 3, 300, 5000)).toBe(15000);
    expect(bossMaxHpForTier(2, 3, 300, 1000)).toBe(300000);
    expect(bossMaxHpForTier(2, 3, 450, 1000)).toBe(450000);
    expect(create().getState().boss).toBeNull();
    expect(create().getState().enemyStream!.nextBossIndex).toBe(0);
    const sim = create();
    approachBoss(sim);
    step(sim);
    expect(sim.getState().boss).toMatchObject({ tier: 1, x: 0, z: bossZ,
      hp: 15000, maxHp: 15000 });
    const changedHp = create(5);
    approachBoss(changedHp);
    step(changedHp);
    expect(changedHp.getState().boss).toMatchObject({ hp: 25000, maxHp: 25000 });
    for (const key of ['hp', 'moveSpeed', 'hpMultiplier']) {
      expect(() => GameConfigSchema.parse({ ...config, bosses: { basic: {
        ...config.bosses.basic, [key]: 1 } } })).toThrow();
    }
    for (const boss of [{ row: -1, tier: 1, hpMultiplier: 1 },
      { row: 1.5, tier: 1, hpMultiplier: 1 }, { row: 136, tier: 3, hpMultiplier: 1 },
      { row: 136, tier: 1, hpMultiplier: 0 }, { row: 136, tier: 1, hpMultiplier: Infinity },
      { row: 136, tier: 1, hpMultiplier: 1, extra: true }]) {
      expect(() => LevelDefinitionSchema.parse({ ...level,
        enemyStream: { ...stream, bosses: [boss] } })).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...level,
      enemyStream: { ...stream, boss: { row: 136, tier: 1 } } })).toThrow();
    for (const bosses of [[stream.bosses![1], stream.bosses![0]],
      [stream.bosses![0], stream.bosses![0]]]) {
      expect(() => LevelDefinitionSchema.parse({ ...level,
        enemyStream: { ...stream, bosses } })).toThrow();
    }
  });

  it('replaces only row 136 and keeps generating a deterministic army behind a living Boss', () => {
    const sim = create();
    expect(sim.getState().enemyStream!.nextRowIndex).toBeLessThan(bossRow);
    approachBoss(sim);
    step(sim);
    const spawned = sim.getState();
    expect(spawned.boss).not.toBeNull();
    expect(spawned.enemyStream!.nextBossIndex).toBe(1);
    expect(spawned.enemyStream!.nextRowIndex).toBeGreaterThan(bossRow + 1);
    expect(spawned.enemies).toHaveLength((spawned.enemyStream!.nextRowIndex - bossRow - 1) * stream.columns);
    expect(spawned.enemies.every((enemy) => enemy.z > bossZ + stream.spacing - stream.jitter - 0.01)).toBe(true);
    expect(spawned.enemies.some((enemy) => enemy.id === spawned.boss!.id)).toBe(false);
    expect(spawned.enemies.some((enemy) => enemy.type === 'brute')).toBe(true);
    expect(spawned.enemies.some((enemy) => enemy.type === 'tier3')).toBe(true);
    const nextRow = spawned.enemyStream!.nextRowIndex;
    const nextId = spawned.enemyStream!.nextEnemyId;
    step(sim, 0.1, { forwardSpeed: 12 });
    const advanced = sim.getState();
    expect(advanced.boss).toEqual(spawned.boss);
    expect(advanced.enemyStream!.nextRowIndex).toBeGreaterThan(nextRow);
    expect(advanced.enemies.some((enemy) => enemy.id === nextId)).toBe(true);
  });

  it('materializes rewards after row 136 while Boss is alive without duplicates', () => {
    const sim = create();
    approachBoss(sim);
    step(sim);
    const alive = sim.getState();
    expect(alive.boss).not.toBeNull();
    const placements = Array.from({ length: 4 }, (_, offset) =>
      rewardPlacementForBlock(Math.floor(bossRow / 8) + offset, stream.columns, stream.rewards!));
    expect(placements[0].rowIndex).not.toBe(bossRow);
    expect(placements.some((placement) => placement.rowIndex > bossRow)).toBe(true);
    expect(alive.streamRewards.some((reward) => reward.z > bossZ)).toBe(true);
    expect(new Set(alive.streamRewards.map((reward) => reward.id)).size).toBe(alive.streamRewards.length);
    const ids = alive.streamRewards.map((reward) => reward.id);
    step(sim);
    expect(sim.getState().streamRewards.map((reward) => reward.id)).toEqual(ids);
    const restored = create();
    restored.restoreState(sim.getState());
    step(restored, 0.1, { forwardSpeed: 12 });
    step(sim, 0.1, { forwardSpeed: 12 });
    expect(restored.getState()).toEqual(sim.getState());
  });

  it('keeps swept projectile ordering and fatal Boss contact unchanged', () => {
    for (const [kind, damage] of [['rifle', 3], ['heavyRifle', 300], ['rocket', 15]] as const) {
      const sim = create();
      approachBoss(sim);
      step(sim);
      prepareShot(sim, shot(kind, damage));
      step(sim);
      expect(sim.getState().boss?.hp).toBe(15000 - damage);
      expect(sim.getState().projectiles).toEqual([]);
    }
    const sim = create();
    approachBoss(sim);
    step(sim);
    const state = sim.getState();
    state.enemies = [{ id: 1, type: 'grunt', x: 0, z: bossZ - 2.1, hp: 3 },
      { id: 2, type: 'grunt', x: 0, z: bossZ + 3, hp: 3 }];
    state.projectiles = [shot('heavyRifle', 300)];
    state.weapons.nextProjectileId = 2;
    sim.restoreState(state);
    step(sim);
    expect(sim.getState().enemies.map((enemy) => enemy.id)).toEqual([2]);
    expect(sim.getState().boss?.hp).toBe(14700);
    const contactState = sim.getState();
    contactState.enemies = [];
    contactState.projectiles = [];
    contactState.player.z = bossZ - 3;
    sim.restoreState(contactState);
    step(sim, 1, { forwardSpeed: 2 });
    expect(sim.getState().squad.count).toBe(0);
  });

  it('restores before, during, and after the Boss without pausing either stream', () => {
    const before = create();
    approachBoss(before);
    const restoredBefore = create();
    restoredBefore.restoreState(before.getState());
    step(before);
    step(restoredBefore);
    expect(restoredBefore.getState()).toEqual(before.getState());
    const alive = before.getState();
    prepareShot(before, shot('rifle', 3));
    step(before);
    const damaged = before.getState();
    expect(damaged.boss?.hp).toBe(14997);
    const restoredAlive = create();
    restoredAlive.restoreState(JSON.parse(JSON.stringify(damaged)) as SimulationState);
    expect(restoredAlive.getState()).toEqual(damaged);
    const oldRowCursor = damaged.enemyStream!.nextRowIndex;
    step(restoredAlive, 0.1, { forwardSpeed: 12 });
    expect(restoredAlive.getState().enemyStream!.nextRowIndex).toBeGreaterThan(oldRowCursor);
    expect(restoredAlive.getState().boss?.hp).toBe(14997);
    const defeated = create();
    defeated.restoreState(damaged);
    prepareShot(defeated, shot('heavyRifle', 15000));
    step(defeated);
    const deadState = defeated.getState();
    expect(deadState.boss).toBeNull();
    expect(deadState.enemyStream!.nextBossIndex).toBe(1);
    const aliveContinuation = create();
    aliveContinuation.restoreState(damaged);
    const deadContinuation = create();
    deadContinuation.restoreState(deadState);
    step(aliveContinuation, 0.1, { forwardSpeed: 12 });
    step(deadContinuation, 0.1, { forwardSpeed: 12 });
    expect(deadContinuation.getState().enemies).toEqual(aliveContinuation.getState().enemies);
    expect(deadContinuation.getState().streamRewards).toEqual(aliveContinuation.getState().streamRewards);
    expect(deadContinuation.getState().enemyStream).toEqual(aliveContinuation.getState().enemyStream);
    const rowCursor = deadState.enemyStream!.nextRowIndex;
    const restoredDead = create();
    restoredDead.restoreState(deadState);
    step(restoredDead, 0.1, { forwardSpeed: 12 });
    expect(restoredDead.getState().boss).toBeNull();
    expect(restoredDead.getState().enemyStream!.nextRowIndex).toBeGreaterThan(rowCursor);
    const retry = create();
    expect(retry.getState().boss).toBeNull();
    expect(retry.getState().enemyStream!.nextBossIndex).toBe(0);
    approachBoss(retry);
    step(retry);
    expect(retry.getState().boss).toEqual(alive.boss);
    const invalid = retry.getState();
    invalid.enemyStream!.nextBossIndex = 0;
    expect(() => create().restoreState(invalid)).toThrow();
  });

  it('spawns the Tier-2 Boss once at row 328 and continues enemies and rewards', () => {
    const row = stream.bosses![1].row;
    const z = stream.startZ + row * stream.spacing;
    const sim = create();
    approachBoss(sim, z - 25, 1);
    const before = sim.getState();
    const replay = create();
    replay.restoreState(before);
    step(sim);
    step(replay);
    expect(replay.getState()).toEqual(sim.getState());
    const spawned = sim.getState();
    expect(spawned.boss).toMatchObject({ tier: 2, x: 0, z, hp: 300000, maxHp: 300000 });
    expect(spawned.enemyStream!.nextBossIndex).toBe(2);
    expect(spawned.enemyStream!.nextRowIndex).toBeGreaterThan(row + 1);
    expect(spawned.enemies).toHaveLength((spawned.enemyStream!.nextRowIndex - row - 1) * stream.columns);
    expect(spawned.enemies.every((enemy) => enemy.z > z)).toBe(true);
    expect(spawned.streamRewards.some((reward) => reward.z > z)).toBe(true);
    const bossId = spawned.boss!.id;
    const rewardIds = spawned.streamRewards.map((reward) => reward.id);
    step(sim);
    expect(sim.getState().boss!.id).toBe(bossId);
    expect(sim.getState().streamRewards.map((reward) => reward.id)).toEqual(rewardIds);
    const restored = create();
    restored.restoreState(spawned);
    expect(restored.getState()).toEqual(spawned);
    const invalid = restored.getState();
    invalid.enemyStream!.nextBossIndex = 3;
    expect(() => create().restoreState(invalid)).toThrow();
    prepareShot(restored, { ...shot('tier3Rifle', 300000), z: z - 2.5,
      penetrationRemaining: 100 });
    step(restored);
    const defeated = restored.getState();
    expect(defeated.boss).toBeNull();
    expect(defeated.enemyStream!.nextBossIndex).toBe(2);
    const afterDeath = create();
    afterDeath.restoreState(defeated);
    step(afterDeath, 0.1, { forwardSpeed: 12 });
    expect(afterDeath.getState().boss).toBeNull();
    expect(afterDeath.getState().enemyStream!.nextBossIndex).toBe(2);
    expect(create().getState().enemyStream!.nextBossIndex).toBe(0);
  });

  it('all rifle tiers stop on the Tier-2 Boss and contact remains fatal', () => {
    const z = stream.startZ + stream.bosses![1].row * stream.spacing;
    for (const [kind, damage] of [['rifle', 3], ['heavyRifle', 300],
      ['tier3Rifle', 3000]] as const) {
      const sim = create();
      approachBoss(sim, z - 25, 1);
      step(sim);
      prepareShot(sim, { ...shot(kind, damage), z: z - 2.5,
        penetrationRemaining: kind === 'tier3Rifle' ? 100 : kind === 'heavyRifle' ? 10 : 0 });
      step(sim);
      expect(sim.getState().boss?.hp).toBe(300000 - damage);
      expect(sim.getState().projectiles).toEqual([]);
    }
    const sim = create();
    approachBoss(sim, z - 25, 1);
    step(sim);
    const state = sim.getState();
    state.enemies = [];
    state.player.z = z - 3;
    sim.restoreState(state);
    step(sim, 1, { forwardSpeed: 2 });
    expect(sim.getState().squad.count).toBe(0);
  });

  it('rejects a second encounter while a previous Boss is still active', () => {
    const close = LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream,
      bosses: [{ row: 1, tier: 1, hpMultiplier: 1 }, { row: 2, tier: 2, hpMultiplier: 1 }] } });
    expect(() => new Simulation({ seed: 7, level: close, startSquad: 1,
      startRocketCount: 0, gruntHp: 3, bruteHp: 300, tier3Hp: 3000 }))
      .toThrow('another Boss is active');
  });
});
