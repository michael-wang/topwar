import { expect, it } from 'vitest';
import { ENEMY_DEATH_MS, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';

it('vaporizes with a low pop, bounded rise and pronounced shrink during a short fade', () => {
  expect(ENEMY_DEATH_MS).toBe(480);
  expect(enemyDeathPose(0)).toEqual({ progress: 0, rise: .12, opacity: 1, scale: 1.07 });
  expect(enemyDeathPose(120).opacity).toBe(1);
  expect(enemyDeathPose(240).opacity).toBeCloseTo(2 / 3);
  expect(enemyDeathPose(240).scale).toBeCloseTo(.81);
  expect(enemyDeathPose(480).opacity).toBe(0);
  expect(enemyDeathPose(480).scale).toBeCloseTo(.55);
  for (let age = 0; age <= 480; age += 10) {
    const pose = enemyDeathPose(age);
    expect(pose.rise).toBeGreaterThanOrEqual(.12);
    expect(pose.rise).toBeLessThanOrEqual(.72);
    expect(pose.opacity).toBeLessThanOrEqual(enemyDeathPose(age - 10).opacity);
    expect(pose.scale).toBeLessThanOrEqual(enemyDeathPose(age - 10).scale);
  }
  expect(enemyDeathPose(-50)).toEqual(enemyDeathPose(0));
  expect(enemyDeathPose(1000)).toEqual(enemyDeathPose(480));
});
