import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { attackLanePositions, laneCompositionForRow, laneWave, rewardLaneXForRow } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';

const config = GameConfigSchema.parse(gameData);
// The first experiment's dormant path is still supported; defense has its own suite.
const balance = { ...config.catharsis!, defenseMode: false, groupSize: 4, waveRows: 12,
  gruntSpeed: .8, heavySpeed: .3, heavyHp: 5 };
const level = LevelDefinitionSchema.parse(levelData);
const isolated = { id: 'lane-test', length: 1000, enemyGroups: [], upgradeGates: [] };
const make = (stream = false, seed = 17) => new Simulation({ seed, level: stream ? level : isolated,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance, trackHalfWidth: config.track.halfWidth } });
const tuning = { moveSpeed: 5, forwardSpeed: 0, trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3,
  bossRadius: 2, rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket } };

describe('Catharsis lane experiment', () => {
  it('reproduces compositions without consuming gameplay RNG and varies with seed', () => {
    const rows = (seed: number) => Array.from({ length: 240 }, (_, row) =>
      laneCompositionForRow(row, seed, balance, config.track.halfWidth));
    expect(rows(17)).toEqual(rows(17));
    expect(rows(18)).not.toEqual(rows(17));
    expect(make(true).getState().rngState).toBe(17);
    expect(make(true).getState()).toEqual(make(true).getState());
    expect(make(true, 18).getState().enemies).not.toEqual(make(true).getState().enemies);
    expect(make(true).getState().enemies.length).toBeLessThan(80);
  });

  it('has one/two priority lanes, quiet corridors, sparse Heavies and no full-width rows', () => {
    const waves = Array.from({ length: 100 }, (_, wave) => laneWave(wave, 17, balance));
    expect(waves.some((wave) => wave.lanes.length === 1)).toBe(true);
    expect(waves.some((wave) => wave.lanes.length === 2)).toBe(true);
    expect(waves.some((wave) => wave.heavy)).toBe(true);
    expect(waves.some((wave) => !wave.heavy)).toBe(true);
    expect(waves[0].lanes).toEqual(waves[1].lanes);
    expect(waves[1].lanes).toEqual(waves[2].lanes);
    for (const wave of waves) expect(wave.lanes).not.toContain(wave.rewardLane);
    for (let wave = 0; wave < 100; wave++) {
      const entries = Array.from({ length: balance.waveRows }, (_, row) =>
        laneCompositionForRow(wave * balance.waveRows + row, 17, balance, 3.2)).flat();
      expect(entries).toHaveLength(balance.groupSize);
      expect(new Set(entries.map((entry) => entry.x)).size).toBeLessThanOrEqual(2);
      expect(entries.filter((entry) => entry.archetype === 'heavy').length).toBeLessThanOrEqual(1);
    }
  });

  it.each([3, 4, 5])('keeps %i lanes and enemies within track bounds', (laneCount) => {
    const lanes = attackLanePositions(laneCount, 3.2, balance.edgeInset);
    expect(lanes).toHaveLength(laneCount);
    expect(new Set(lanes).size).toBe(laneCount);
    for (const x of lanes) expect(Math.abs(x) + tuning.normalEnemyRadius).toBeLessThanOrEqual(3.2);
    for (let row = 0; row < 200; row++) {
      for (const enemy of laneCompositionForRow(row, 17, { ...balance, laneCount }, 3.2))
        expect(lanes).toContain(enemy.x);
    }
  });

  it('rejects invalid balance and lane bounds', () => {
    expect(() => attackLanePositions(5, .2, .4)).toThrow();
    expect(() => CatharsisConfigSchema.parse({ ...balance, groupSize: 10 })).toThrow();
    expect(() => CatharsisConfigSchema.parse({ ...balance, heavyChance: 2 })).toThrow();
    expect(() => make().restoreState({ ...make().getState(), catharsis: { balance, trackHalfWidth: .2 } })).toThrow();
  });

  it('spawns Grunts with exactly 1 HP at every retained color tier', () => {
    const simulation = make(true);
    expect(simulation.getState().enemies.filter((enemy) => enemy.archetype === 'grunt').every((enemy) => enemy.hp === 1)).toBe(true);
    simulation.setRuntimeBalance({ rewardRowsPerReward: 7, enemyHigherTierPowerMultiplier: 20,
      rifleHigherTierPowerMultiplier: 10 });
    expect(simulation.getState().enemies.filter((enemy) => enemy.archetype === 'grunt').every((enemy) => enemy.hp === 1)).toBe(true);
  });

  it.each([['grunt', 1], ['heavy', 5]] as const)('%s takes %i normal Tier-1 rifle hits', (archetype, hits) => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies = [{ id: 1, tier: 1, x: 0, z: 3, hp: hits, archetype }];
    simulation.restoreState(state);
    for (let hit = 1; hit <= hits; hit++) {
      const next = simulation.getState();
      next.weapons.rifleCooldownRemainingSeconds = 0;
      simulation.restoreState(next);
      simulation.step(.06, { targetX: 0 }, { ...tuning, rifle: { ...tuning.rifle, fireRate: .01 } });
      if (hit < hits) expect(simulation.getState().enemies[0].hp).toBe(hits - hit);
      else expect(simulation.getState().enemies).toHaveLength(0);
    }
  });

  it('moves Grunts faster than Heavies and applies live HP tuning by health fraction', () => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', hp: 1, x: 2.8, z: 10 },
      { id: 2, tier: 1, archetype: 'heavy', hp: 3, x: -2.8, z: 10 }];
    simulation.restoreState(state);
    simulation.setCatharsisBalance({ ...balance, heavyHp: 10 });
    expect(simulation.getState().enemies[1].hp).toBe(6);
    simulation.step(.1, { targetX: 0 }, tuning);
    const enemies = simulation.getState().enemies;
    expect(enemies[0].z).toBeCloseTo(9.92);
    expect(enemies[1].z).toBeCloseTo(9.97);
  });

  it('full drag / hold steering aligns fire with the outer lane', () => {
    const simulation = make();
    simulation.step(1, { targetX: 3.2 }, tuning);
    expect(simulation.getState().player.x).toBeCloseTo(2.8);
    expect(simulation.getState().projectiles.every((projectile) => Math.abs(projectile.x - 2.8) < .001)).toBe(true);
  });

  it('requires squad alignment before an incidental wide-formation shot can progress a reward', () => {
    const simulation = make(true);
    const state = simulation.getState();
    state.enemies = [];
    state.enemyStream!.nextRewardId = 2;
    state.streamRewards = [{ id: 1, tier: 1, x: 2.8, z: 3, hitProgress: 0, hitsRequired: 10 }];
    const shoot = (playerX: number) => {
      const next = simulation.getState();
      next.player.x = playerX;
      next.projectiles = [{ id: next.weapons.nextProjectileId++, kind: 'rifle', tier: 1,
        x: 2.8, z: 0, damage: 3, speed: 60, remainingRange: 80, blastRadius: 0,
        hitRadiusBonus: 0, penetrationRemaining: 0 }];
      next.weapons.rifleCooldownRemainingSeconds = 10;
      simulation.restoreState(next);
      simulation.step(.06, { targetX: playerX }, tuning);
    };
    simulation.restoreState(state);
    shoot(0);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(0);
    shoot(2.8);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(1);
  });

  it.each([3, 4, 5])('places rewards away from the currently defended corridor with %i lanes', (laneCount) => {
    const selected = { ...balance, laneCount };
    const lanes = attackLanePositions(laneCount, 3.2, selected.edgeInset);
    for (let row = 0; row < 100; row++) {
      for (const playerX of lanes) {
        const x = rewardLaneXForRow(row, 17, selected, 3.2, playerX);
        expect(lanes).toContain(x);
        expect(Math.abs(x - playerX)).toBeGreaterThan(selected.rewardAimRadius);
        expect(rewardLaneXForRow(row, 17, selected, 3.2, playerX)).toBe(x);
      }
    }
  });

  it('restores JSON balance, archetypes, stream cursors and future deterministic spawning', () => {
    const original = make(true);
    original.setCatharsisBalance({ ...balance, heavyHp: 8, gruntSpeed: .6 });
    original.setRuntimeBalance({ rewardRowsPerReward: 8, enemyHigherTierPowerMultiplier: 10,
      rifleHigherTierPowerMultiplier: 10 });
    const snapshot = JSON.parse(JSON.stringify(original.getState()));
    const restored = make(true, 123);
    restored.restoreState(snapshot);
    const copied = original.getState();
    copied.catharsis!.balance.heavyHp = 100;
    expect(original.getState().catharsis!.balance.heavyHp).toBe(8);
    for (let tick = 0; tick < 600; tick++) {
      const live = { ...tuning, forwardSpeed: 2 };
      original.step(1 / 60, { targetX: 2.8 }, live);
      restored.step(1 / 60, { targetX: 2.8 }, live);
    }
    expect(restored.getState()).toEqual(original.getState());
    const projected = projectRenderState(restored.getFrameState(), { formationSpacing: .45,
      trackHalfWidth: 3.2, defenseLineOffset: 1.5, bossVisualScale: 7, catharsis: restored.getFrameState().catharsis });
    expect(projected.track.lanePositions).toHaveLength(5);
    expect(projected.enemies.every((enemy) => enemy.visualScale ===
      balance.enemyVisualScale * (enemy.archetype === 'heavy' ? balance.heavyVisualScale : 1))).toBe(true);
  });

  it('retains Boss showdown pause, snapshot restore and normal power damage', () => {
    const bossLevel = LevelDefinitionSchema.parse({ ...level, enemyStream: { ...level.enemyStream!, spawnAheadDistance: 116 } });
    const simulation = new Simulation({ seed: 17, level: bossLevel, startSquad: 1,
      startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
    const state = simulation.getState();
    state.player.z = state.boss!.z;
    state.boss!.engaged = true;
    state.boss!.slamCooldownRemainingSeconds = .6;
    state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', x: 2.8, z: state.player.z + 5, hp: 1 }];
    state.streamRewards = [];
    simulation.restoreState(JSON.parse(JSON.stringify(state)));
    simulation.step(.01, { targetX: 0 }, { ...tuning, forwardSpeed: 2 });
    const after = simulation.getState();
    expect(after.player.z).toBe(state.player.z);
    expect(after.enemies[0].z).toBe(state.enemies[0].z);
    expect(after.enemyStream).toEqual(state.enemyStream);
    expect(after.boss!.hp).toBe(state.boss!.hp - config.tiers.tier1Power);
    expect(after.boss!.slamCooldownRemainingSeconds).toBeCloseTo(.59);
    simulation.restoreState(JSON.parse(JSON.stringify(after)));
    expect(simulation.getState()).toEqual(after);
  });
});
