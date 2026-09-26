import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { highestIntroducedTierForRow } from '../src/simulation/tiers/tierRules';

const config = GameConfigSchema.parse(configData);
const level = LevelDefinitionSchema.parse(levelData);
const stream = level.enemyStream!;

describe('accelerated long run diagnostic', () => {
  it('keeps ordinary live counts bounded and stays frozen after an unassisted loss', () => {
    const simulation = new Simulation({ seed: 17, level, startSquad: config.player.startSquad,
      startRocketCount: config.player.startRocketCount, tiers: config.tiers });
    const tuning = { moveSpeed: config.player.moveSpeed, forwardSpeed: config.player.forwardSpeed,
      trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset,
      formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
      normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
      rifle: config.weapon.rifle, rocket: config.weapon.rocket };
    let peakEnemies = 0;
    let peakRewards = 0;
    let peakProjectiles = 0;
    for (let tick = 0; tick < 2000; tick++) {
      simulation.step(0.2, { targetX: 0 }, tuning);
      const state = simulation.getState();
      peakEnemies = Math.max(peakEnemies, state.enemies.length);
      peakRewards = Math.max(peakRewards, state.streamRewards.length);
      peakProjectiles = Math.max(peakProjectiles, state.projectiles.length);
      if (state.squad.count === 0) break;
    }
    const ended = simulation.getState();
    expect(ended.squad.count).toBe(0);
    expect(peakEnemies).toBeLessThan(1400);
    expect(peakRewards).toBeLessThan(20);
    expect(peakProjectiles).toBeLessThan(100);
    for (let tick = 0; tick < 2000; tick++) simulation.step(0.2, { targetX: 0 }, tuning);
    expect(simulation.getState()).toEqual(ended);
  });
  it('measures dense penetrating fire near enemy level 14', () => {
    const simulation = new Simulation({ seed: 17, level, startSquad: 1,
      startRocketCount: 0, tiers: config.tiers });
    const tuning = { moveSpeed: 100, forwardSpeed: 45, trackHalfWidth: 3,
      defenseLineOffset: config.track.defenseLineOffset,
      formationSpacing: config.player.formationSpacing,
      memberRadius: config.player.memberRadius, normalEnemyRadius: config.tiers.normalEnemyRadius,
      bossRadius: config.bosses.basic.radius,
      rifle: { ...config.weapon.rifle, fireRate: 0.01 }, rocket: config.weapon.rocket };
    while (true) {
      const before = simulation.getState();
      before.squad = { count: 1, rocketCount: 0, rifleCounts: Array(23).fill(0).concat(1), rifleRemainder: 0 };
      before.boss = null;
      simulation.restoreState(before);
      simulation.step(0.2, { targetX: 3 }, tuning);
      const current = simulation.getState();
      const row = Math.max(0, Math.floor((current.player.z - stream.startZ) / stream.spacing));
      if (highestIntroducedTierForRow(row, stream.tierProgression) >= 14) break;
    }
    const state = simulation.getState();
    state.player.x = 0;
    state.squad = { count: 9, rocketCount: 0, rifleCounts: Array(15).fill(0).concat(9), rifleRemainder: 0 };
    state.projectiles = [];
    state.boss = null;
    state.enemies = state.enemies.filter((enemy) => enemy.z > state.player.z + 1);
    simulation.restoreState(state);
    const fast = { ...tuning, forwardSpeed: 0, rifle: { ...config.weapon.rifle } };
    const samples: number[] = [];
    for (let index = 0; index < 50; index++) {
      const beforeStep = performance.now();
      simulation.step(0.2, { targetX: 0 }, fast);
      samples.push(performance.now() - beforeStep);
      const next = simulation.getState();
      if (next.squad.count === 0) break;
    }
    const after = simulation.getState();
    console.log(JSON.stringify({ collisionProfile: true, steps: samples.length,
      medianMs: samples.sort((a,b)=>a-b)[Math.floor(samples.length/2)],
      maxMs: Math.max(...samples), enemies: after.enemies.length,
      projectiles: after.projectiles.length, squad: after.squad.count }));
  });
  it('records stream and fixed-step behavior through enemy level 20', () => {
    const simulation = new Simulation({ seed: 17, level, startSquad: 1,
      startRocketCount: 0, tiers: config.tiers });
    const tuning = { moveSpeed: 100, forwardSpeed: 45, trackHalfWidth: 3,
      defenseLineOffset: config.track.defenseLineOffset,
      formationSpacing: config.player.formationSpacing,
      memberRadius: config.player.memberRadius, normalEnemyRadius: config.tiers.normalEnemyRadius,
      bossRadius: config.bosses.basic.radius,
      rifle: { ...config.weapon.rifle, fireRate: 0.01 }, rocket: config.weapon.rocket };
    let previousTier = 0;
    let slowestMs = 0;
    const bossesSeen = new Set<number>();
    for (let index = 0; index < 300; index++) {
      const before = simulation.getState();
      // Keep this diagnostic runner alive while measuring the generated stream.
      before.squad = { count: 1, rocketCount: 0, rifleCounts: Array(23).fill(0).concat(1), rifleRemainder: 0 };
      before.boss = null;
      simulation.restoreState(before);
      const started = performance.now();
      simulation.step(0.2, { targetX: 3 }, tuning);
      slowestMs = Math.max(slowestMs, performance.now() - started);
      const state = simulation.getState();
      if (state.boss) bossesSeen.add(state.boss.tier);
      const row = Math.max(0, Math.floor((state.player.z - stream.startZ) / stream.spacing));
      const tier = highestIntroducedTierForRow(row, stream.tierProgression);
      if (tier > previousTier) {
        const active = state.squad.rifleCounts.flatMap((count, index) => count ? [[index + 1, count]] : []);
        console.log(JSON.stringify({ row, tier, squad: active,
          enemies: state.enemies.length, projectiles: state.projectiles.length,
          rewards: state.streamRewards.length, boss: state.boss?.tier ?? null,
          slowestMs: Number(slowestMs.toFixed(1)) }));
        previousTier = tier;
      }
      expect(state.squad.count).toBeGreaterThan(0);
      expect(state.enemies.length).toBeLessThan(1400);
      expect(state.streamRewards.length).toBeLessThan(20);
      expect(state.projectiles.length).toBeLessThan(100);
      if (tier >= 20) {
        expect(bossesSeen.size).toBeGreaterThanOrEqual(18);
        console.log(JSON.stringify({ completedTier: tier, bossesSeen: [...bossesSeen],
          maxStepMs: Number(slowestMs.toFixed(1)) }));
        return;
      }
    }
    throw new Error(`Only reached tier ${previousTier}`);
  });
});
