import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING, ENEMY_REACTION_TIMING, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
it('pales while semantic pieces separate after reaction, fades in place, and retains total role pacing',()=>{
 expect(Object.values(ENEMY_DEATH_TIMING).map(t=>t.totalMs)).toEqual([520,1100,2600]);
 for(const [role,timing]of Object.entries(ENEMY_DEATH_TIMING)){
  expect(timing.breakupStartMs).toBeGreaterThanOrEqual(ENEMY_REACTION_TIMING[role as keyof typeof ENEMY_REACTION_TIMING].endMs);
  expect(enemyDeathPose(timing.breakupStartMs,timing)).toMatchObject({gray:0,breakup:0,bodyOpacity:1});
  expect(enemyDeathPose((timing.grayEndMs+timing.breakupStartMs)/2,timing).gray).toBeCloseTo(.5);
  let last=0;for(let age=0;age<=timing.totalMs;age+=10){const pose=enemyDeathPose(age,timing);expect(pose.gray).toBeGreaterThanOrEqual(last);last=pose.gray;expect(pose.breakup).toBeLessThanOrEqual(timing.breakupDistance);expect(pose).not.toHaveProperty('red');expect(pose).not.toHaveProperty('fall');}
  expect(enemyDeathPose(timing.totalMs,timing)).toMatchObject({gray:1,bodyVisible:false,bodyOpacity:0});
 }
});
