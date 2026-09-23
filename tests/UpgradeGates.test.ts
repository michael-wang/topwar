import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const rifleGate = { id: 'left', choiceGroup: 'choice', x: -1, z: 5, width: 1.5, hp: 6,
  reward: { kind: 'rifle' as const, amount: 1 } };
const rocketGate = { id: 'right', choiceGroup: 'choice', x: 1, z: 5, width: 1.5, hp: 9,
  reward: { kind: 'rocket' as const, amount: 1 } };
const level: LevelDefinition = { id: 'gate-test', length: 30, enemyGroups: [], upgradeGates: [rifleGate, rocketGate] };
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

function prepare(projectiles: ProjectileSimulationState[], enemies: EnemySimulationState[] = [], source = level): Simulation {
  const simulation = create(source);
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 10;
  state.weapons.rocketCooldownRemainingSeconds = 10;
  state.weapons.nextProjectileId = Math.max(1, ...projectiles.map((item) => item.id + 1));
  simulation.restoreState(state);
  return simulation;
}

const step = (simulation: Simulation, overrides: Partial<SimulationTuning> = {}) =>
  simulation.step(1, { targetX: 0 }, { ...tuning, ...overrides });

describe('destructible upgrade gates', () => {
  it('materializes full HP, owns gate state, serializes it, and recreates it on retry', () => {
    const simulation = create(LevelDefinitionSchema.parse(authoredLevel));
    const initial = simulation.getState();
    expect(initial.gates.map((gate) => [gate.id, gate.hp, gate.maxHp])).toEqual([
      ['opening-rifle', 36, 36], ['opening-rocket', 72, 72],
    ]);
    initial.gates[0].hp = 1;
    initial.gates[0].reward.amount = 99;
    expect(simulation.getState().gates[0].hp).toBe(36);
    expect(simulation.getState().gates[0].reward.amount).toBe(1);
    const saved = JSON.parse(JSON.stringify(simulation.getState())) as SimulationState;
    const restored = create();
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(simulation.getState());
    expect(create(LevelDefinitionSchema.parse(authoredLevel)).getState().gates).toEqual(simulation.getState().gates);
  });

  it('rejects malformed gate restoration without changing state or RNG', () => {
    const simulation = create();
    const before = simulation.getState();
    for (const corrupt of [
      (s: SimulationState) => { s.gates[0].hp = 0; },
      (s: SimulationState) => { s.gates[0].reward.amount = -1; },
      (s: SimulationState) => { s.gates[1].id = s.gates[0].id; },
      (s: SimulationState) => { (s.gates[0] as unknown as Record<string, unknown>).extra = true; },
      (s: SimulationState) => { s.gates = null as unknown as SimulationState['gates']; },
    ]) {
      const candidate = structuredClone(before);
      candidate.rngState = 123;
      corrupt(candidate);
      expect(() => simulation.restoreState(candidate)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('sweeps through an aligned gate, consumes the projectile, and keeps its sibling', () => {
    const simulation = prepare([rifle(1, -1)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => [gate.id, gate.hp])).toEqual([['left', 3], ['right', 9]]);
    expect(simulation.getState().projectiles).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    const miss = prepare([rifle(1, 0)]);
    step(miss);
    expect(miss.getState().gates.map((gate) => gate.hp)).toEqual([6, 9]);
    expect(miss.getState().projectiles).toHaveLength(1);
    const edge = prepare([rifle(1, -1.75)]);
    step(edge);
    expect(edge.getState().gates[0].hp).toBe(3);
  });

  it('resolves the nearest gate or enemy, never shooting through the nearer target', () => {
    const behind = prepare([rifle(1, -1)], [grunt(1, -1, 6)]);
    step(behind);
    expect(behind.getState().gates[0].hp).toBe(3);
    expect(behind.getState().enemies).toEqual([grunt(1, -1, 6)]);
    const ahead = prepare([rifle(1, -1)], [grunt(1, -1, 3)]);
    step(ahead);
    expect(ahead.getState().enemies).toEqual([]);
    expect(ahead.getState().gates[0].hp).toBe(6);
  });

  it('grants exactly one chosen reward; competing same-tick shots follow projectile order', () => {
    const first = prepare([rifle(1, -1, 6), rifle(2, 1, 9)]);
    step(first);
    expect(first.getState().squad).toEqual({ count: 2, rocketCount: 0 });
    expect(first.getState().gates).toEqual([]);
    const second = prepare([rifle(1, 1, 9), rifle(2, -1, 6)]);
    step(second);
    expect(second.getState().squad).toEqual({ count: 2, rocketCount: 1 });
    expect(second.getState().gates).toEqual([]);
  });

  it('newly rewarded rifle or rocket soldiers wait until the next step to fire', () => {
    const rifleRun = prepare([rifle(1, -1, 6)]);
    step(rifleRun);
    expect(rifleRun.getState().weapons.nextProjectileId).toBe(2);
    const rifleState = rifleRun.getState();
    rifleState.weapons.rifleCooldownRemainingSeconds = 0;
    rifleRun.restoreState(rifleState);
    rifleRun.step(0.1, { targetX: 0 }, tuning);
    expect(rifleRun.getState().projectiles.filter((item) => item.kind === 'rifle')).toHaveLength(2);

    const rocketRun = prepare([rifle(1, 1, 9)]);
    step(rocketRun);
    expect(rocketRun.getState().weapons.nextProjectileId).toBe(2);
    rocketRun.step(0.1, { targetX: 0 }, tuning);
    expect(rocketRun.getState().projectiles.filter((item) => item.kind === 'rocket')).toHaveLength(1);
  });

  it('rocket gate hits blast nearby enemies without damaging the sibling gate', () => {
    const sturdyLevel = { ...level, upgradeGates: [{ ...rifleGate, hp: 20 }, rocketGate] };
    const simulation = prepare([rocket(1, -1)], [grunt(1, -1, 5.4), grunt(2, 2, 5)], sturdyLevel);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => [gate.id, gate.hp])).toEqual([['left', 5], ['right', 9]]);
    expect(simulation.getState().enemies).toEqual([grunt(2, 2, 5)]);
    const hit = prepare([rocket(1, -1)], [grunt(1, -1, 5.4)]);
    step(hit);
    expect(hit.getState().gates).toEqual([]);
    expect(hit.getState().enemies).toEqual([]);
    expect(hit.getState().squad).toEqual({ count: 2, rocketCount: 0 });
  });

  it('expires unresolved choices without reward when the player passes them', () => {
    const simulation = create();
    step(simulation, { forwardSpeed: 6 });
    expect(simulation.getState().gates).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    const finalShot = prepare([rifle(1, -1, 6)]);
    step(finalShot, { forwardSpeed: 5 });
    expect(finalShot.getState().gates).toEqual([]);
    expect(finalShot.getState().squad).toEqual({ count: 2, rocketCount: 0 });
  });

  it('restored gate state produces the same later reward and composes with casualties', () => {
    const first = prepare([rifle(1, 1, 9)]);
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
