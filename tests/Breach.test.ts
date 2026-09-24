import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

const level: LevelDefinition = { id: 'breach-test', length: 20, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3,
  gruntContactDamage: 1,
  bruteRadius: 0.55, bruteContactDamage: 1,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 10, range: 18 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 },
};
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });

function withState(count: number, enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[] = []) {
  const simulation = new Simulation({ seed: 7, level, startSquad: count, startRocketCount: 0, gruntHp: 3, bruteHp: 100 });
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = projectiles.length + 1;
  simulation.restoreState(state);
  return simulation;
}

const advance = (simulation: Simulation, speed = 3.5) =>
  simulation.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: speed });

describe('moving defense-line breaches', () => {
  it.each([
    ['behind', 1.99, true],
    ['on the line', 2, true],
    ['ahead', 2.01, false],
  ] as const)('%s is resolved at the new line position', (_label, z, breached) => {
    const simulation = withState(2, [grunt(1, 2, z)]);
    advance(simulation);
    expect(simulation.getState().squad.count).toBe(breached ? 1 : 2);
    expect(simulation.getState().enemies).toEqual(breached ? [] : [grunt(1, 2, z)]);
  });

  it('catches an enemy crossed by a large advancing step', () => {
    const simulation = withState(2, [grunt(1, 2, 4)]);
    advance(simulation, 10);
    expect(simulation.getState().player.z).toBe(10);
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('never breaches a contacted enemy twice', () => {
    const simulation = withState(3, [grunt(1, 0, 1)]);
    advance(simulation);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('does not breach an enemy killed by a projectile earlier in the tick', () => {
    const projectile = { id: 1, kind: 'rifle' as const, x: 2, z: 1.5,
      speed: 10, damage: 3, remainingRange: 18, blastRadius: 0 };
    const simulation = withState(2, [grunt(1, 2, 2)], [projectile]);
    advance(simulation);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('processes leaked enemies in ID order and stops when the squad reaches zero', () => {
    const simulation = withState(1, [grunt(9, 2, 1), grunt(2, -2, 1), grunt(5, 2, 0)]);
    advance(simulation);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies.map((enemy) => enemy.id)).toEqual([9, 5]);
    const stopped = simulation.getState();
    advance(simulation);
    expect(simulation.getState().player).toEqual(stopped.player);
    expect(simulation.getState().enemies).toEqual(stopped.enemies);
    expect(simulation.getState().weapons).toEqual(stopped.weapons);
  });

  it('is deterministic and rejects invalid offset transactionally', () => {
    const first = withState(3, [grunt(2, 2, 2), grunt(1, -2, 2)]);
    const second = withState(3, [grunt(2, 2, 2), grunt(1, -2, 2)]);
    for (const simulation of [first, second]) advance(simulation);
    expect(first.getState()).toEqual(second.getState());
    expect(first.getState().squad.count).toBe(1);
    expect(first.getState().enemies).toEqual([]);
    const before = first.getState();
    for (const defenseLineOffset of [0, -1, Infinity, NaN]) {
      expect(() => first.step(1, { targetX: 0 }, { ...tuning, defenseLineOffset })).toThrow(/defenseLineOffset/);
      expect(first.getState()).toEqual(before);
    }
  });

  it('a fresh run restores authored enemies, squad size, and weapon allocator', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const first = new Simulation({ seed: 1, level: authored, startSquad: 3, startRocketCount: 0, gruntHp: 3, bruteHp: 100 });
    const authoredPositions = first.getState().enemies.map(({ id, x, z }) => ({ id, x, z }));
    first.step(0.1, { targetX: 0 }, { ...tuning, forwardSpeed: 3 });
    const fresh = new Simulation({ seed: 1, level: authored, startSquad: 5, startRocketCount: 0, gruntHp: 4, bruteHp: 100 });
    const state = fresh.getState();
    expect(state.player).toEqual({ x: 0, z: 0 });
    expect(state.squad.count).toBe(5);
    expect(state.enemies.length).toBeGreaterThan(700);
    expect(state.enemyStream).toEqual(first.getState().enemyStream);
    expect(state.enemies.map(({ id, x, z }) => ({ id, x, z }))).toEqual(authoredPositions);
    expect(state.enemies.every((enemy) => enemy.hp === (enemy.type === 'brute' ? 100 : 4))).toBe(true);
    expect(state.projectiles).toEqual([]);
    expect(state.weapons).toEqual({ rifleCooldownRemainingSeconds: 0,
      rocketCooldownRemainingSeconds: 0, nextProjectileId: 1 });
  });
});
