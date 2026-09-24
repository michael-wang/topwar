import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const left = { id: 'left', x: -1, zOffset: 5, width: 1.5,
  reward: { mode: 'hitPickup' as const, kind: 'rifle' as const, amount: 1, hitsRequired: 10, dropSpeed: 4 } };
const right = { id: 'right', x: 1, zOffset: 5, width: 1.5,
  reward: { mode: 'hitPickup' as const, kind: 'tier2Rifle' as const, amount: 1, hitsRequired: 100, dropSpeed: 4 } };
const level: LevelDefinition = { id: 'armory-test', length: 30, enemyGroups: [], upgradeGates: [left, right] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, normalEnemyRadius: 0.3, bossRadius: 2,
  rifle: { fireRate: 1, projectileSpeed: 10, range: 20 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 10, range: 20, blastRadius: 1.25 },
};
const create = (source = level, startSquad = 1) => new Simulation({ seed: 1,
  level: source,
  startSquad, startRocketCount: 0, tiers: { mergeCount: 10, tier1Power: 3,
    tier2Power: 300, higherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
const shot = (id: number, x: number, kind: 'rifle' | 'heavyRifle' | 'rocket' = 'rifle',
  damage = 3): ProjectileSimulationState => ({ id, kind: kind === 'rocket' ? 'rocket' : 'rifle',
  tier: kind === 'rocket' ? 0 : kind === 'heavyRifle' ? 2 : 1, x, z: 0, speed: 100,
  damage, remainingRange: 20, blastRadius: kind === 'rocket' ? 1.25 : 0,
  penetrationRemaining: kind === 'heavyRifle' ? 10 : 0 });
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, tier: 1, x, z, hp: 3 });

function inject(simulation: Simulation, projectiles: ProjectileSimulationState[],
  enemies?: EnemySimulationState[]): void {
  const state = simulation.getState();
  if (enemies) state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = Math.max(state.weapons.nextProjectileId,
    ...projectiles.map((projectile) => projectile.id + 1));
  simulation.restoreState(state);
}

const step = (simulation: Simulation, dt = 0.1, targetX = 0,
  changes: Partial<SimulationTuning> = {}) =>
  simulation.step(dt, { targetX }, { ...tuning, ...changes });

describe('persistent hit-count armories', () => {
  it('keeps generic generators available for custom levels and Retry restores them', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    expect(authored.upgradeGates).toEqual([]);
    const run = create({ ...authored, upgradeGates: [left, right] });
    const first = run.getState();
    expect(first.enemies.length).toBeGreaterThan(700);
    expect(first.gates.map((gate) => [gate.id, gate.reward.kind, gate.reward.hitsRequired,
      gate.hitProgress])).toEqual([
      ['left', 'rifle', 10, 0], ['right', 'tier2Rifle', 100, 0],
    ]);
    inject(run, [shot(1, -1)]);
    step(run);
    expect(run.getState().gates[0].hitProgress).toBe(1);
    expect(create({ ...authored, upgradeGates: [left, right] }).getState().gates).toEqual(first.gates);
    expect(create({ ...authored, upgradeGates: [left, right] }).getState().enemies).toEqual(first.enemies);
  });

  it('owns JSON-serializable progress and rejects invalid restored values transactionally', () => {
    const simulation = create();
    inject(simulation, [shot(1, -1)]);
    step(simulation);
    const saved = JSON.parse(JSON.stringify(simulation.getState())) as SimulationState;
    const restored = create();
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(saved);
    const exposed = simulation.getState();
    exposed.gates[0].hitProgress = 9;
    exposed.gates[0].reward.hitsRequired = 20;
    expect(simulation.getState().gates[0].hitProgress).toBe(1);
    expect(simulation.getState().gates[0].reward.hitsRequired).toBe(10);
    for (const corrupt of [
      (state: SimulationState) => { state.gates[0].hitProgress = -1; },
      (state: SimulationState) => { state.gates[0].hitProgress = 10; },
      (state: SimulationState) => { state.gates[0].hitProgress = 0.5; },
      (state: SimulationState) => { state.gates[0].hitProgress = Number.MAX_SAFE_INTEGER + 1; },
      (state: SimulationState) => { state.gates[1].id = state.gates[0].id; },
      (state: SimulationState) => { Object.assign(state.gates[0], { hp: 100 }); },
      (state: SimulationState) => { Object.assign(state.gates[0], { rewardCooldownRemainingSeconds: 1 }); },
      (state: SimulationState) => { Object.assign(state.gates[0].reward, { intervalSeconds: 1 }); },
    ]) {
      const invalid = structuredClone(saved);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(saved);
    }
  });

  it('keeps both targets at player-relative Z even after advancing beyond their original position', () => {
    const simulation = create();
    for (let index = 0; index < 10; index++) step(simulation, 1, 0, { forwardSpeed: 10,
      rifle: { ...tuning.rifle, projectileSpeed: 1, range: 1 } });
    const state = simulation.getState();
    expect(state.player.z).toBe(100);
    expect(state.gates.map((gate) => state.player.z + gate.zOffset)).toEqual([105, 105]);
    expect(state.gates.map((gate) => gate.hitProgress)).toEqual([0, 0]);
  });

  it('uses swept moving-target collision, horizontal width, and earliest enemy or armory hit', () => {
    const hit = create();
    inject(hit, [shot(1, -1)]);
    step(hit, 0.1, 0, { forwardSpeed: 2 });
    expect(hit.getState().gates[0].hitProgress).toBe(1);
    expect(hit.getState().projectiles).toEqual([]);
    const miss = create();
    inject(miss, [shot(1, 0)]);
    step(miss);
    expect(miss.getState().gates.map((gate) => gate.hitProgress)).toEqual([0, 0]);
    const fast = create();
    inject(fast, [{ ...shot(1, -1), speed: 1000 }]);
    step(fast, 0.01, 0, { forwardSpeed: 20 });
    expect(fast.getState().gates[0].hitProgress).toBe(1);
    const nearerEnemy = create();
    inject(nearerEnemy, [shot(1, -1)], [grunt(1, -1, 4.3)]);
    step(nearerEnemy);
    expect(nearerEnemy.getState().enemies).toEqual([]);
    expect(nearerEnemy.getState().gates[0].hitProgress).toBe(0);
    const nearerGate = create();
    inject(nearerGate, [shot(1, -1)], [grunt(1, -1, 6.8)]);
    step(nearerGate);
    expect(nearerGate.getState().enemies).toEqual([grunt(1, -1, 6.8)]);
    expect(nearerGate.getState().gates[0].hitProgress).toBe(1);
  });

  it('can hit the authored left target from the legal track edge', () => {
    const simulation = create({ ...LevelDefinitionSchema.parse(authoredLevel),
      upgradeGates: [{ ...left, x: -2.7, width: 0.9 }] });
    inject(simulation, [shot(1, -2.5)]);
    step(simulation);
    expect(simulation.getState().gates[0].hitProgress).toBe(1);
  });

  it('counts hits rather than damage and emits one pickup on each left threshold', () => {
    const simulation = create();
    inject(simulation, Array.from({ length: 9 }, (_, index) => shot(index + 1, -1,
      index === 0 ? 'heavyRifle' : 'rifle', index === 0 ? 300 : 3)));
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hitProgress)).toEqual([9, 0]);
    expect(simulation.getState().pickups).toEqual([]);
    inject(simulation, [shot(10, -1, 'rocket', 15)]);
    step(simulation);
    expect(simulation.getState().gates[0].hitProgress).toBe(0);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, sourceGateId: 'left',
      x: -1, zOffset: 5, rewardKind: 'rifle', rewardAmount: 1 }]);
    expect(simulation.getState().squad.count).toBe(1);
    inject(simulation, Array.from({ length: 10 }, (_, index) => shot(index + 11, -1, 'heavyRifle', 300)));
    step(simulation);
    expect(simulation.getState().gates[0].hitProgress).toBe(0);
    expect(simulation.getState().pickups.map((item) => item.id)).toEqual([1, 2]);
  });

  it('emits a right Tier-2 pickup every hundred hits without changing left progress', () => {
    const simulation = create();
    inject(simulation, [shot(1, -1)]);
    step(simulation);
    inject(simulation, Array.from({ length: 99 }, (_, index) => shot(index + 2, 1,
      'heavyRifle', 300)));
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hitProgress)).toEqual([1, 99]);
    expect(simulation.getState().pickups).toEqual([]);
    inject(simulation, [shot(101, 1)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hitProgress)).toEqual([1, 0]);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, sourceGateId: 'right',
      rewardKind: 'tier2Rifle', rewardAmount: 1, zOffset: 5 }]);
    inject(simulation, Array.from({ length: 100 }, (_, index) => shot(index + 102, 1)));
    step(simulation);
    expect(simulation.getState().pickups.map((item) => item.id)).toEqual([1, 2]);
    expect(simulation.getState().gates.map((gate) => gate.hitProgress)).toEqual([1, 0]);
  });

  it('counts one direct rocket hit and no extra armory hits from its enemy-only blast', () => {
    const nearby: LevelDefinition = { ...level, upgradeGates: [left,
      { ...right, x: 0, width: 0.4 }] };
    const simulation = create(nearby);
    inject(simulation, [shot(1, -1, 'rocket', 15)], [grunt(1, -1.8, 5)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hitProgress)).toEqual([1, 0]);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('moves an uncollected pickup at its captured relative speed without time-based emissions', () => {
    const simulation = create();
    inject(simulation, Array.from({ length: 10 }, (_, index) => shot(index + 1, -1)));
    step(simulation);
    step(simulation, 0.25);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, zOffset: 4, dropSpeed: 4 }]);
    expect(simulation.getState().nextPickupId).toBe(2);
    step(simulation, 1);
    expect(simulation.getState().pickups).toEqual([]);
    expect(simulation.getState().nextPickupId).toBe(2);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('does not let projectiles or rocket splash hit pickup plaques', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [{ id: 1, sourceGateId: 'left', x: -1, zOffset: 5, width: 1.5,
      rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 4 }];
    state.nextPickupId = 2;
    simulation.restoreState(state);
    inject(simulation, [shot(1, -1, 'rocket', 15)], [grunt(1, -1, 4)]);
    step(simulation, 0.5);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, zOffset: 3 }]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('sweeps high-speed pickup crossings and resolves collected and missed plaques in ID order', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [
      { id: 2, sourceGateId: 'left', x: -1, zOffset: 1, width: 1.5,
        rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 20 },
      { id: 1, sourceGateId: 'right', x: 1, zOffset: 1, width: 1.5,
        rewardKind: 'tier2Rifle', rewardAmount: 1, dropSpeed: 20 },
    ];
    state.nextPickupId = 3;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation, 0.1, -1, { moveSpeed: 20 });
    expect(simulation.getState().pickups).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0, rifleCounts: [2] });
  });

  it('rejects corrupt pickup state without changing live state', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [{ id: 1, sourceGateId: 'left', x: -1, zOffset: 2, width: 1.5,
      rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 4 }];
    state.nextPickupId = 2;
    simulation.restoreState(state);
    const before = simulation.getState();
    for (const corrupt of [
      (candidate: SimulationState) => { candidate.pickups.push({ ...candidate.pickups[0] }); },
      (candidate: SimulationState) => { candidate.pickups[0].dropSpeed = 0; },
      (candidate: SimulationState) => { candidate.nextPickupId = 1; },
      (candidate: SimulationState) => { Object.assign(candidate.pickups[0], { hp: 1 }); },
    ]) {
      const invalid = structuredClone(before);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('collects a physical Tier-1 plaque, normalizes 10:1, and fires its new heavy next step', () => {
    const simulation = create(level, 9);
    inject(simulation, Array.from({ length: 10 }, (_, index) => shot(index + 1, -1)));
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 9, rocketCount: 0, rifleCounts: [9] });
    expect(simulation.getState().pickups).toHaveLength(1);
    step(simulation, 1.25, -1, { moveSpeed: 2 });
    expect(simulation.getState().pickups).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0, rifleCounts: [0, 1] });
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    step(simulation, 0.01, -1);
    expect(simulation.getState().projectiles.map((projectile) => [projectile.kind, projectile.tier]))
      .toEqual([['rifle', 2]]);
  });

  it('directly adds a Tier-2 only on collection and removes missed plaques without reward', () => {
    const collected = create();
    inject(collected, Array.from({ length: 100 }, (_, index) => shot(index + 1, 1)));
    step(collected);
    expect(collected.getState().squad.count).toBe(1);
    step(collected, 1.25, 1, { moveSpeed: 2 });
    expect(collected.getState().squad).toEqual({ count: 2, rocketCount: 0, rifleCounts: [1, 1] });
    const missed = create();
    inject(missed, Array.from({ length: 100 }, (_, index) => shot(index + 1, 1)));
    step(missed);
    step(missed, 1.25);
    expect(missed.getState().pickups).toEqual([]);
    expect(missed.getState().squad).toEqual({ count: 1, rocketCount: 0, rifleCounts: [1] });
  });

  it('restores partial hit progress for deterministic future hits and freezes at Game Over', () => {
    const original = create();
    inject(original, Array.from({ length: 7 }, (_, index) => shot(index + 1, -1)));
    step(original);
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(original.getState())) as SimulationState);
    for (const simulation of [original, restored]) {
      inject(simulation, Array.from({ length: 3 }, (_, index) => shot(index + 8, -1)));
      step(simulation);
    }
    expect(restored.getState()).toEqual(original.getState());
    expect(original.getState().pickups).toHaveLength(1);
    const lost = original.getState();
    lost.squad = { count: 0, rocketCount: 0, rifleCounts: [] };
    original.restoreState(lost);
    const before = original.getState();
    step(original, 1);
    expect(original.getState().gates).toEqual(before.gates);
    expect(original.getState().pickups).toEqual(before.pickups);
    expect(original.getState().projectiles).toEqual(before.projectiles);
  });
});
