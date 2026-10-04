import { expect, it } from 'vitest';
import { CROWD_DEATH_STYLES, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
import { GIANT_DEATH_MS } from '../src/presentation/GiantDrama';
it('orders threat death clocks and pales both roles without emissive flash', () => {
  const { grunt, heavy } = CROWD_DEATH_STYLES;
  expect(grunt.totalMs).toBe(300); expect(heavy.totalMs).toBe(700);
  expect(grunt.totalMs).toBeLessThan(heavy.totalMs); expect(heavy.totalMs).toBeLessThan(GIANT_DEATH_MS);
  expect(grunt.mode).toBe('vaporize'); expect(heavy.mode).toBe('shatter');
  expect(enemyDeathPose(80,grunt).pale).toBe(1);
  expect(enemyDeathPose(80,grunt).opacity).toBe(1);
  expect(enemyDeathPose(180,grunt).opacity).toBeLessThan(1);
  expect(enemyDeathPose(180,grunt).rise).toBeLessThan(.15);
  expect(enemyDeathPose(300,grunt).bodyVisible).toBe(false);
  expect(enemyDeathPose(99,heavy).bodyVisible).toBe(true);
  expect(enemyDeathPose(100,heavy).bodyVisible).toBe(false);
  expect(enemyDeathPose(100,heavy).rise).toBe(0);
});
