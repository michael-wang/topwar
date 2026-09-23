import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { SimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(gameData);
const tuning: SimulationTuning = {
  moveSpeed: config.player.moveSpeed,
  forwardSpeed: 0,
  trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: 100,
  formationSpacing: config.player.formationSpacing,
  memberRadius: config.player.memberRadius,
  gruntRadius: config.enemies.grunt.radius,
  gruntMoveSpeed: config.enemies.grunt.moveSpeed,
  gruntActivationDistance: config.enemies.grunt.activationDistance,
  gruntContactDamage: config.enemies.grunt.contactDamage,
  rifle: { ...config.weapon.rifle },
};

function oneEnemyLevel(startGraceSeconds: number, z = 8): LevelDefinition {
  return {
    id: 'grace-test', length: 30, startGraceSeconds,
    enemyGroups: [{ id: 'one', z, enemy: 'grunt', count: 1,
      formation: { columns: 1, spacing: 0.8 } }],
  };
}

function activeEnemy(startGraceSeconds: number): Simulation {
  const simulation = new Simulation({ seed: 1, level: oneEnemyLevel(startGraceSeconds), startSquad: 1, gruntHp: 3 });
  const state = simulation.getState();
  state.enemies[0].x = 2;
  state.rifle.cooldownRemainingSeconds = 100;
  simulation.restoreState(state);
  return simulation;
}

describe('level opening grace', () => {
  it('holds an otherwise active grunt while the player can move and steer', () => {
    const simulation = activeEnemy(1.5);
    simulation.step(0.5, { targetX: 1 }, { ...tuning, forwardSpeed: 3 });
    expect(simulation.getState().player).toEqual({ x: 1, z: 1.5 });
    expect(simulation.getState().enemies[0].z).toBe(8);
    expect(simulation.getState().elapsedSeconds).toBe(0.5);
  });

  it('still fires, advances projectiles, and allows an enemy to be killed during grace', () => {
    const firing = new Simulation({ seed: 1, level: { ...oneEnemyLevel(1.5), enemyGroups: [] },
      startSquad: 1, gruntHp: 3 });
    firing.step(0.1, { targetX: 0 }, tuning);
    expect(firing.getState().projectiles[0].z).toBeCloseTo(config.weapon.rifle.projectileSpeed * 0.1);
    expect(firing.getState().rifle.nextProjectileId).toBe(2);

    const target = new Simulation({ seed: 1, level: oneEnemyLevel(1.5, 2), startSquad: 1, gruntHp: 3 });
    target.step(0.1, { targetX: 0 }, tuning);
    expect(target.getState().enemies).toEqual([]);
    expect(target.getState().squad.count).toBe(1);
    expect(target.getState().elapsedSeconds).toBe(0.1);
  });

  it('moves at the step that reaches the grace boundary', () => {
    const simulation = activeEnemy(1.5);
    simulation.step(1, { targetX: 0 }, tuning);
    expect(simulation.getState().enemies[0].z).toBe(8);
    simulation.step(0.5, { targetX: 0 }, tuning);
    expect(simulation.getState().elapsedSeconds).toBe(1.5);
    expect(simulation.getState().enemies[0].z).toBe(6.75);
  });

  it('has immediate normal activation when startGraceSeconds is zero', () => {
    const simulation = activeEnemy(0);
    simulation.step(0.5, { targetX: 0 }, tuning);
    expect(simulation.getState().enemies[0].z).toBe(6.75);
  });

  it('does not activate distant authored groups when grace ends', () => {
    const level = LevelDefinitionSchema.parse(authoredLevel);
    const simulation = new Simulation({ seed: 1, level, startSquad: 1, gruntHp: 3 });
    const before = simulation.getState();
    before.rifle.cooldownRemainingSeconds = 100;
    simulation.restoreState(before);
    simulation.step(1.5, { targetX: 0 }, tuning);
    expect(simulation.getState().enemies).toEqual(before.enemies);
    simulation.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 3 });
    const after = simulation.getState().enemies;
    expect(after.slice(0, 2).every((enemy, index) => enemy.z < before.enemies[index].z)).toBe(true);
    expect(after.slice(2)).toEqual(before.enemies.slice(2));
  });

  it('restores the grace boundary from state and gives a fresh run full grace again', () => {
    const original = activeEnemy(1.5);
    original.step(0.5, { targetX: 0 }, tuning);
    const saved = JSON.parse(JSON.stringify(original.getState())) as SimulationState;
    const restored = activeEnemy(0);
    restored.restoreState(saved);
    restored.step(0.5, { targetX: 0 }, tuning);
    expect(restored.getState().enemies[0].z).toBe(8);
    restored.step(0.5, { targetX: 0 }, tuning);
    expect(restored.getState().enemies[0].z).toBe(6.75);

    const fresh = activeEnemy(1.5);
    expect(fresh.getState().startGraceSeconds).toBe(1.5);
    expect(fresh.getState().elapsedSeconds).toBe(0);
    fresh.step(0.5, { targetX: 0 }, tuning);
    expect(fresh.getState().enemies[0].z).toBe(8);
  });
});
