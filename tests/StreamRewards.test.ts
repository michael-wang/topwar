import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { createEnemyStreamRow } from '../src/simulation/enemies/streamRow';
import { tier2ProbabilityForRow } from '../src/simulation/enemies/bruteRamp';
import { rewardChanceForTier2Probability, rewardPlacementForRow } from '../src/simulation/enemies/streamRewards';
import type { ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const rewardConfig = { baseChancePerRow: 0.99, fullTierChancePerRow: 0.99,
  hitsRequired: 10, seed: 271828, sideX: 2.2 };
const level: LevelDefinition = { id: 'stream-reward-test', length: 20, enemyGroups: [], upgradeGates: [],
  enemyStream: { enemy: 'grunt', startZ: 5, spawnAheadDistance: 5.5, columns: 3,
    spacing: 100, jitter: 0, seed: 42, bruteRamp: { startRow: 1, fullRow: 2, curvePower: 2 },
    rewards: rewardConfig } };
const tuning: SimulationTuning = { moveSpeed: 5, forwardSpeed: 0, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, bruteRadius: 0.55,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 40 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } };
const create = (source = level, startSquad = 1) => new Simulation({ seed: 7, level: source,
  startSquad, startRocketCount: 0, gruntHp: 3, bruteHp: 300 });
const projectile = (id: number, kind: ProjectileSimulationState['kind'], x: number,
  damage = kind === 'heavyRifle' ? 300 : 3): ProjectileSimulationState => ({ id, kind, x,
    z: 0, speed: 100, damage, remainingRange: 40, blastRadius: kind === 'rocket' ? 1.25 : 0,
    penetrationRemaining: kind === 'heavyRifle' ? 10 : 0 });

function prepare(simulation: Simulation, shots: ProjectileSimulationState[] = []): void {
  const state = simulation.getState();
  state.projectiles = shots;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = Math.max(state.weapons.nextProjectileId,
    ...shots.map((shot) => shot.id + 1));
  simulation.restoreState(state);
}

const step = (simulation: Simulation, dt = 0.1, changes: Partial<SimulationTuning> = {}) =>
  simulation.step(dt, { targetX: 0 }, { ...tuning, ...changes });

