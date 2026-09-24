import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { addRifleSoldiers, afterCasualties } from '../src/simulation/squad/composition';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState,
  StreamRewardSimulationState } from '../src/simulation/SimulationState';

const level: LevelDefinition = { id: 'tier-exchange', length: 120, enemyGroups: [], upgradeGates: [],
  enemyStream: { enemy: 'grunt', startZ: 5, spawnAheadDistance: 5.5, columns: 1,
    spacing: 100, jitter: 0, seed: 1, bruteRamp: { startRow: 48, fullRow: 960, curvePower: 2 },
    rewards: { rowsPerReward: 1, spawnAheadDistance: 5.5,
      hitsRequired: 10, seed: 2, sideX: 2.2 } } };
const tuning: SimulationTuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: 0.3, bruteRadius: 0.55,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 40 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } };
const create = (startSquad = 1) => new Simulation({ seed: 7, level, startSquad,
  startRocketCount: 0, gruntHp: 3, bruteHp: 300 });
const grunt = (id: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x: 0, z, hp: 3 });
const brute = (id: number, z: number): EnemySimulationState =>
  ({ id, type: 'brute', x: 0, z, hp: 300 });
const reward = (id: number, tier: 1 | 2, z: number): StreamRewardSimulationState =>
  ({ id, tier, x: 0, z, hitProgress: 0, hitsRequired: 10 });
const shot = (kind: ProjectileSimulationState['kind'] = 'heavyRifle',
  penetrationRemaining = kind === 'heavyRifle' ? 10 : 0): ProjectileSimulationState =>
  ({ id: 1, kind, x: 0, z: 0, speed: 100, damage: kind === 'heavyRifle' ? 300 : 3,
    remainingRange: 40, blastRadius: kind === 'rocket' ? 1.25 : 0, penetrationRemaining });

function setup(enemies: EnemySimulationState[], rewards: StreamRewardSimulationState[] = [],
  projectile = shot()): Simulation {
  const simulation = create();
  const state = simulation.getState();
  state.enemies = enemies;
  state.enemyStream!.nextEnemyId = Math.max(state.enemyStream!.nextEnemyId,
    ...enemies.map((enemy) => enemy.id + 1));
  state.streamRewards = rewards;
  state.enemyStream!.nextRewardId = Math.max(1, ...rewards.map((target) => target.id + 1));
  state.projectiles = [projectile];
  state.weapons.rifleCooldownRemainingSeconds = 100;
  state.weapons.rocketCooldownRemainingSeconds = 100;
  state.weapons.nextProjectileId = 2;
  simulation.restoreState(state);
  return simulation;
}
const advance = (simulation: Simulation, seconds = 0.2) =>
  simulation.step(seconds, { targetX: 0 }, tuning);

