import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const level: LevelDefinition = { id: 'brute-test', length: 20, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, gruntContactDamage: 1, bruteRadius: 0.55, bruteContactDamage: 1,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 40 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 },
};
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });
const brute = (id: number, x: number, z: number, hp = 300): EnemySimulationState =>
  ({ id, type: 'brute', x, z, hp });
const rifle = (id: number, x = 0): ProjectileSimulationState =>
  ({ id, kind: 'rifle', x, z: 0, speed: 10, damage: 3, remainingRange: 18, blastRadius: 0 });
const rocket = (id: number): ProjectileSimulationState =>
  ({ id, kind: 'rocket', x: 0, z: 0, speed: 10, damage: 15,
    remainingRange: 18, blastRadius: 1.25 });

function withState(count: number, enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[] = []) {
  const simulation = new Simulation({ seed: 7, level, startSquad: count, startRocketCount: 0,
    gruntHp: 3, bruteHp: 300 });
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = Math.max(1, ...projectiles.map((projectile) => projectile.id + 1));
  simulation.restoreState(state);
  return simulation;
}

describe('first Tier-2 brute combat', () => {
  it('restores only supported enemy types and owns brute state transactionally', () => {
    const simulation = withState(1, [brute(1, 0, 5)]);
    const state = JSON.parse(JSON.stringify(simulation.getState())) as SimulationState;
    const restored = withState(1, []);
    restored.restoreState(state);
    expect(restored.getState()).toEqual(simulation.getState());
    state.enemies[0].hp = 1;
    expect(restored.getState().enemies[0].hp).toBe(300);
    const invalid = restored.getState();
    invalid.enemies[0].type = 'unknown' as 'brute';
    expect(() => restored.restoreState(invalid)).toThrow(/unsupported/);
    expect(restored.getState()).toEqual(simulation.getState());
  });

  it('keeps grunt one-shot, while brute takes normal cumulative rifle damage', () => {
    const fodder = withState(1, [grunt(1, 0, 5)], [rifle(1)]);
    fodder.step(1, { targetX: 0 }, tuning);
    expect(fodder.getState().enemies).toEqual([]);
    const heavy = withState(1, [brute(1, 0, 5)], [rifle(1)]);
    heavy.step(1, { targetX: 0 }, tuning);
    expect(heavy.getState().enemies).toEqual([brute(1, 0, 5, 297)]);
    const remaining = heavy.getState();
    remaining.projectiles = Array.from({ length: 98 }, (_, index) => rifle(index + 2));
    remaining.weapons.nextProjectileId = 100;
    heavy.restoreState(remaining);
    heavy.step(1, { targetX: 0 }, tuning);
    expect(heavy.getState().enemies).toEqual([brute(1, 0, 5, 3)]);
    const last = heavy.getState();
    last.projectiles = [rifle(100)];
    last.weapons.nextProjectileId = 101;
    heavy.restoreState(last);
    heavy.step(1, { targetX: 0 }, tuning);
    expect(heavy.getState().enemies).toEqual([]);
  });

  it('uses the brute radius for swept rifle hits without enlarging grunt hits', () => {
    for (const [x, hit] of [[0.54, true], [0.56, false]] as const) {
      const simulation = withState(1, [brute(1, x, 5)], [rifle(1)]);
      simulation.step(1, { targetX: 0 }, tuning);
      expect(simulation.getState().enemies[0]?.hp).toBe(hit ? 297 : 300);
    }
    const fast = withState(1, [brute(1, 0, 5)], [{ ...rifle(1), speed: 1000 }]);
    fast.step(0.01, { targetX: 0 }, tuning);
    expect(fast.getState().enemies[0].hp).toBe(297);
    const gruntMiss = withState(1, [grunt(1, 0.54, 5)], [rifle(1)]);
    gruntMiss.step(1, { targetX: 0 }, tuning);
    expect(gruntMiss.getState().enemies).toEqual([grunt(1, 0.54, 5)]);
  });

  it('applies rocket area damage to brute and removes a nearby grunt', () => {
    const simulation = withState(1, [grunt(1, 0, 5), brute(2, 0.8, 5)], [rocket(1)]);
    simulation.step(1, { targetX: 0 }, tuning);
    expect(simulation.getState().enemies).toEqual([brute(2, 0.8, 5, 285)]);
  });

  it('charges one casualty and removes the brute on swept direct contact or breach', () => {
    const contact = withState(2, [brute(1, 0, 5)]);
    contact.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 10, defenseLineOffset: 100 });
    expect(contact.getState().squad.count).toBe(1);
    expect(contact.getState().enemies).toEqual([]);
    const breach = withState(2, [brute(1, 2, 2)]);
    breach.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 3.5 });
    expect(breach.getState().squad.count).toBe(1);
    expect(breach.getState().enemies).toEqual([]);
  });

  it('uses the brute contact radius and lets a projectile kill it before contact', () => {
    const inside = withState(1, [brute(1, 0.76, 0)]);
    inside.step(0.1, { targetX: 0 }, tuning);
    expect(inside.getState().squad.count).toBe(0);
    const outside = withState(1, [brute(1, 0.79, 0)]);
    outside.step(0.1, { targetX: 0 }, tuning);
    expect(outside.getState().squad.count).toBe(1);
    const shotFirst = withState(1, [brute(1, 0, 0.5, 3)], [rifle(1)]);
    shotFirst.step(0.1, { targetX: 0 }, { ...tuning, forwardSpeed: 5 });
    expect(shotFirst.getState().enemies).toEqual([]);
    expect(shotFirst.getState().squad.count).toBe(1);
  });

  it('uses configured brute contact damage and preserves Game Over freeze', () => {
    const simulation = withState(1, [brute(1, 0, 0)]);
    simulation.step(0.1, { targetX: 0 }, { ...tuning, bruteContactDamage: 2 });
    const lost = simulation.getState();
    expect(lost.squad.count).toBe(0);
    expect(lost.enemies).toEqual([]);
    simulation.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 10 });
    expect(simulation.getState().player).toEqual(lost.player);
  });
});
