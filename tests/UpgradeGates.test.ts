import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const left = { id: 'left', x: -1, zOffset: 5, width: 1.5, hp: 6,
  reward: { kind: 'rifle' as const, amount: 1, count: 5 } };
const right = { id: 'right', x: 1, zOffset: 5, width: 1.5, hp: 9,
  reward: { kind: 'rocket' as const, amount: 1, count: 3 } };
const level: LevelDefinition = { id: 'armory-test', length: 30, enemyGroups: [], upgradeGates: [left, right] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3, gruntContactDamage: 1,
  rifle: { damage: 3, fireRate: 1, projectileSpeed: 10, range: 20 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 10, range: 20, blastRadius: 1.25 },
};
const create = (source = level) => new Simulation({ seed: 1, level: source, startSquad: 1, startRocketCount: 0, gruntHp: 3 });
const rifle = (id: number, x: number, damage = 3): ProjectileSimulationState =>
  ({ id, kind: 'rifle', x, z: 0, speed: 10, damage, remainingRange: 20, blastRadius: 0 });
const rocket = (id: number, x: number): ProjectileSimulationState =>
  ({ id, kind: 'rocket', x, z: 0, speed: 10, damage: 15, remainingRange: 20, blastRadius: 1.25 });
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });

function setProjectiles(simulation: Simulation, projectiles: ProjectileSimulationState[],
  enemies?: EnemySimulationState[]): void {
  const state = simulation.getState();
  if (enemies) state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 10;
  state.weapons.rocketCooldownRemainingSeconds = 10;
  state.weapons.nextProjectileId = Math.max(state.weapons.nextProjectileId,
    1, ...projectiles.map((projectile) => projectile.id + 1));
  simulation.restoreState(state);
}

const step = (simulation: Simulation, dt = 1, overrides: Partial<SimulationTuning> = {}) =>
  simulation.step(dt, { targetX: 0 }, { ...tuning, ...overrides });

