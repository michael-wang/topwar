import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(gameData);
const emptyLevel: LevelDefinition = { id: 'tier2-rifle', length: 30, enemyGroups: [], upgradeGates: [] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: config.track.defenseLineOffset, formationSpacing: config.player.formationSpacing,
  memberRadius: config.player.memberRadius, gruntRadius: config.enemies.grunt.radius,
  bruteRadius: config.enemies.brute.radius, tier3Radius: 0.3,
  rifle: { ...config.weapon.rifle, fireRate: 0.1 }, rocket: { ...config.weapon.rocket },
};
const create = (count: number, rocketCount = 0, level = emptyLevel) => new Simulation({
  seed: 7, level, startSquad: count, startRocketCount: rocketCount,
  gruntHp: config.enemies.grunt.hp, bruteHp: config.enemies.brute.hp, tier3Hp: 3000,
});
const step = (simulation: Simulation, seconds = 0.1, current = tuning) =>
  simulation.step(seconds, { targetX: 0 }, current);

function combat(enemies: EnemySimulationState[], projectile: ProjectileSimulationState,
  level = emptyLevel): Simulation {
  const simulation = create(1, 0, level);
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = [projectile];
  state.weapons = { rifleCooldownRemainingSeconds: 10, rocketCooldownRemainingSeconds: 10,
    nextProjectileId: projectile.id + 1 };
  simulation.restoreState(state);
  return simulation;
}

const heavy = (damage = 300): ProjectileSimulationState => ({ id: 1, kind: 'heavyRifle',
  x: 0, z: 0, speed: 28, damage, remainingRange: 40, blastRadius: 0, penetrationRemaining: 10 });
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });

