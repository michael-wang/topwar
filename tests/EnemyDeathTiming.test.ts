import { expect, it } from 'vitest';
import { ENEMY_DEATH_MS, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';

it('pops and rises above normal heads before fading without an unbounded lifetime', () => {
  expect(ENEMY_DEATH_MS).toBe(600);
  expect(enemyDeathPose(0)).toEqual({ progress: 0, rise: .25, opacity: 1 });
  expect(enemyDeathPose(180).opacity).toBe(1);
  expect(enemyDeathPose(300).rise).toBeGreaterThan(1.4);
  expect(enemyDeathPose(300).opacity).toBeGreaterThan(.7);
  expect(enemyDeathPose(600)).toEqual({ progress: 1, rise: 1.9, opacity: 0 });
  expect(enemyDeathPose(-50)).toEqual(enemyDeathPose(0));
  expect(enemyDeathPose(1000)).toEqual(enemyDeathPose(600));
});