describe('persistent side armories', () => {
  it('materializes full authored walls and reward queues; retry recreates both', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const run = create(authored);
    const first = run.getState();
    expect(first.enemies).toHaveLength(600);
    expect(first.gates.map((gate) => [gate.id, gate.zOffset, gate.hp, gate.maxHp, gate.rewardsRemaining])).toEqual([
      ['rifle-armory', 8, 100, 100, 5], ['rocket-armory', 8, 500, 500, 3],
    ]);
    setProjectiles(run, [rifle(1, -2.5)]);
    step(run);
    expect(run.getState().gates[0].hp).toBe(97);
    const retry = create(authored).getState();
    expect(retry.gates).toEqual(first.gates);
  });

  it('owns serializable armory state and rejects invalid restore transactionally', () => {
    const simulation = create();
    const exposed = simulation.getState();
    exposed.gates[0].hp = 1;
    exposed.gates[0].reward.count = 99;
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 6, reward: { count: 5 } });
    const partial = simulation.getState();
    partial.gates[0].hp = 0;
    partial.gates[0].rewardsRemaining = 3;
    simulation.restoreState(JSON.parse(JSON.stringify(partial)) as SimulationState);
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 0, rewardsRemaining: 3 });
    const before = simulation.getState();
    for (const corrupt of [
      (s: SimulationState) => { s.gates[0].rewardsRemaining = 0; },
      (s: SimulationState) => { s.gates[0].rewardsRemaining = 6; },
      (s: SimulationState) => { s.gates[0].rewardsRemaining = 1.5; },
      (s: SimulationState) => { s.gates[0].hp = -1; },
      (s: SimulationState) => { s.gates[1].id = s.gates[0].id; },
      (s: SimulationState) => { (s.gates[0] as unknown as Record<string, unknown>).choiceGroup = 'old'; },
    ]) {
      const invalid = structuredClone(before);
      invalid.rngState = 123;
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('keeps both offsets constant while the player advances far past the original world position', () => {
    const simulation = create();
    for (let index = 0; index < 10; index++) step(simulation, 1, { forwardSpeed: 10,
      rifle: { ...tuning.rifle, projectileSpeed: 1, range: 1 } });
    const state = simulation.getState();
    expect(state.player.z).toBe(100);
    expect(state.gates).toHaveLength(2);
    expect(state.gates.map((gate) => state.player.z + gate.zOffset)).toEqual([105, 105]);
    expect(state.gates.map((gate) => gate.zOffset)).toEqual([5, 5]);
  });

  it('damages only an aligned wall, consumes the bullet, and sweeps a moving wall', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1)]);
    step(simulation, 1, { forwardSpeed: 2 });
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([3, 9]);
    expect(simulation.getState().projectiles).toEqual([]);
    const miss = create();
    setProjectiles(miss, [rifle(1, 0)]);
    step(miss);
    expect(miss.getState().gates.map((gate) => gate.hp)).toEqual([6, 9]);
    const fast = create();
    setProjectiles(fast, [{ ...rifle(1, -1), speed: 100 }]);
    step(fast, 0.1, { forwardSpeed: 2 });
    expect(fast.getState().gates[0].hp).toBe(3);
  });

  it('compares enemy and moving-armory hit times rather than stale world Z', () => {
    const nearerEnemy = create();
    setProjectiles(nearerEnemy, [rifle(1, -1)], [grunt(1, -1, 5.8)]);
    step(nearerEnemy, 1, { forwardSpeed: 2 });
    expect(nearerEnemy.getState().enemies).toEqual([]);
    expect(nearerEnemy.getState().gates[0].hp).toBe(6);
    const nearerWall = create();
    setProjectiles(nearerWall, [rifle(1, -1)], [grunt(1, -1, 6.8)]);
    step(nearerWall, 1, { forwardSpeed: 2 });
    expect(nearerWall.getState().enemies).toEqual([grunt(1, -1, 6.8)]);
    expect(nearerWall.getState().gates[0].hp).toBe(3);
  });

  it('breaks a wall at zero HP without granting a reward; both sides remain independent', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 9), rifle(2, 1, 12)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => [gate.hp, gate.rewardsRemaining])).toEqual([[0, 5], [0, 3]]);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('retains partial damage while switching lanes and can use both armories in one run', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1)]);
    step(simulation);
    expect(simulation.getState().gates[0].hp).toBe(3);
    setProjectiles(simulation, [rifle(2, 1)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([3, 6]);
    setProjectiles(simulation, [rifle(3, -1)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([0, 6]);
    setProjectiles(simulation, [rifle(4, -1), rifle(5, 1, 6)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0 });
    expect(simulation.getState().gates.map((gate) => [gate.hp, gate.rewardsRemaining]))
      .toEqual([[0, 4], [0, 3]]);
    setProjectiles(simulation, [rifle(6, 1)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 3, rocketCount: 1 });
    expect(simulation.getState().gates.map((gate) => gate.rewardsRemaining)).toEqual([4, 2]);
  });

  it('collects five rifle rewards separately, then completes only the rifle armory', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    expect(simulation.getState().squad.count).toBe(1);
    for (let index = 0; index < 5; index++) {
      setProjectiles(simulation, [rifle(index + 2, -1)]);
      step(simulation);
      expect(simulation.getState().squad).toEqual({ count: index + 2, rocketCount: 0 });
      expect(simulation.getState().gates.find((gate) => gate.id === 'left')?.rewardsRemaining)
        .toBe(index === 4 ? undefined : 4 - index);
    }
    expect(simulation.getState().gates.map((gate) => gate.id)).toEqual(['right']);
  });

  it('collects three rocket specialists one at a time, even with high-damage rockets', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, 1, 9)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    for (let index = 0; index < 3; index++) {
      setProjectiles(simulation, [rocket(index + 2, 1)]);
      step(simulation);
      expect(simulation.getState().squad).toEqual({ count: index + 2, rocketCount: index + 1 });
    }
    expect(simulation.getState().gates.map((gate) => gate.id)).toEqual(['left']);
  });

  it('does not fire a newly granted unit until the following step, then uses its role', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, 1, 9), rifle(2, 1)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 1 });
    expect(simulation.getState().weapons.nextProjectileId).toBe(3);
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    state.weapons.rocketCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    simulation.step(0.1, { targetX: 0 }, tuning);
    expect(simulation.getState().projectiles.map((projectile) => projectile.kind)).toEqual(['rifle', 'rocket']);
  });

  it('rocket impact blasts nearby enemies without splash damage to either armory', () => {
    const simulation = create();
    setProjectiles(simulation, [rocket(1, -1)], [grunt(1, -1, 5.4), grunt(2, 2, 5)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([0, 9]);
    expect(simulation.getState().enemies).toEqual([grunt(2, 2, 5)]);
    expect(simulation.getState().squad.count).toBe(1);
    setProjectiles(simulation, [rocket(2, -1)]);
    step(simulation);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().gates[0].rewardsRemaining).toBe(4);
  });

  it('rejects unsafe reward growth without partially committing state', () => {
    const simulation = create();
    const state = simulation.getState();
    state.gates[0].hp = 0;
    state.gates[0].reward.amount = Number.MAX_SAFE_INTEGER;
    state.projectiles = [rifle(1, -1)];
    state.weapons.rifleCooldownRemainingSeconds = 10;
    state.weapons.nextProjectileId = 2;
    simulation.restoreState(state);
    const before = simulation.getState();
    expect(() => step(simulation)).toThrow(/reward exceeds/);
    expect(simulation.getState()).toEqual(before);
  });

  it('restores future wall damage, reward collection, and rifle-first casualties deterministically', () => {
    const first = create();
    setProjectiles(first, [rifle(1, 1, 9), rifle(2, 1)]);
    const second = create();
    second.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    step(first);
    step(second);
    expect(second.getState()).toEqual(first.getState());
    const state = first.getState();
    state.enemies = [grunt(1, 0, 0)];
    state.weapons.rocketCooldownRemainingSeconds = 10;
    first.restoreState(state);
    first.step(0.1, { targetX: 0 }, tuning);
    expect(first.getState().squad).toEqual({ count: 1, rocketCount: 1 });
  });
});