describe('Tier-2 rifle compression', () => {
  it('keeps committed startup Tier-1 and normalizes temporary large starts', () => {
    expect(config.player).toMatchObject({ startSquad: 1, startRocketCount: 0 });
    expect(create(config.player.startSquad).getState().squad).toEqual({ count: 1,
      tier2RifleCount: 0, rocketCount: 0 });
    expect(create(9).getState().squad).toEqual({ count: 9, tier2RifleCount: 0, rocketCount: 0 });
    expect(create(10).getState().squad).toEqual({ count: 1, tier2RifleCount: 1, rocketCount: 0 });
    expect(create(11, 1).getState().squad).toEqual({ count: 2, tier2RifleCount: 1, rocketCount: 1 });
    expect(create(100).getState().squad).toEqual({ count: 10, tier2RifleCount: 10, rocketCount: 0 });
  });

  it('fires one projectile per visible role using one shared rifle cooldown', () => {
    for (const [count, expected] of [
      [1, ['rifle']], [10, ['heavyRifle']], [11, ['rifle', 'heavyRifle']],
      [20, ['heavyRifle', 'heavyRifle']],
    ] as const) {
      const simulation = create(count);
      step(simulation);
      expect(simulation.getState().projectiles.map((projectile) => projectile.kind)).toEqual(expected);
      expect(simulation.getState().weapons.nextProjectileId).toBe(expected.length + 1);
    }
    const heavyOnly = create(10);
    step(heavyOnly, 0.1);
    const firstCooldown = heavyOnly.getState().weapons.rifleCooldownRemainingSeconds;
    step(heavyOnly, 0.1);
    expect(heavyOnly.getState().projectiles).toHaveLength(1);
    expect(heavyOnly.getState().weapons.rifleCooldownRemainingSeconds).toBeLessThan(firstCooldown);
    const mixedRocket = create(11, 1);
    step(mixedRocket);
    expect(mixedRocket.getState().projectiles.map((projectile) => projectile.kind)).toEqual([
      'heavyRifle', 'rocket',
    ]);
  });

  it('captures 100x rifle damage, speed, and range at creation; restore reproduces later fire', () => {
    const first = create(10);
    step(first, 0.01);
    expect(first.getState().projectiles[0]).toMatchObject({ kind: 'heavyRifle', damage: 300,
      speed: config.weapon.rifle.projectileSpeed, blastRadius: 0 });
    expect(first.getState().projectiles[0].z + first.getState().projectiles[0].remainingRange)
      .toBeCloseTo(config.weapon.rifle.range);
    const saved = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const second = create(0);
    second.restoreState(saved);
    for (const simulation of [first, second]) {
      const state = simulation.getState();
      state.weapons.rifleCooldownRemainingSeconds = 0;
      simulation.restoreState(state);
      step(simulation, 0.01, { ...tuning, rifle: { ...tuning.rifle, damage: 4 } });
    }
    expect(second.getState()).toEqual(first.getState());
    expect(first.getState().projectiles.map((projectile) => projectile.damage)).toEqual([300, 400]);
    expect(first.getState().projectiles.every((projectile) => projectile.blastRadius === 0)).toBe(true);
  });

  it('stops at a brute but pierces Tier-1 grunts without splashing', () => {
    const brute: EnemySimulationState = { id: 1, type: 'brute', x: 0, z: 5, hp: 300 };
    const simulation = combat([brute, grunt(2, 0, 6), grunt(3, 1, 5)], heavy());
    step(simulation, 0.2);
    expect(simulation.getState().enemies).toEqual([grunt(2, 0, 6), grunt(3, 1, 5)]);
    expect(simulation.getState().projectiles).toEqual([]);
    const fodder = combat([grunt(1, 0, 5), grunt(2, 0, 6)], heavy());
    step(fodder, 0.25);
    expect(fodder.getState().enemies).toEqual([]);
    expect(fodder.getState().projectiles[0].penetrationRemaining).toBe(8);
  });

  it('counts one heavy direct armory hit regardless of captured damage', () => {
    const level: LevelDefinition = { ...emptyLevel, upgradeGates: [{ id: 'wall', x: 0,
      zOffset: 5, width: 1, reward: { mode: 'hitPickup', kind: 'rifle',
        amount: 1, hitsRequired: 10, dropSpeed: 4 } }] };
    const simulation = combat([], heavy(), level);
    step(simulation, 0.2);
    expect(simulation.getState().gates[0].hitProgress).toBe(1);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('collects a threshold Tier-1 pickup into one heavy body without firing that step', () => {
    const simulation = create(9);
    const state = simulation.getState();
    state.pickups = [{ id: 1, sourceGateId: 'left', x: 0, zOffset: 1, width: 1,
      rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 4 }];
    state.nextPickupId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 10;
    simulation.restoreState(state);
    step(simulation, 0.25);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 1 });
    expect(simulation.getState().projectiles).toEqual([]);
    const after = simulation.getState();
    after.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(after);
    step(simulation, 0.01);
    expect(simulation.getState().projectiles.map((projectile) => projectile.kind)).toEqual(['heavyRifle']);
  });

  it('collects a Tier-2 pickup directly and rejects invalid restored composition and projectile', () => {
    const simulation = create(1);
    const state = simulation.getState();
    state.pickups = [{ id: 1, sourceGateId: 'right', x: 0, zOffset: 1, width: 1,
      rewardKind: 'tier2Rifle', rewardAmount: 1, dropSpeed: 4 }];
    state.nextPickupId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 10;
    simulation.restoreState(state);
    step(simulation, 0.25);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 1 });
    const before = simulation.getState();
    for (const corrupt of [
      (candidate: SimulationState) => { candidate.squad.tier2RifleCount = -1; },
      (candidate: SimulationState) => { candidate.squad.tier2RifleCount = 3; },
      (candidate: SimulationState) => { candidate.squad.tier2RifleCount = 0.5; },
      (candidate: SimulationState) => { candidate.projectiles = [{ ...heavy(), blastRadius: 1 }];
        candidate.weapons.nextProjectileId = 2; },
    ]) {
      const invalid = structuredClone(before);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
    const exposed = simulation.getState();
    exposed.squad.tier2RifleCount = 0;
    expect(simulation.getState().squad.tier2RifleCount).toBe(1);
  });

  it('keeps Level 001 enemy progression and squad compression without active armories', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    expect(authored.enemyStream?.bruteRamp).toEqual({ startRow: 48, fullRow: 960, curvePower: 2 });
    expect(authored.upgradeGates).toEqual([]);
    expect(create(1, 0, authored).getState().squad.tier2RifleCount).toBe(0);
  });
});