describe('Tier-2 heavy rifle traversal', () => {
  it('captures ten penetration points at creation and preserves them across restore', () => {
    const simulation = create(10);
    simulation.step(0.01, { targetX: 0 }, tuning);
    expect(simulation.getState().projectiles).toMatchObject([
      { kind: 'heavyRifle', damage: 300, penetrationRemaining: 10 },
    ]);
    const saved = JSON.parse(JSON.stringify(simulation.getState())) as SimulationState;
    const restored = create();
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(simulation.getState());
    for (const value of [0, 11, -1, 1.5, NaN]) {
      const invalid = structuredClone(saved);
      invalid.projectiles[0].penetrationRemaining = value;
      expect(() => restored.restoreState(invalid)).toThrow();
      expect(restored.getState()).toEqual(saved);
    }
  });

  it('progresses a Tier-1 reward and pierces a dense row behind it in one swept step', () => {
    const simulation = setup([grunt(1, 10.6), grunt(2, 11.2), grunt(3, 11.8)],
      [reward(1, 1, 10)]);
    advance(simulation);
    const state = simulation.getState();
    expect(state.streamRewards[0].hitProgress).toBe(1);
    expect(state.enemies).toEqual([]);
    expect(state.projectiles).toMatchObject([{ z: 20, remainingRange: 20,
      penetrationRemaining: 7 }]);
  });

  it('counts one heavy projectile only once when it remains inside a reward across ticks', () => {
    const simulation = setup([], [reward(1, 1, 10)]);
    advance(simulation, 0.1);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toMatchObject([{ z: 10,
      penetrationRemaining: 10 }]);
    advance(simulation, 0.01);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toMatchObject([{ z: 11,
      penetrationRemaining: 10 }]);
  });

  it('counts ten heavy shots on one Tier-1 reward while each still pierces grunts behind', () => {
    const simulation = setup([], [reward(1, 1, 10)]);
    for (let volley = 0; volley < 10; volley++) {
      const state = simulation.getState();
      state.enemies = [grunt(volley * 3 + 1, 10.6), grunt(volley * 3 + 2, 11.2),
        grunt(volley * 3 + 3, 11.8)];
      state.enemyStream!.nextEnemyId = volley * 3 + 4;
      state.projectiles = [{ ...shot(), id: volley + 1 }];
      state.weapons.nextProjectileId = volley + 2;
      simulation.restoreState(state);
      advance(simulation);
      const after = simulation.getState();
      expect(after.enemies).toEqual([]);
      expect(after.projectiles).toMatchObject([{ penetrationRemaining: 7, z: 20 }]);
      if (volley < 9) expect(after.streamRewards[0].hitProgress).toBe(volley + 1);
    }
    expect(simulation.getState().streamRewards).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 2, tier2RifleCount: 0, rocketCount: 0 });
  });

  it('unlocks a Tier-1 reward at 9/10, normalizes nine Tier-1 bodies, and continues the shot', () => {
    const simulation = setup([grunt(1, 10.6)], [{ ...reward(1, 1, 10), hitProgress: 9 }]);
    const ready = simulation.getState();
    ready.squad = { count: 9, tier2RifleCount: 0, rocketCount: 0 };
    simulation.restoreState(ready);
    advance(simulation);
    const after = simulation.getState();
    expect(after.streamRewards).toEqual([]);
    expect(after.squad).toEqual({ count: 1, tier2RifleCount: 1, rocketCount: 0 });
    expect(after.enemies).toEqual([]);
    expect(after.projectiles).toMatchObject([{ penetrationRemaining: 9, z: 20 }]);
    expect(after.weapons.nextProjectileId).toBe(2);
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(after)) as SimulationState);
    advance(simulation, 0.1);
    advance(restored, 0.1);
    expect(restored.getState()).toEqual(simulation.getState());
  });

  it('consumes the tenth Tier-1 penetration and cannot kill an eleventh', () => {
    const simulation = setup(Array.from({ length: 11 }, (_, index) => grunt(index + 1, 3 + index * 0.6)));
    advance(simulation);
    expect(simulation.getState().enemies).toEqual([grunt(11, 9)]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('uses forward order for Tier-1, lower-tier reward, and later Tier-1', () => {
    const simulation = setup([grunt(2, 10), grunt(1, 11.2)], [reward(1, 1, 10.6)]);
    advance(simulation);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles[0].penetrationRemaining).toBe(8);
  });

  it('stops at a Tier-2 enemy after piercing Tier-1 without hitting later enemies', () => {
    const simulation = setup([grunt(1, 10), brute(2, 11), grunt(3, 12)]);
    advance(simulation);
    expect(simulation.getState().enemies).toEqual([grunt(3, 12)]);
    expect(simulation.getState().projectiles).toEqual([]);
    const injured = setup([{ ...brute(1, 10), hp: 400 }]);
    advance(injured);
    expect(injured.getState().enemies[0].hp).toBe(100);
    expect(injured.getState().projectiles).toEqual([]);
  });

  it('stops at a matching Tier-2 reward before the enemy behind it', () => {
    const simulation = setup([grunt(1, 11)], [reward(1, 2, 10)]);
    advance(simulation);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
    expect(simulation.getState().enemies).toEqual([grunt(1, 11)]);
    expect(simulation.getState().projectiles).toEqual([]);
    const afterGrunt = setup([grunt(1, 9), grunt(2, 11)], [reward(1, 2, 10)]);
    advance(afterGrunt);
    expect(afterGrunt.getState().enemies).toEqual([grunt(2, 11)]);
    expect(afterGrunt.getState().streamRewards[0].hitProgress).toBe(1);
    expect(afterGrunt.getState().projectiles).toEqual([]);
  });

  it('uses enemy ID to resolve an exact-distance tie at the last penetration point', () => {
    const firstNine = Array.from({ length: 9 }, (_, index) => grunt(index + 1, 3 + index * 0.6));
    const simulation = setup([...firstNine, grunt(11, 10), grunt(10, 10)]);
    advance(simulation);
    expect(simulation.getState().enemies).toEqual([grunt(11, 10)]);
  });

  it('keeps normal rifle and rocket non-piercing, with strict kind-specific state', () => {
    const rifle = setup([grunt(1, 10), grunt(2, 11)], [], shot('rifle'));
    advance(rifle);
    expect(rifle.getState().enemies).toEqual([grunt(2, 11)]);
    expect(rifle.getState().projectiles).toEqual([]);
    const rocket = setup([grunt(1, 10), grunt(2, 13)], [reward(1, 1, 9)], shot('rocket'));
    advance(rocket);
    expect(rocket.getState().streamRewards[0].hitProgress).toBe(0);
    expect(rocket.getState().enemies).toEqual([grunt(2, 13)]);
    for (const kind of ['rifle', 'rocket'] as const) {
      const invalid = create().getState();
      invalid.projectiles = [shot(kind, 1)];
      invalid.weapons.nextProjectileId = 2;
      expect(() => create().restoreState(invalid)).toThrow();
    }
  });

  it('replays a partially spent heavy shot and its future hits after JSON restore', () => {
    const first = setup([grunt(1, 10.6), grunt(2, 21)], [reward(1, 1, 10)]);
    advance(first, 0.2);
    expect(first.getState().projectiles[0].penetrationRemaining).toBe(9);
    const second = create();
    second.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    advance(first, 0.1);
    advance(second, 0.1);
    expect(second.getState()).toEqual(first.getState());
    expect(first.getState().enemies).toEqual([]);
    expect(first.getState().projectiles[0].penetrationRemaining).toBe(8);
  });
});

