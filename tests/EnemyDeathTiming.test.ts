import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING, ENEMY_DEATH_GRAY, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
it('shares freeze/gray/blood/shatter/fade semantics with bounded threat pacing', () => {
  const {grunt,heavy,giant}=ENEMY_DEATH_TIMING;
  expect(grunt.totalMs).toBeGreaterThanOrEqual(260);expect(grunt.totalMs).toBeLessThanOrEqual(300);
  expect(heavy.totalMs).toBeGreaterThanOrEqual(430);expect(heavy.totalMs).toBeLessThanOrEqual(500);
  expect(giant.totalMs).toBeGreaterThanOrEqual(800);expect(giant.totalMs).toBeLessThanOrEqual(900);
  expect(grunt.totalMs).toBeLessThan(heavy.totalMs);expect(heavy.totalMs).toBeLessThan(giant.totalMs);
  expect(ENEMY_DEATH_GRAY).toBe('#9ea5a3');
  for(const timing of [grunt,heavy,giant]) {
    expect(timing.bloodMs).toBeLessThan(timing.shatterMs);
    expect(timing.grayMs).toBeLessThan(timing.shatterMs);
    const start=enemyDeathPose(0,timing);
    expect(start.bodyVisible).toBe(true);expect(start.gray).toBe(0);expect(start.bodyOpacity).toBe(1);
    for(const name of ['fall','roll','rotation','translation'])expect(start).not.toHaveProperty(name);
    expect(enemyDeathPose(timing.bloodMs,timing).gray).toBeGreaterThan(.7);
    expect(enemyDeathPose(timing.grayMs,timing).gray).toBe(1);
    expect(enemyDeathPose(timing.shatterMs-1,timing).bodyVisible).toBe(true);
    const snap=enemyDeathPose(timing.shatterMs,timing);
    expect(snap.bodyVisible).toBe(false);expect(snap.shattered).toBe(true);expect(snap.fragmentOpacity).toBe(1);
    for(const p of [.25,.5,.75,1]) {
      const pose=enemyDeathPose(timing.shatterMs+p*(timing.totalMs-timing.shatterMs),timing);
      expect(pose.fragmentProgress).toBeCloseTo(p);expect(pose.fragmentOpacity).toBeCloseTo(1-p*p*(3-2*p));
    }
    expect(enemyDeathPose(timing.totalMs,timing).fragmentOpacity).toBe(0);
    expect(enemyDeathPose(timing.totalMs,timing).shattered).toBe(false);
    expect(enemyDeathPose(-1,timing).bodyVisible).toBe(false);
  }
});
