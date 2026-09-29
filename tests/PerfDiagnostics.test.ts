import { describe, expect, it } from 'vitest';
import { PerfDiagnostics, RollingMetric, perfEnabled } from '../src/app/PerfDiagnostics';
import { rendererInfoSnapshot } from '../src/rendering/GameRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import * as THREE from 'three';
import { Simulation } from '../src/simulation/Simulation';
import configData from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import type { LevelDefinition } from '../src/level/LevelDefinition';

const config = GameConfigSchema.parse(configData);
const level: LevelDefinition = { id: 'perf', length: 1000, enemyGroups: [], upgradeGates: [] };

describe('opt-in performance diagnostics', () => {
  it('enables only for perf=1 and bounds rolling values with correct average/p95', () => {
    expect(perfEnabled('')).toBe(false);
    expect(perfEnabled('?perf=0')).toBe(false);
    expect(perfEnabled('?perf=1')).toBe(true);
    const metric = new RollingMetric(4);
    for (const value of [1, 2, 3, 4, 10]) metric.add(value);
    expect(metric.count).toBe(4);
    expect(metric.capacity).toBe(4);
    expect(metric.average()).toBe(4.75);
    expect(metric.p95()).toBe(10);
    metric.reset();
    expect(metric.count).toBe(0);
  });

  it('tracks and resets session high-water values and collision counts', () => {
    const perf = new PerfDiagnostics();
    perf.counters.enemyCandidateChecks = 12;
    perf.record(16, 2, 3, 1,
      { enemies: 10, projectiles: 7, drawCalls: 30, triangles: 400,
        projectilePool: 8 });
    perf.record(20, 4, 5, 2,
      { enemies: 5, projectiles: 9, drawCalls: 20, triangles: 500,
        projectilePool: 9 });
    expect(perf.highWater).toEqual({ enemies: 10, projectiles: 9, drawCalls: 30,
      triangles: 500, projectilePool: 9 });
    perf.beginFrame();
    expect(perf.counters.enemyCandidateChecks).toBe(0);
    perf.reset();
    expect(perf.frame.count).toBe(0);
    expect(perf.highWater.enemies).toBe(0);
    expect(perf.highWater.projectilePool).toBe(0);
  });

  it('tracks current, rolling, and maximum steps without sampling paused frames', () => {
    const perf = new PerfDiagnostics();
    for (const steps of [1, 2, 4]) {
      perf.beginFrame();
      perf.recordSteps(steps);
    }
    expect(perf.currentSteps).toBe(4);
    expect(perf.steps.average()).toBeCloseTo(7 / 3);
    expect(perf.maxSteps).toBe(4);
    perf.beginFrame(); // A paused frame has no FixedStepLoop.advance call.
    expect(perf.currentSteps).toBe(0);
    expect(perf.steps.count).toBe(3);
    expect(perf.steps.average()).toBeCloseTo(7 / 3);
    perf.reset();
    expect(perf.currentSteps).toBe(0);
    expect(perf.steps.count).toBe(0);
    expect(perf.maxSteps).toBe(0);
  });

  it('tracks and resets separate step, state, and mapping CPU averages', () => {
    const perf = new PerfDiagnostics();
    perf.recordCpuBreakdown(2, .2, .4);
    perf.recordCpuBreakdown(6, .4, .8);
    expect(perf.stepCpu.average()).toBe(4);
    expect(perf.stateCpu.average()).toBeCloseTo(.3);
    expect(perf.mapCpu.average()).toBeCloseTo(.6);
    perf.reset();
    expect(perf.stepCpu.count).toBe(0);
    expect(perf.stateCpu.count).toBe(0);
    expect(perf.mapCpu.count).toBe(0);
  });

  it('maps renderer.info without modifying it', () => {
    const info = { render: { calls: 42, triangles: 1234 },
      memory: { geometries: 9, textures: 3 } };
    const before = JSON.stringify(info);
    expect(rendererInfoSnapshot(info as never, 3, 2, { width: 800, height: 1600 }))
      .toEqual({ drawCalls: 42, triangles: 1234, geometries: 9, textures: 3,
        devicePixelRatio: 3, rendererPixelRatio: 2, bufferWidth: 800,
        bufferHeight: 1600 });
    expect(JSON.stringify(info)).toBe(before);
  });

  it('keeps renderer getters read-only', () => {
    const scene = new THREE.Scene();
    const bullet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const renderer = new ProjectileRenderer(scene, bullet);
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 0, hitRadiusBonus: 0 }], 0);
    const children = scene.children.length;
    expect(renderer.getDebugStats()).toEqual({ live: 1, pool: 8, pulseTrackers: 1 });
    expect(renderer.getDebugStats()).toEqual({ live: 1, pool: 8, pulseTrackers: 1 });
    expect(scene.children.length).toBe(children);
    renderer.dispose();
    bullet.geometry.dispose();
    (bullet.material as THREE.Material).dispose();
  });

  it('does not serialize or change gameplay when collision counting is enabled', () => {
    const counters = { findFirstHitCalls: 0, enemyCandidateChecks: 0,
      projectilePasses: 0, penetrationPasses: 0 };
    const make = (enabled: boolean) => new Simulation({ seed: 7, level,
      startSquad: 1, startRocketCount: 0, tiers: config.tiers,
      collisionDiagnostics: enabled ? counters : undefined });
    const normal = make(false);
    const measured = make(true);
    const state = normal.getState();
    state.enemies.push({ id: 1, tier: 1, x: 0, z: 3, hp: 10 });
    normal.restoreState(state);
    measured.restoreState(state);
    const tuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3,
      defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22,
      normalEnemyRadius: .3, rifle: { ...config.weapon.rifle },
      rocket: { ...config.weapon.rocket } };
    for (let i = 0; i < 5; i++) {
      normal.step(1 / 60, { targetX: 0 }, tuning);
      measured.step(1 / 60, { targetX: 0 }, tuning);
    }
    expect(counters.findFirstHitCalls).toBeGreaterThan(0);
    expect(counters.enemyCandidateChecks).toBeGreaterThan(0);
    expect(measured.getState()).toEqual(normal.getState());
    expect(JSON.stringify(measured.getState())).not.toContain('enemyCandidateChecks');
  });
});
