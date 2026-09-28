import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOSS_CAMERA_RETURN_MS, BossCameraFraming } from '../src/rendering/boss/BossCameraFraming';
import { BOSS_DEATH_FADE_START_MS, BOSS_DEATH_FALL_START_MS,
  BOSS_DEATH_IMPACT_MS, BOSS_DEATH_MS } from '../src/presentation/BossDeathTiming';

const boss = { id: 1, tier: 1, x: 0, z: 8, hp: 100, maxHp: 100,
  visualScale: 7, engaged: true, slamCooldownRemainingSeconds: 1, slamCount: 0 };

describe('Boss camera handoff', () => {
  it('holds maximum Boss framing until the corpse disappears, then eases to normal', () => {
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    const framing = new BossCameraFraming();
    expect(framing.update(camera, null, 0, 0)).toBe(0);
    expect(camera.position.y).toBe(6.5);
    expect(camera.position.z).toBe(-10);
    const live = framing.update(camera, { ...boss, z: 2 }, 0, 1000);
    expect(live).toBe(1);
    const liveY = camera.position.y;
    const liveZ = camera.position.z;
    const liveOrientation = camera.quaternion.clone();
    expect(framing.update(camera, null, 0, 1016)).toBeCloseTo(live);
    expect(camera.position.y).toBeCloseTo(liveY);
    expect(camera.position.z).toBeCloseTo(liveZ);
    expect(camera.quaternion.angleTo(liveOrientation)).toBeCloseTo(0);
    for (const elapsed of [150, 450, BOSS_DEATH_FALL_START_MS, 850,
      BOSS_DEATH_IMPACT_MS, BOSS_DEATH_FADE_START_MS, 1600, BOSS_DEATH_MS]) {
      expect(framing.update(camera, null, 0, 1016 + elapsed)).toBeCloseTo(live);
      expect(camera.position.y).toBeCloseTo(liveY);
      expect(camera.position.z).toBeCloseTo(liveZ);
    }
    const initial = framing.update(camera, null, 0, 1016 + BOSS_DEATH_MS + 100);
    expect(initial).toBeGreaterThan(0.999);
    expect(Math.abs(camera.position.z - liveZ)).toBeLessThan(0.01);
    const weights = [1000, 3000, 5900].map(elapsed =>
      framing.update(camera, null, 0, 1016 + BOSS_DEATH_MS + elapsed));
    expect(weights[0]).toBeGreaterThan(0.9);
    expect(weights[0]).toBeGreaterThan(weights[1]);
    expect(weights[1]).toBeCloseTo(0.5);
    expect(weights[1]).toBeGreaterThan(weights[2]);
    expect(weights[2]).toBeGreaterThan(0);
    expect(weights[2]).toBeLessThan(0.001);
    expect(framing.update(camera, null, 0, 1016 + BOSS_DEATH_MS + BOSS_CAMERA_RETURN_MS))
      .toBe(0);
    expect(camera.position.y).toBeCloseTo(6.5);
    expect(camera.position.z).toBeCloseTo(-10);
    expect(framing.update(camera, null, 0, 1016 + BOSS_DEATH_MS
      + BOSS_CAMERA_RETURN_MS + 1000)).toBe(0);
  });

  it('limits the framing-only camera movement on every 60 FPS return frame', () => {
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    const framing = new BossCameraFraming();
    expect(framing.update(camera, { ...boss, z: 2 }, 0, 1000)).toBe(1);
    const deathStart = 1016;
    framing.update(camera, null, 0, deathStart);
    framing.update(camera, null, 0, deathStart + BOSS_DEATH_MS);
    let previousY = camera.position.y;
    let previousZ = camera.position.z;
    let maxYDelta = 0;
    let maxZDelta = 0;
    const frameCount = Math.ceil(BOSS_CAMERA_RETURN_MS / (1000 / 60));
    for (let frame = 1; frame <= frameCount; frame++) {
      const elapsed = Math.min(BOSS_CAMERA_RETURN_MS, frame * 1000 / 60);
      framing.update(camera, null, 0, deathStart + BOSS_DEATH_MS + elapsed);
      maxYDelta = Math.max(maxYDelta, Math.abs(camera.position.y - previousY));
      maxZDelta = Math.max(maxZDelta, Math.abs(camera.position.z - previousZ));
      previousY = camera.position.y;
      previousZ = camera.position.z;
    }
    expect(maxYDelta).toBeLessThanOrEqual(0.02);
    expect(maxZDelta).toBeLessThanOrEqual(0.05);
  });

  it('uses the same death hold for a farther Boss while following player progression', () => {
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    const framing = new BossCameraFraming();
    const live = framing.update(camera, { ...boss, z: 18 }, 0, 1000);
    expect(live).toBeGreaterThan(0);
    expect(live).toBeLessThan(1);
    expect(framing.update(camera, null, 0, 1016)).toBeCloseTo(live);
    expect(framing.update(camera, null, 5, 1016 + BOSS_DEATH_MS)).toBeCloseTo(live);
    expect(camera.position.z).toBeCloseTo(5 - (10 + 8 * live));
    const returning = framing.update(camera, null, 6, 1016 + BOSS_DEATH_MS + 500);
    expect(returning).toBeGreaterThan(0);
    expect(returning).toBeLessThan(live);
    expect(framing.update(camera, null, 7,
      1016 + BOSS_DEATH_MS + BOSS_CAMERA_RETURN_MS)).toBe(0);
    expect(camera.position.z).toBeCloseTo(-3);
  });

  it('clears death framing on Retry and starts a later Boss from its own distance', () => {
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    const framing = new BossCameraFraming();
    framing.update(camera, boss, 0, 0);
    framing.update(camera, null, 0, 20);
    framing.reset();
    expect(framing.update(camera, null, 30, 40)).toBe(0);
    expect(camera.position.z).toBe(20);
    expect(framing.update(camera, { ...boss, id: 2, z: 100 }, 30, 50)).toBe(0);
    expect(camera.position.y).toBe(6.5);
    expect(framing.update(camera, { ...boss, id: 2, z: 38 }, 30, 100))
      .toBeGreaterThan(0);
    framing.update(camera, null, 30, 120);
    expect(framing.update(camera, null, 30, 120 + BOSS_DEATH_MS + 300))
      .toBeGreaterThan(0);
    expect(framing.update(camera, { ...boss, id: 3, z: 120 }, 30,
      120 + BOSS_DEATH_MS + 320)).toBe(0);
    expect(camera.position.y).toBe(6.5);
  });
});