describe('defensive Tier exchange', () => {
  const t2 = { count: 1, tier2RifleCount: 1, rocketCount: 0 };
  it('demotes one Tier-2 body to nine Tier-1 bodies, then loses them one by one', () => {
    expect(afterCasualties(t2, 1)).toEqual({ count: 9, tier2RifleCount: 0, rocketCount: 0 });
    expect(afterCasualties(afterCasualties(t2, 1), 1)).toEqual({ count: 8,
      tier2RifleCount: 0, rocketCount: 0 });
    expect(afterCasualties(t2, 10)).toEqual({ count: 0, tier2RifleCount: 0, rocketCount: 0 });
    expect(addRifleSoldiers(afterCasualties(t2, 1), 1, 1)).toEqual(t2);
  });

  it('charges ten points for Tier-2 and spends rifle value before rockets', () => {
    expect(afterCasualties({ count: 15, tier2RifleCount: 0, rocketCount: 0 }, 10)).toMatchObject({ count: 5 });
    expect(afterCasualties({ count: 2, tier2RifleCount: 2, rocketCount: 0 }, 10))
      .toEqual({ count: 1, tier2RifleCount: 1, rocketCount: 0 });
    expect(afterCasualties({ count: 6, tier2RifleCount: 1, rocketCount: 0 }, 10))
      .toEqual({ count: 5, tier2RifleCount: 0, rocketCount: 0 });
    expect(afterCasualties({ count: 2, tier2RifleCount: 1, rocketCount: 1 }, 10))
      .toEqual({ count: 1, tier2RifleCount: 0, rocketCount: 1 });
    expect(afterCasualties({ count: 2, tier2RifleCount: 1, rocketCount: 1 }, 11))
      .toEqual({ count: 0, tier2RifleCount: 0, rocketCount: 0 });
  });

  it('serializes a contact demotion and keeps Game Over tied to zero visible bodies', () => {
    const simulation = create(10);
    const state = simulation.getState();
    state.enemies = [grunt(1, 0)];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    advance(simulation, 0.01);
    expect(simulation.getState().squad).toEqual({ count: 9, tier2RifleCount: 0, rocketCount: 0 });
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(simulation.getState())) as SimulationState);
    expect(restored.getState()).toEqual(simulation.getState());
    const again = restored.getState();
    again.enemies = [grunt(2, 0)];
    again.enemyStream!.nextEnemyId = 3;
    restored.restoreState(again);
    advance(restored, 0.01);
    expect(restored.getState().squad.count).toBe(8);
    expect(afterCasualties(t2, 10).count).toBe(0);
  });

  it('charges a brute breach ten points to one Tier-2 body', () => {
    const simulation = create(10);
    const state = simulation.getState();
    state.enemies = [brute(1, -2)];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    advance(simulation, 0.01);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().squad.count).toBe(0);
    const frozen = simulation.getState();
    advance(simulation, 0.1);
    expect(simulation.getState().player).toEqual(frozen.player);
    expect(simulation.getState().projectiles).toEqual(frozen.projectiles);
  });
});