describe('endless stream reward placement', () => {
  it('uses authored chance and independent row rolls without consuming gameplay RNG', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    expect(authored.upgradeGates).toEqual([]);
    expect(authored.enemyStream?.rewards).toEqual({ baseChancePerRow: 0.025,
      fullTierChancePerRow: 0.08,
      hitsRequired: 10, seed: 271828, sideX: 2.2 });
    const stream = authored.enemyStream!;
    const rewards = stream.rewards!;
    const placement = (row: number, seed = rewards.seed) => rewardPlacementForRow(row, 7,
      { ...rewards, seed }, tier2ProbabilityForRow(row, stream.bruteRamp));
    const pattern = Array.from({ length: 1000 }, (_, row) => placement(row));
    expect(pattern).toEqual(Array.from({ length: 1000 }, (_, row) => placement(row)));
    expect(pattern.filter((placement) => placement !== null).length).toBeGreaterThan(25);
    expect(pattern.filter((placement) => placement !== null).length).toBeLessThan(75);
    expect(new Set(pattern.filter((placement) => placement !== null)
      .map((placement) => placement!.side))).toEqual(new Set([-1, 1]));
    expect(pattern).not.toEqual(Array.from({ length: 1000 }, (_, row) => placement(row, rewards.seed + 1)));
    expect(create(LevelDefinitionSchema.parse(authoredLevel)).getState().rngState).toBe(7);
  });

  it('interpolates the same Tier-2 curve from sparse opening rewards to full-tier supply', () => {
    const stream = LevelDefinitionSchema.parse(authoredLevel).enemyStream!;
    const rewards = stream.rewards!;
    const chance = (row: number) => rewardChanceForTier2Probability(rewards,
      tier2ProbabilityForRow(row, stream.bruteRamp));
    expect(chance(0)).toBe(0.025);
    expect(chance(48)).toBe(0.025);
    expect(chance(504)).toBeCloseTo(0.03875);
    expect(chance(732)).toBeCloseTo(0.0559375);
    expect(chance(960)).toBe(0.08);
    expect(chance(1200)).toBe(0.08);
    for (let row = 1; row <= 1200; row++) expect(chance(row)).toBeGreaterThanOrEqual(chance(row - 1));
  });

  it('keeps a row roll fixed while a higher pressure threshold can admit it', () => {
    const rewards = LevelDefinitionSchema.parse(authoredLevel).enemyStream!.rewards!;
    const row = Array.from({ length: 2000 }, (_, index) => index)
      .find((index) => rewardPlacementForRow(index, 7, rewards, 0) === null
        && rewardPlacementForRow(index, 7, rewards, 1) !== null)!;
    expect(row).toBeGreaterThanOrEqual(0);
    const placementAtFullTier = rewardPlacementForRow(row, 7, rewards, 1);
    expect(rewardPlacementForRow(row, 7, rewards, 0)).toBeNull();
    expect(placementAtFullTier).not.toBeNull();
    expect(rewardPlacementForRow(row, 7, rewards, 1)).toEqual(placementAtFullTier);
  });

  it('offers more rewards across broad early, mixed, and full Tier-2 row bands', () => {
    const stream = LevelDefinitionSchema.parse(authoredLevel).enemyStream!;
    const countRewards = (startRow: number) => Array.from({ length: 400 }, (_, offset) => {
      const row = startRow + offset;
      return rewardPlacementForRow(row, stream.columns, stream.rewards!,
        tier2ProbabilityForRow(row, stream.bruteRamp));
    }).filter((placement) => placement !== null).length;
    expect(countRewards(0)).toBeLessThan(countRewards(400));
    expect(countRewards(400)).toBeLessThan(countRewards(960));
  });

  it('adds one side reward without removing an enemy or changing row geometry, IDs, and tier rolls', () => {
    const withReward = create().getState();
    const withoutReward = create({ ...level, enemyStream: { ...level.enemyStream!, rewards: undefined } }).getState();
    expect(withReward.enemies).toHaveLength(3);
    expect(withReward.streamRewards).toHaveLength(1);
    expect(withoutReward.enemies).toHaveLength(3);
    expect(withReward.enemyStream).toEqual({ nextRowIndex: 1, nextEnemyId: 4, nextRewardId: 2 });
    const reward = withReward.streamRewards[0];
    expect(reward).toMatchObject({ id: 1, tier: 1, hitProgress: 0, hitsRequired: 10 });
    expect(Math.abs(reward.x)).toBe(rewardConfig.sideX);
    expect(withReward.enemies).toEqual(withoutReward.enemies);
    expect(create().getState().streamRewards).toEqual(withReward.streamRewards);
    const row = createEnemyStreamRow(0, 3, 100, 0, 42);
    expect(withReward.enemies.map(({ x, z }) => ({ x, z })))
      .toEqual(row.map((offset) => ({ x: offset.x, z: 5 + offset.z })));
    expect(reward.z).toBe(5);
  });

  it('keeps all seven authored enemy positions in a reward row and uses seeded Z jitter', () => {
    const stream = LevelDefinitionSchema.parse(authoredLevel).enemyStream!;
    const oneRow: LevelDefinition = { ...level, enemyStream: { ...stream,
      startZ: 5, spacing: 100, spawnAheadDistance: 5.5,
      rewards: { ...stream.rewards!, baseChancePerRow: 0.99, fullTierChancePerRow: 0.99 } } };
    const placement = rewardPlacementForRow(0, stream.columns, oneRow.enemyStream!.rewards!, 0)!;
    const state = create(oneRow).getState();
    const offsets = createEnemyStreamRow(0, stream.columns, 100, stream.jitter, stream.seed);
    expect(state.enemies).toHaveLength(7);
    expect(state.streamRewards).toHaveLength(1);
    expect(state.streamRewards[0].x).toBe(placement.side * stream.rewards!.sideX);
    expect(state.streamRewards[0].z).toBe(5 + offsets[placement.zSlot].z);
  });

  it('leaves all seven enemy slots in rows whose reward roll misses', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const rewards = authored.enemyStream!.rewards!;
    const missingRow = Array.from({ length: 100 }, (_, index) => index)
      .find((index) => rewardPlacementForRow(index, 7, rewards, 0) === null)!;
    const bare: LevelDefinition = { ...authored, enemyStream: { ...authored.enemyStream!,
      startZ: 0, spawnAheadDistance: 1, spacing: 1,
      rewards: { ...rewards, baseChancePerRow: 0.01, fullTierChancePerRow: 0.01 } } };
    const state = create(bare).getState();
    expect(rewardPlacementForRow(0, 7, bare.enemyStream!.rewards!, 0)).toBeNull();
    expect(missingRow).toBeGreaterThanOrEqual(0);
    expect(state.streamRewards).toEqual([]);
    expect(state.enemies).toHaveLength(14);
  });

  it('assigns Tier-1 throughout mixed rows and Tier-2 only at full saturation', () => {
    const compact: LevelDefinition = { ...level, enemyStream: { ...level.enemyStream!,
      spacing: 1, spawnAheadDistance: 8 } };
    const state = create(compact).getState();
    const noRewards = create({ ...compact, enemyStream: { ...compact.enemyStream!, rewards: undefined } }).getState();
    expect(state.streamRewards.map((reward) => [reward.z, reward.tier])).toEqual([
      [5, 1], [6, 1], [7, 2], [8, 2],
    ]);
    expect(state.enemyStream?.nextEnemyId).toBe(13);
    expect(state.enemies).toHaveLength(12);
    expect(state.enemies).toEqual(noRewards.enemies);
    expect(state.streamRewards).toHaveLength(4);
  });

  it('restores the cursor so future rewards ignore kills and Retry repeats the sequence', () => {
    const compact: LevelDefinition = { ...level, enemyStream: { ...level.enemyStream!,
      spacing: 1, spawnAheadDistance: 5.5 } };
    const first = create(compact);
    const second = create(compact);
    const altered = second.getState();
    altered.enemies = [];
    second.restoreState(altered);
    const saved = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const restored = create(compact);
    restored.restoreState(saved);
    for (const simulation of [first, second, restored]) {
      prepare(simulation);
      step(simulation, 0.5, { forwardSpeed: 1 });
    }
    expect(first.getState().streamRewards).toEqual(second.getState().streamRewards);
    expect(first.getState().streamRewards).toEqual(restored.getState().streamRewards);
    expect(first.getState().enemyStream).toEqual(restored.getState().enemyStream);
    expect(create(compact).getState().streamRewards).toEqual(saved.streamRewards);
  });
});

