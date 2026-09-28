import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BossCameraFraming } from '../src/rendering/boss/BossCameraFraming';
import { BOSS_DEATH_FALL_MS, BOSS_DEATH_MS } from '../src/rendering/boss/BossRenderer';

const boss = { id: 1, tier: 1, x: 0, z: 8, hp: 100, maxHp: 100,
  visualScale: 7, engaged: true, slamCooldownRemainingSeconds: 1, slamCount: 0 };

describe('Boss camera handoff', () => {
  it('holds the final Boss perspective through impact, then eases to normal', () => {
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    const framing = new BossCameraFraming();
    expect(framing.update(camera, null, 0, 0)).toBe(0);
    expect(camera.position.y).toBe(6.5);
    expect(camera.position.z).toBe(-10);
    const live = framing.update(camera, boss, 0, 1000);
    expect(live).toBeGreaterThan(0);
    const liveY = camera.position.y;
    const liveZ = camera.position.z;
    const liveOrientation = camera.quaternion.clone();
    expect(framing.update(camera, null, 0, 1016)).toBeCloseTo(live);
    expect(camera.position.y).toBeCloseTo(liveY);
    expect(camera.position.z).toBeCloseTo(liveZ);
    expect(camera.quaternion.angleTo(liveOrientation)).toBeCloseTo(0);
    expect(framing.update(camera, null, 0, 1016 + BOSS_DEATH_FALL_MS))
      .toBeCloseTo(live);
    const middle = framing.update(camera, null, 0, 1016 + 1000);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(live);
    expect(camera.position.y).toBeLessThan(liveY);
    expect(camera.position.z).toBeGreaterThan(liveZ);
    const late = framing.update(camera, null, 0, 1016 + 1500);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(middle);
    expect(framing.update(camera, null, 0, 1016 + BOSS_DEATH_MS)).toBe(0);
    expect(camera.position.y).toBeCloseTo(6.5);
    expect(camera.position.z).toBeCloseTo(-10);
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
    expect(framing.update(camera, { ...boss, id: 3, z: 120 }, 30, 140)).toBe(0);
    expect(camera.position.y).toBe(6.5);
  });
});
