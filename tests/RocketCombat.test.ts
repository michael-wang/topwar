import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(gameData);
const level = { id: 'rocket-test', length: 100, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: config.track.defenseLineOffset,
  formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
  gruntRadius: config.enemies.grunt.radius, gruntContactDamage: config.enemies.grunt.contactDamage,
  bruteRadius: config.enemies.brute.radius, bruteContactDamage: config.enemies.brute.contactDamage,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket },
};

function create(count: number, rocketCount: number): Simulation {
  return new Simulation({ seed: 17, level, startSquad: count, startRocketCount: rocketCount, gruntHp: 3, bruteHp: 300 });
}

function step(simulation: Simulation, seconds = 0.1, current = tuning): void {
  simulation.step(seconds, { targetX: 0 }, current);
}

function grunt(id: number, x: number, z: number, hp = 3): EnemySimulationState {
  return { id, type: 'grunt', x, z, hp };
}

function rocket(id = 1, blastRadius = 1.25): ProjectileSimulationState {
  return { id, kind: 'rocket', x: 0, z: 0, speed: 10, damage: 3, remainingRange: 18, blastRadius };
}

function withCombat(enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[]): Simulation {
  const simulation = create(1, 1);
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons = { rifleCooldownRemainingSeconds: 100, rocketCooldownRemainingSeconds: 100,
    nextProjectileId: Math.max(1, ...projectiles.map((projectile) => projectile.id + 1)) };
  simulation.restoreState(state);
  return simulation;
}

describe('rocket specialist firing', () => {
  it('keeps the committed one-soldier startup rifle-only', () => {
    expect(config.player).toMatchObject({ startSquad: 1, startRocketCount: 0 });
    const simulation = create(1, 0);
    step(simulation);
    expect(simulation.getState().projectiles.map((projectile) => projectile.kind)).toEqual(['rifle']);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 0 });
  });

  it('assigns the rear formation offset to the rocket and fires one projectile per role', () => {
    const simulation = create(2, 1);
    step(simulation);
    expect(simulation.getState().projectiles.map(({ id, kind, x }) => ({ id, kind, x }))).toEqual([
      { id: 1, kind: 'rifle', x: -0.225 }, { id: 2, kind: 'rocket', x: 0.225 },
    ]);
    expect(simulation.getState().rngState).toBe(17);
    const rocketsOnly = create(2, 2);
    step(rocketsOnly);
    expect(rocketsOnly.getState().projectiles.map((projectile) => projectile.kind)).toEqual(['rocket', 'rocket']);
    expect(rocketsOnly.getState().projectiles.map((projectile) => projectile.x)).toEqual([-0.225, 0.225]);
  });

  it('schedules rifle and rocket volleys independently and restores future firing exactly', () => {
    const first = create(2, 1);
    step(first);
    const saved = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const restored = create(0, 0);
    restored.restoreState(saved);
    step(first, 0.05);
    step(restored, 0.05);
    expect(first.getState()).toEqual(restored.getState());
    expect(first.getState().projectiles.map((projectile) => projectile.kind)).toEqual(['rifle', 'rocket', 'rifle']);
    expect(first.getState().weapons.rocketCooldownRemainingSeconds).toBeGreaterThan(1);
    expect(first.getState().weapons.rifleCooldownRemainingSeconds).toBeGreaterThan(0);
  });

  it('captures rocket tuning at creation; live tuning changes affect only later rockets', () => {
    const simulation = create(1, 1);
    step(simulation);
    const original = simulation.getState().projectiles[0];
    expect(original).toMatchObject({ kind: 'rocket', speed: 18, damage: 15, blastRadius: 1.25 });
    expect(original.z + original.remainingRange).toBeCloseTo(40);
    const state = simulation.getState();
    state.weapons.rocketCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    step(simulation, 0.05, { ...tuning, rocket: { damage: 21, fireRate: 1, projectileSpeed: 7,
      range: 12, blastRadius: 2 } });
    const [inFlight, newRocket] = simulation.getState().projectiles;
    expect(inFlight).toMatchObject({ kind: 'rocket', speed: 18, damage: 15, blastRadius: 1.25 });
    expect(inFlight.z + inFlight.remainingRange).toBeCloseTo(40);
    expect(newRocket).toMatchObject({ id: 2, kind: 'rocket', speed: 7, damage: 21, blastRadius: 2 });
    expect(newRocket.z + newRocket.remainingRange).toBeCloseTo(12);
  });
});

describe('rocket blast', () => {
  it('damages the direct-hit grunt and nearby grunts but not enemies outside the radius', () => {
    const simulation = withCombat([grunt(9, 2, 5), grunt(5, 0, 5, 6), grunt(2, 0.8, 5)], [rocket()]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([grunt(9, 2, 5), grunt(5, 0, 5, 3)]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('removes several base grunts immediately and lets later shots pass dead enemies', () => {
    const rifle: ProjectileSimulationState = { id: 2, kind: 'rifle', x: 0, z: 0,
      speed: 10, damage: 3, remainingRange: 18, blastRadius: 0 };
    const simulation = withCombat([grunt(1, 0, 5), grunt(2, 0.8, 5), grunt(3, 0, 7)], [rocket(), rifle]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('aims a later rocket at survivors after an earlier rifle kill in the same tick', () => {
    const rifle: ProjectileSimulationState = { id: 1, kind: 'rifle', x: 0, z: 0,
      speed: 10, damage: 3, remainingRange: 18, blastRadius: 0 };
    const simulation = withCombat([grunt(1, 0, 5), grunt(2, 0, 7), grunt(3, 0.8, 7)],
      [rifle, rocket(2)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('resolves equal direct hits by enemy ID before applying a narrow blast', () => {
    const simulation = withCombat([grunt(9, 0.2, 5), grunt(2, -0.2, 5)], [rocket(1, 0.1)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([grunt(9, 0.2, 5)]);
  });

  it('does not explode at range expiry or without a direct hit', () => {
    // This enemy is inside a blast radius of the endpoint, but no direct hit occurs.
    const expired = withCombat([grunt(1, 0.8, 2)], [{ ...rocket(), remainingRange: 2 }]);
    step(expired, 1);
    expect(expired.getState().enemies).toEqual([grunt(1, 0.8, 2)]);
    expect(expired.getState().projectiles).toEqual([]);
    const missed = withCombat([grunt(1, 2, 5)], [rocket()]);
    step(missed, 1);
    expect(missed.getState().enemies).toEqual([grunt(1, 2, 5)]);
  });

  it('rejects invalid projectile kinds and blast radii transactionally', () => {
    const simulation = withCombat([], [rocket()]);
    const before = simulation.getState();
    for (const damage of [
      (s: SimulationState) => { s.projectiles[0].kind = 'other' as 'rocket'; },
      (s: SimulationState) => { s.projectiles[0].blastRadius = 0; },
      (s: SimulationState) => { s.projectiles[0].blastRadius = Infinity; },
      (s: SimulationState) => { s.projectiles[0] = { ...s.projectiles[0], kind: 'rifle' }; },
    ]) {
      const invalid = simulation.getState();
      damage(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });
});