describe('tiered reward combat and lifecycle', () => {
  it('counts Tier-1 rifle hits regardless of damage, and awards on the tenth hit', () => {
    const simulation = create(level, 9);
    const rewardX = simulation.getState().streamRewards[0].x;
    prepare(simulation, [projectile(2, 'rocket', rewardX)]);
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);
    prepare(simulation, Array.from({ length: 9 }, (_, index) => projectile(index + 3, 'rifle', rewardX, 900)));
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(9);
    expect(simulation.getState().squad).toMatchObject({ count: 9, tier2RifleCount: 0 });
    prepare(simulation, [projectile(12, 'rifle', rewardX)]);
    step(simulation);
    expect(simulation.getState().streamRewards).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 1, tier2RifleCount: 1, rocketCount: 0 });
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    step(simulation, 0.01);
    expect(simulation.getState().projectiles.map((shot) => shot.kind)).toEqual(['heavyRifle']);
  });

  it('does not let an unlocked soldier fire until the following step', () => {
    const simulation = create(level, 9);
    const x = simulation.getState().streamRewards[0].x;
    prepare(simulation, Array.from({ length: 10 }, (_, index) => projectile(index + 1, 'rifle', x)));
    const ready = simulation.getState();
    ready.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(ready);
    step(simulation, 0.1, { rifle: { ...tuning.rifle, projectileSpeed: 1 } });
    expect(simulation.getState().squad).toMatchObject({ count: 1, tier2RifleCount: 1 });
    expect(simulation.getState().projectiles.filter((shot) => shot.kind === 'rifle')).toHaveLength(9);
    expect(simulation.getState().projectiles.filter((shot) => shot.kind === 'heavyRifle')).toHaveLength(0);
    step(simulation, 0.1, { rifle: { ...tuning.rifle, projectileSpeed: 1 } });
    expect(simulation.getState().projectiles.filter((shot) => shot.kind === 'heavyRifle')).toHaveLength(1);
  });

  it.each([
    { tier: 1, kind: 'rocket' },
    { tier: 2, kind: 'rifle' },
    { tier: 2, kind: 'rocket' },
  ] as const)('lets $kind pass a Tier-$tier reward and hit the enemy behind it', ({ tier, kind }) => {
    const compact: LevelDefinition = { ...level, enemyStream: { ...level.enemyStream!,
      spacing: 1, spawnAheadDistance: 8 } };
    const simulation = create(compact);
    const state = simulation.getState();
    const reward = state.streamRewards.find((target) => target.tier === tier)!;
    state.streamRewards = [reward];
    state.enemies = [{ id: 1, type: 'grunt', x: reward.x, z: reward.z + 1, hp: 3 }];
    simulation.restoreState(state);
    prepare(simulation, [projectile(1, kind, reward.x)]);
    step(simulation);
    const after = simulation.getState();
    expect(after.streamRewards[0].hitProgress).toBe(0);
    expect(after.enemies).toEqual([]);
    expect(after.projectiles).toEqual([]);
  });

  it('counts a higher-tier hit and keeps its shot in flight when no later target is hit', () => {
    const simulation = create();
    const state = simulation.getState();
    state.enemies = [];
    simulation.restoreState(state);
    const x = state.streamRewards[0].x;
    prepare(simulation, [projectile(1, 'heavyRifle', x)]);
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toMatchObject([
      { id: 1, kind: 'heavyRifle', x, z: 10, remainingRange: 30, penetrationRemaining: 10 },
    ]);
  });

  it.each([
    { tier: 1, kind: 'rifle' },
    { tier: 2, kind: 'heavyRifle' },
  ] as const)('counts and consumes a matching $kind shot at Tier-$tier reward', ({ tier, kind }) => {
    const compact: LevelDefinition = { ...level, enemyStream: { ...level.enemyStream!,
      spacing: 1, spawnAheadDistance: 8 } };
    const simulation = create(compact);
    const state = simulation.getState();
    const reward = state.streamRewards.find((target) => target.tier === tier)!;
    state.streamRewards = [reward];
    state.enemies = [{ id: 1, type: 'grunt', x: reward.x, z: reward.z + 1, hp: 3 }];
    simulation.restoreState(state);
    prepare(simulation, [projectile(1, kind, reward.x)]);
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toEqual([]);
    expect(simulation.getState().enemies[0].hp).toBe(3);
  });

  it('uses the nearest eligible enemy, reward, or generic gate', () => {
    const gated: LevelDefinition = { ...level, upgradeGates: [{ id: 'test-gate', x: 0,
      zOffset: 3, width: 1, reward: { mode: 'hitPickup', kind: 'rifle', amount: 1,
        hitsRequired: 10, dropSpeed: 4 } }] };
    const simulation = create(gated);
    const state = simulation.getState();
    state.streamRewards[0].x = 0;
    state.enemies = [{ id: 1, type: 'grunt', x: 0, z: 7, hp: 3 }];
    simulation.restoreState(state);
    prepare(simulation, [projectile(1, 'rifle', 0)]);
    step(simulation);
    expect(simulation.getState().gates[0].hitProgress).toBe(1);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);
    const afterGate = simulation.getState();
    afterGate.gates = [];
    simulation.restoreState(afterGate);
    prepare(simulation, [projectile(2, 'rifle', 0)]);
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().enemies[0].hp).toBe(3);
    const beforeReward = simulation.getState();
    beforeReward.enemies[0].z = 4;
    simulation.restoreState(beforeReward);
    prepare(simulation, [projectile(3, 'rifle', 0)]);
    step(simulation);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
  });

  it('grants Tier-2 only after ten heavy hits and never consumes rifle or rocket hits', () => {
    const compact: LevelDefinition = { ...level, enemyStream: { ...level.enemyStream!,
      spacing: 1, spawnAheadDistance: 8 } };
    const simulation = create(compact);
    const state = simulation.getState();
    const tier2 = state.streamRewards.find((reward) => reward.tier === 2)!;
    state.streamRewards = [tier2];
    state.enemies = [];
    simulation.restoreState(state);
    prepare(simulation, [projectile(1, 'rifle', tier2.x), projectile(2, 'rocket', tier2.x)]);
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);
    prepare(simulation, Array.from({ length: 9 }, (_, index) => projectile(index + 3,
      'heavyRifle', tier2.x, 3000)));
    step(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(9);
    prepare(simulation, [projectile(12, 'heavyRifle', tier2.x)]);
    step(simulation);
    expect(simulation.getState().streamRewards).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 2, tier2RifleCount: 1, rocketCount: 0 });
  });

  it('unlocks a target only once when extra same-tick shots cross its former position', () => {
    const simulation = create();
    const x = simulation.getState().streamRewards[0].x;
    prepare(simulation, Array.from({ length: 20 }, (_, index) => projectile(index + 1, 'rifle', x)));
    step(simulation);
    expect(simulation.getState().streamRewards).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 0 });
  });

  it('expires ignored rewards without casualties and freezes them at Game Over', () => {
    const simulation = create();
    const state = simulation.getState();
    state.enemies = [];
    simulation.restoreState(state);
    prepare(simulation);
    step(simulation, 1, { forwardSpeed: 10 });
    expect(simulation.getState().streamRewards).toEqual([]);
    expect(simulation.getState().squad.count).toBe(1);
    const frozen = create();
    const lost = frozen.getState();
    lost.squad = { count: 0, rocketCount: 0, tier2RifleCount: 0 };
    frozen.restoreState(lost);
    step(frozen, 10, { forwardSpeed: 10 });
    expect(frozen.getState().streamRewards).toEqual(lost.streamRewards);
    expect(frozen.getState().enemyStream).toEqual(lost.enemyStream);
  });

  it('owns and validates partial reward progress transactionally', () => {
    const simulation = create();
    const rewardX = simulation.getState().streamRewards[0].x;
    prepare(simulation, [projectile(1, 'rifle', rewardX)]);
    step(simulation);
    const before = simulation.getState();
    expect(before.streamRewards[0].hitProgress).toBe(1);
    const exposed = simulation.getState();
    exposed.streamRewards[0].hitProgress = 9;
    exposed.enemyStream!.nextRewardId = 999;
    expect(simulation.getState()).toEqual(before);
    for (const corrupt of [
      (candidate: SimulationState) => { candidate.streamRewards[0].hitProgress = 10; },
      (candidate: SimulationState) => { candidate.streamRewards[0].tier = 3 as 1; },
      (candidate: SimulationState) => { candidate.streamRewards[0].id = 0; },
      (candidate: SimulationState) => { candidate.enemyStream!.nextRewardId = 1; },
      (candidate: SimulationState) => { Object.assign(candidate.streamRewards[0], { hp: 10 }); },
    ]) {
      const invalid = structuredClone(before);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(before)) as SimulationState);
    prepare(simulation, [projectile(2, 'rifle', rewardX)]);
    prepare(restored, [projectile(2, 'rifle', rewardX)]);
    step(simulation);
    step(restored);
    expect(restored.getState()).toEqual(simulation.getState());
  });
});
