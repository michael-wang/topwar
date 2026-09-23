import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';

const emptyLevel: LevelDefinition = { id: 'enemy-advance-test', length: 30, enemyGroups: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 100,
  formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3,
  gruntMoveSpeed: 1.5, gruntActivationDistance: 10, gruntContactDamage: 1,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 10, range: 18 },
};
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });

function withState(count: number, enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[] = []) {
  const simulation = new Simulation({ seed: 7, level: emptyLevel, startSquad: count, gruntHp: 3 });
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.rifle.cooldownRemainingSeconds = 100;
  state.rifle.nextProjectileId = projectiles.length + 1;
  simulation.restoreState(state);
  return simulation;
}

const step = (simulation: Simulation, changes: Partial<SimulationTuning> = {}) =>
  simulation.step(1, { targetX: 0 }, { ...tuning, ...changes });

describe('grunt activation and forward advance', () => {
  it('leaves distant enemies still and activates exactly at the post-move threshold', () => {
    const outside = withState(1, [grunt(1, 2, 11.01)]);
    const threshold = withState(1, [grunt(1, 2, 11)]);
    step(outside, { forwardSpeed: 1 });
    step(threshold, { forwardSpeed: 1 });
    expect(outside.getState().enemies[0]).toEqual(grunt(1, 2, 11.01));
    expect(threshold.getState().enemies[0]).toEqual(grunt(1, 2, 9.5));
  });

  it('moves only along -Z at the configured speed; zero speed keeps active enemies still', () => {
    const moving = withState(1, [grunt(1, -1, 8)]);
    const still = withState(1, [grunt(1, -1, 8)]);
    step(moving);
    step(still, { gruntMoveSpeed: 0 });
    expect(moving.getState().enemies[0]).toEqual(grunt(1, -1, 6.5));
    expect(still.getState().enemies[0]).toEqual(grunt(1, -1, 8));
  });

  it('preserves later authored groups until the player approaches', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const simulation = new Simulation({ seed: 1, level: authored, startSquad: 1, gruntHp: 3 });
    const before = simulation.getState().enemies;
    const state = simulation.getState();
    state.rifle.cooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation, { forwardSpeed: 3 });
    const after = simulation.getState().enemies;
    expect(after).toHaveLength(18);
    expect(after.slice(0, 2).every((enemy, index) => enemy.z < before[index].z)).toBe(true);
    expect(after.slice(2)).toEqual(before.slice(2));
  });

  it('does not move or contact a grunt killed by a projectile first', () => {
    const projectile = { id: 1, x: 0, z: 0, speed: 10, damage: 3, remainingRange: 18 };
    const simulation = withState(1, [grunt(1, 0, 1)], [projectile]);
    step(simulation, { forwardSpeed: 1, gruntMoveSpeed: 5 });
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('detects an enemy crossing a still squad even when both endpoints miss', () => {
    const simulation = withState(2, [grunt(1, 0, 2)]);
    step(simulation, { gruntMoveSpeed: 4 });
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('does not tunnel when player and enemy cross at high combined speed', () => {
    const simulation = withState(2, [grunt(1, 0, 20)]);
    step(simulation, { forwardSpeed: 10, gruntMoveSpeed: 30, gruntActivationDistance: 10 });
    expect(simulation.getState().player.z).toBe(10);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('leaves a near miss outside the combined member/enemy radius untouched', () => {
    const simulation = withState(1, [grunt(1, 0.53, 2)]);
    step(simulation, { gruntMoveSpeed: 4 });
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().enemies).toEqual([grunt(1, 0.53, -2)]);
  });

  it('breaches a surviving moved enemy but never double-counts a direct contact', () => {
    const breach = withState(3, [grunt(1, 2, 2)]);
    const contact = withState(3, [grunt(1, 0, 2)]);
    const changes = { forwardSpeed: 3, gruntMoveSpeed: 1, defenseLineOffset: 1.5 };
    step(breach, changes);
    step(contact, { ...changes, gruntContactDamage: 2 });
    expect(breach.getState().enemies).toEqual([]);
    expect(contact.getState().enemies).toEqual([]);
    expect(breach.getState().squad.count).toBe(2);
    expect(contact.getState().squad.count).toBe(1);
  });

  it('applies later speed and activation-distance changes to existing grunts', () => {
    const simulation = withState(1, [grunt(1, 2, 12)]);
    step(simulation);
    expect(simulation.getState().enemies[0].z).toBe(12);
    step(simulation, { gruntActivationDistance: 12, gruntMoveSpeed: 1 });
    expect(simulation.getState().enemies[0].z).toBe(11);
    step(simulation, { gruntActivationDistance: 12, gruntMoveSpeed: 2 });
    expect(simulation.getState().enemies[0].z).toBe(9);
  });

  it('replays identically and freezes enemy movement once the squad is zero', () => {
    const first = withState(1, [grunt(1, 2, 8)]);
    const second = withState(1, [grunt(1, 2, 8)]);
    for (let index = 0; index < 3; index++) {
      step(first);
      step(second);
    }
    expect(first.getState()).toEqual(second.getState());
    const lost = withState(0, [grunt(1, 2, 8)]);
    step(lost);
    expect(lost.getState().enemies).toEqual([grunt(1, 2, 8)]);
    expect(lost.getState().player).toEqual({ x: 0, z: 0 });
  });

  it('rejects invalid movement tuning without changing state', () => {
    const simulation = withState(1, [grunt(1, 2, 8)]);
    const before = simulation.getState();
    for (const changes of [
      { gruntMoveSpeed: -1 }, { gruntMoveSpeed: Infinity },
      { gruntActivationDistance: 0 }, { gruntActivationDistance: NaN },
    ]) {
      expect(() => step(simulation, changes)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });
});
