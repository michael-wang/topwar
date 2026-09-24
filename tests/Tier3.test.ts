import { describe, expect, it } from 'vitest';
import config from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { tier2ProbabilityForRow, tier3ProbabilityForRow, tier3RollForSlot } from '../src/simulation/enemies/bruteRamp';
import { createEnemyStreamRow } from '../src/simulation/enemies/streamRow';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';

const game = GameConfigSchema.parse(config);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22,
  gruntRadius: game.enemies.grunt.radius, bruteRadius: game.enemies.brute.radius,
  tier3Radius: game.enemies.tier3.radius,
  rifle: { ...game.weapon.rifle }, rocket: { ...game.weapon.rocket },
};
const create = (spawnAheadDistance = 96) => new Simulation({ seed: 17,
  level: { ...level, enemyStream: { ...stream, spawnAheadDistance, rewards: undefined } },
  startSquad: 1, startRocketCount: 0, gruntHp: game.enemies.grunt.hp,
  bruteHp: game.enemies.brute.hp, tier3Hp: game.enemies.tier3.hp });

describe('overlapping Tier-3 enemy pressure', () => {
  it('validates committed stats and a strict Tier-3 ramp', () => {
    expect(game.enemies.grunt).toEqual({ hp: 3, radius: 0.3 });
    expect(game.enemies.brute).toEqual({ hp: 300, radius: 0.3 });
    expect(game.enemies.tier3).toEqual({ hp: 3000, radius: 0.3 });
    expect(stream.bruteRamp).toEqual({ startRow: 48, fullRow: 960, curvePower: 2 });
    expect(stream.tier3Ramp).toEqual({ startRow: 360, fullRow: 1320, curvePower: 2 });
    for (const tier3Ramp of [
      { startRow: -1, fullRow: 1320, curvePower: 2 },
      { startRow: 360, fullRow: 360, curvePower: 2 },
      { startRow: 360, fullRow: 1320, curvePower: 0 },
      { startRow: 360, fullRow: 1320, curvePower: 2, extra: true },
    ]) {
      expect(() => LevelDefinitionSchema.parse({ ...level, enemyStream: { ...stream, tier3Ramp } })).toThrow();
    }
    expect(() => GameConfigSchema.parse({ ...game, enemies: {
      ...game.enemies, tier3: { hp: 0, radius: 0.3 },
    } })).toThrow();
  });

  it('reveals one center-most Tier-3 at row 360 without changing geometry or IDs', () => {
    const simulation = create(241);
    const state = simulation.getState();
    const row = (index: number) => state.enemies.slice(index * 7, index * 7 + 7);
    expect(row(359).every((enemy) => enemy.type !== 'tier3')).toBe(true);
    const reveal = row(360);
    expect(reveal.filter((enemy) => enemy.type === 'tier3')).toHaveLength(1);
    const center = reveal.reduce((best, enemy, index) =>
      Math.abs(enemy.x) < Math.abs(reveal[best].x) ? index : best, 0);
    expect(reveal[center].type).toBe('tier3');
    const offsets = createEnemyStreamRow(360, 7, stream.spacing, stream.jitter, stream.seed);
    expect(reveal.map(({ x, z }) => ({ x, z }))).toEqual(offsets.map((offset) =>
      ({ x: offset.x, z: stream.startZ + 360 * stream.spacing + offset.z })));
    expect(reveal.map((enemy) => enemy.id)).toEqual([2521, 2522, 2523, 2524, 2525, 2526, 2527]);
    expect(state.rngState).toBe(17);
    expect(create(241).getState().enemies).toEqual(state.enemies);
  });

  it('reproduces the reveal after restore and permanently saturates at authored row 1320', () => {
    const before = create(239);
    const resumed = create(239);
    resumed.restoreState(before.getState());
    const changedSurvivors = create(239);
    const altered = changedSurvivors.getState();
    altered.enemies.splice(0, 1);
    changedSurvivors.restoreState(altered);
    const firstFutureId = before.getState().enemyStream!.nextEnemyId;
    const moving = { ...tuning, forwardSpeed: 2 };
    before.step(1, { targetX: 0 }, moving);
    resumed.step(1, { targetX: 0 }, moving);
    changedSurvivors.step(1, { targetX: 0 }, moving);
    expect(resumed.getState()).toEqual(before.getState());
    expect(changedSurvivors.getState().enemies.filter((enemy) => enemy.id >= firstFutureId))
      .toEqual(before.getState().enemies.filter((enemy) => enemy.id >= firstFutureId));
    expect(before.getState().enemies.filter((enemy) => enemy.id >= 360 * 7 + 1 && enemy.id <= 361 * 7)
      .filter((enemy) => enemy.type === 'tier3')).toHaveLength(1);
    const saturated = create(817).getState();
    for (const index of [1320, 1321]) {
      expect(saturated.enemies.slice(index * 7, index * 7 + 7)
        .every((enemy) => enemy.type === 'tier3')).toBe(true);
    }
    expect(saturated.rngState).toBe(17);
  });

  it('overlaps all three tiers, preserves Tier-2 saturation underneath, and ends in all Tier-3', () => {
    const compact = { ...stream, startZ: 0, spawnAheadDistance: 100,
      bruteRamp: { startRow: 2, fullRow: 12, curvePower: 1 },
      tier3Ramp: { startRow: 5, fullRow: 18, curvePower: 1 }, rewards: undefined };
    const simulation = new Simulation({ seed: 17, level: { ...level, enemyStream: compact },
      startSquad: 1, startRocketCount: 0, gruntHp: 3, bruteHp: 300, tier3Hp: 3000 });
    const state = simulation.getState();
    const row = (index: number) => state.enemies.slice(index * 7, index * 7 + 7);
    expect(row(4).every((enemy) => enemy.type !== 'tier3')).toBe(true);
    expect(row(5).filter((enemy) => enemy.type === 'tier3')).toHaveLength(1);
    expect(state.enemies.slice(5 * 7, 12 * 7).some((enemy) => enemy.type === 'grunt')).toBe(true);
    expect(state.enemies.slice(5 * 7, 12 * 7).some((enemy) => enemy.type === 'brute')).toBe(true);
    expect(state.enemies.slice(5 * 7, 12 * 7).some((enemy) => enemy.type === 'tier3')).toBe(true);
    for (let index = 12; index < 18; index++) {
      expect(row(index).every((enemy) => enemy.type !== 'grunt')).toBe(true);
    }
    for (let index = 18; index < 30; index++) {
      expect(row(index).every((enemy) => enemy.type === 'tier3')).toBe(true);
    }
    expect(tier3ProbabilityForRow(504, stream.tier3Ramp!)).toBeCloseTo(0.0225);
    expect(tier2ProbabilityForRow(504, stream.bruteRamp)).toBeCloseTo(0.25);
    expect(tier3RollForSlot(stream.seed, 500, 2)).toBe(tier3RollForSlot(stream.seed, 500, 2));
    expect(state.rngState).toBe(17);
    const restored = new Simulation({ seed: 99, level: { ...level, enemyStream: compact },
      startSquad: 1, startRocketCount: 0, gruntHp: 3, bruteHp: 300, tier3Hp: 3000 });
    restored.restoreState(state);
    expect(restored.getState()).toEqual(state);
  });

  it('takes ten heavy shots, stops the heavy projectile, and costs ten defense on contact or breach', () => {
    const emptyLevel = { id: 'tier3-combat', length: 20, enemyGroups: [], upgradeGates: [] };
    const enemy = (x = 0, z = 5): EnemySimulationState => ({ id: 1, type: 'tier3', x, z, hp: 3000 });
    const heavy = (id: number): ProjectileSimulationState => ({ id, kind: 'heavyRifle', x: 0,
      z: 0, speed: 20, damage: 300, remainingRange: 40, blastRadius: 0, penetrationRemaining: 10 });
    const setup = (count: number, target: EnemySimulationState, projectiles: ProjectileSimulationState[] = []) => {
      const sim = new Simulation({ seed: 1, level: emptyLevel, startSquad: count, startRocketCount: 0,
        gruntHp: 3, bruteHp: 300, tier3Hp: 3000 });
      const state = sim.getState();
      state.enemies = [target];
      state.projectiles = projectiles;
      state.weapons.nextProjectileId = projectiles.length + 1;
      state.weapons.rifleCooldownRemainingSeconds = 100;
      sim.restoreState(state);
      return sim;
    };
    const one = setup(1, enemy(), [heavy(1)]);
    const withBehind = one.getState();
    withBehind.enemies.push({ id: 2, type: 'grunt', x: 0, z: 7, hp: 3 });
    one.restoreState(withBehind);
    one.step(0.5, { targetX: 0 }, tuning);
    expect(one.getState().enemies[0].hp).toBe(2700);
    expect(one.getState().enemies[1].hp).toBe(3);
    expect(one.getState().projectiles).toHaveLength(0);
    const rifle = setup(1, enemy(), [{ ...heavy(1), kind: 'rifle', damage: 3, penetrationRemaining: 0 }]);
    rifle.step(0.5, { targetX: 0 }, tuning);
    expect(rifle.getState().enemies[0].hp).toBe(2997);
    const ten = setup(1, enemy(), Array.from({ length: 10 }, (_, index) => heavy(index + 1)));
    ten.step(0.5, { targetX: 0 }, tuning);
    expect(ten.getState().enemies).toEqual([]);
    const contact = setup(10, enemy(0, 1));
    contact.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 2, defenseLineOffset: 100 });
    expect(contact.getState().squad.count).toBe(0);
    const breach = setup(10, enemy(2, 1));
    breach.step(1, { targetX: 0 }, { ...tuning, forwardSpeed: 3 });
    expect(breach.getState().squad.count).toBe(0);
  });
});
