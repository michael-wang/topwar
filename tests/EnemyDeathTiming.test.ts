import { expect, it } from 'vitest';
import { ENEMY_DEATH_DURATION_MS, ENEMY_DEATH_GRAY, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
it('shares normalized fall/gray/fade curves, differing only by threat duration', () => {
  const {grunt,heavy,giant}=ENEMY_DEATH_DURATION_MS;
  expect(grunt).toBeGreaterThanOrEqual(400);expect(grunt).toBeLessThanOrEqual(450);
  expect(heavy).toBeGreaterThanOrEqual(700);expect(heavy).toBeLessThanOrEqual(800);
  expect(giant).toBeGreaterThanOrEqual(1300);expect(giant).toBeLessThanOrEqual(1600);
  expect(grunt).toBeLessThan(heavy);expect(heavy).toBeLessThan(giant);
  for(const p of [0,.1,.25,.38,.45,.5,.65,.75,1]) {
    const a=enemyDeathPose(grunt*p,grunt);
    for(const total of [heavy,giant]) {
      const b=enemyDeathPose(total*p,total);
      expect(b.fall).toBeCloseTo(a.fall);expect(b.gray).toBeCloseTo(a.gray);expect(b.opacity).toBeCloseTo(a.opacity);
      expect(b.bodyVisible).toBe(a.bodyVisible);
    }
  }
});
it('falls in authored color first, settles before the late gray/fade, and never rises/shrinks', () => {
  expect(ENEMY_DEATH_GRAY).toBe('#aeb5b3');
  expect(enemyDeathPose(0,1000)).toEqual({progress:0,bodyVisible:true,fall:0,gray:0,opacity:1});
  expect(enemyDeathPose(250,1000).fall).toBeGreaterThan(.5);
  expect(enemyDeathPose(380,1000).gray).toBe(0);
  expect(enemyDeathPose(450,1000).fall).toBe(1);expect(enemyDeathPose(450,1000).gray).toBeLessThan(1);
  expect(enemyDeathPose(650,1000).gray).toBe(1);expect(enemyDeathPose(650,1000).opacity).toBe(1);
  expect(enemyDeathPose(750,1000).opacity).toBeLessThan(1);
  expect(enemyDeathPose(1000,1000).opacity).toBe(0);expect(enemyDeathPose(1000,1000).bodyVisible).toBe(false);
  expect(enemyDeathPose(-1,1000).bodyVisible).toBe(false);
  for(const invalid of [0,-1,Infinity,NaN])expect(()=>enemyDeathPose(0,invalid)).toThrow();
});
