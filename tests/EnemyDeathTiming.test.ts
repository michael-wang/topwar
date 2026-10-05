import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING, ENEMY_REACTION_TIMING, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
it('keeps the main separation/fade clocks independent from immediate pale death confirmation',()=>{
 expect(Object.values(ENEMY_DEATH_TIMING).map(t=>t.totalMs)).toEqual([520,1100,2600]);
 for(const [role,timing]of Object.entries({heavy:ENEMY_DEATH_TIMING.heavy,giant:ENEMY_DEATH_TIMING.giant})){
  expect(timing.breakupStartMs).toBeGreaterThanOrEqual(ENEMY_REACTION_TIMING[role as keyof typeof ENEMY_REACTION_TIMING].endMs);
  expect(enemyDeathPose(timing.breakupStartMs,timing)).toMatchObject({breakup:0,bodyOpacity:1});
  expect(enemyDeathPose((timing.breakupEndMs+timing.breakupStartMs)/2,timing).breakup).toBeCloseTo(timing.breakupDistance / 2);
  let last=0;for(let age=0;age<=timing.totalMs;age+=10){const pose=enemyDeathPose(age,timing);expect(pose.breakup).toBeGreaterThanOrEqual(last);last=pose.breakup;expect(pose).not.toHaveProperty('gray');expect(pose.breakup).toBeLessThanOrEqual(timing.breakupDistance);expect(pose).not.toHaveProperty('red');expect(pose).not.toHaveProperty('fall');}
  expect(enemyDeathPose(timing.totalMs,timing)).toMatchObject({bodyVisible:false,bodyOpacity:0});
 }
});
