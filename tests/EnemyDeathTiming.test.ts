import { expect, it } from 'vitest';
import { ENEMY_DEATH_MS, ENEMY_SHATTER_MS, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';

it('pales a planted toy then hides it at shatter, without rising or ghost fading', () => {
  expect(ENEMY_DEATH_MS).toBe(390); expect(ENEMY_SHATTER_MS).toBe(110);
  expect(enemyDeathPose(0)).toEqual({ progress: 0, pale: 0, bodyVisible: true, squash: 0 });
  expect(enemyDeathPose(80).pale).toBe(1);
  expect(enemyDeathPose(109).bodyVisible).toBe(true);
  expect(enemyDeathPose(110).bodyVisible).toBe(false);
  for (let age = 0; age <= 390; age += 10) {
    const pose = enemyDeathPose(age);
    expect(pose).not.toHaveProperty('rise'); expect(pose).not.toHaveProperty('opacity');
    expect(pose.squash).toBeGreaterThanOrEqual(0); expect(pose.squash).toBeLessThanOrEqual(.035);
    expect(pose.pale).toBeGreaterThanOrEqual(enemyDeathPose(age - 10).pale);
  }
  expect(enemyDeathPose(1000)).toEqual(enemyDeathPose(390));
});
