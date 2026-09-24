import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';

const level: LevelDefinition = { id: 'contact-test', length: 20, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5, formationSpacing: 0.45,
  memberRadius: 0.22, gruntRadius: 0.3, bruteRadius: 0.3, tier3Radius: 0.3,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 10, range: 18 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 },
};
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });
const shot = (id: number, x = 0, z = 0): ProjectileSimulationState =>
  ({ id, kind: 'rifle', x, z, speed: 10, damage: 3, remainingRange: 18, blastRadius: 0,
    penetrationRemaining: 0 });

function simulationWith(count: number, enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[] = [], rocketCount = 0) {
  const simulation = new Simulation({ seed: 7, level, startSquad: count, startRocketCount: rocketCount, gruntHp: 3, bruteHp: 300, tier3Hp: 3000 });
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = projectiles.length + 1;
  simulation.restoreState(state);
  return simulation;
}

describe('Enemy contact casualties', () => {
  it('preserves rocket specialists until rifle soldiers are gone', () => {
    const oneContact = simulationWith(2, [grunt(1, 0, 0)], [], 1);
    oneContact.step(0.1, { targetX: 0 }, tuning);
    expect(oneContact.getState().squad).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0 });
    const twoContacts = simulationWith(2, [grunt(1, 0, 0), grunt(2, 0, 0)], [], 1);
    twoContacts.step(0.1, { targetX: 0 }, tuning);
    expect(twoContacts.getState().squad).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0 });
  });
  it('removes one contacting grunt and one soldier exactly once', () => {
    const simulation = simulationWith(3, [grunt(1, 0, 0)]);
    simulation.step(0.1, { targetX: 0 }, tuning);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().enemies).toEqual([]);
    simulation.step(0.1, { targetX: 0 }, tuning);
    expect(simulation.getState().squad.count).toBe(2);
  });

  it.each([
    ['just inside', 0.22 + 0.3 - 0.001, true],
    ['at boundary', 0.22 + 0.3, true],
    ['clearly outside', 0.22 + 0.3 + 0.1, false],
  ] as const)('%s combined radius is resolved per member', (_label, x, hit) => {
    const simulation = simulationWith(1, [grunt(1, x, 0)]);
    simulation.step(0.1, { targetX: 0 }, tuning);
    expect(simulation.getState().squad.count).toBe(hit ? 0 : 1);
    expect(simulation.getState().enemies.length).toBe(hit ? 0 : 1);
  });

  it('sweeps the member path across an enemy without tunneling', () => {
    const simulation = simulationWith(1, [grunt(1, 0, 5)]);
    simulation.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 10, defenseLineOffset: 100 });
    expect(simulation.getState().player.z).toBe(10);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('does not touch enemies behind or outside the swept path', () => {
    const enemies = [grunt(1, 0, -2), grunt(2, 1, 5)];
    const simulation = simulationWith(1, enemies);
    simulation.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 10, defenseLineOffset: 100 });
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().enemies).toEqual(enemies);
  });

  it('resolves projectile death before contact', () => {
    const simulation = simulationWith(1, [grunt(1, 0, 0.5)], [shot(1)]);
    simulation.step(0.1, { targetX: 0 }, { ...tuning, forwardSpeed: 5 });
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('resolves several contacts in enemy ID order and recomputes formation after each loss', () => {
    const simulation = simulationWith(3, [grunt(5, 0, -0.6), grunt(1, 0, -0.6)]);
    simulation.step(0.1, { targetX: 0 }, { ...tuning, formationSpacing: 1.2 });
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().enemies.map((enemy) => enemy.id)).toEqual([5]);

    const both = simulationWith(3, [grunt(9, 0, 0), grunt(2, 0, 0)]);
    both.step(0.1, { targetX: 0 }, tuning);
    expect(both.getState().squad.count).toBe(1);
    expect(both.getState().enemies).toEqual([]);
  });

  it('uses one Tier-1 defense point and clamps casualties at zero', () => {
    const simulation = simulationWith(1, [grunt(1, 0, 0)]);
    simulation.step(0.1, { targetX: 0 }, tuning);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('freezes gameplay positions, projectiles, and rifle timing after reaching zero', () => {
    const simulation = simulationWith(1, [grunt(1, 0, 0)], [shot(1, 2)]);
    simulation.step(0.1, { targetX: 0 }, tuning);
    const stopped = simulation.getState();
    expect(stopped.squad.count).toBe(0);
    simulation.step(1, { targetX: 2 }, { ...tuning, moveSpeed: 5, forwardSpeed: 5 });
    const later = simulation.getState();
    expect(later.player).toEqual(stopped.player);
    expect(later.enemies).toEqual(stopped.enemies);
    expect(later.projectiles).toEqual(stopped.projectiles);
    expect(later.weapons).toEqual(stopped.weapons);
    expect(later.tick).toBe(stopped.tick + 1);
    expect(later.elapsedSeconds).toBe(stopped.elapsedSeconds + 1);
  });

  it('replays stationary-enemy contact deterministically', () => {
    const enemies = [grunt(2, 0.9, 2), grunt(1, 0, 1)];
    const first = simulationWith(3, enemies);
    const second = simulationWith(3, enemies);
    const current = { ...tuning, forwardSpeed: 3 };
    for (let tick = 0; tick < 60; tick++) {
      first.step(1 / 60, { targetX: 0 }, current);
      second.step(1 / 60, { targetX: 0 }, current);
    }
    expect(first.getState()).toEqual(second.getState());
    expect(first.getState().rngState).toBe(7);
  });

  it('rejects invalid contact tuning without partial mutation', () => {
    const simulation = simulationWith(1, [grunt(1, 0, 0)]);
    const before = simulation.getState();
    for (const invalid of [
      { ...tuning, memberRadius: 0 },
      { ...tuning, memberRadius: Infinity },
    ]) {
      expect(() => simulation.step(0.1, { targetX: 0 }, invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });
});
