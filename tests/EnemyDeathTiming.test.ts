import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING, ENEMY_REACTION_TIMING, enemyDeathPose, bloodSplatPose } from '../src/presentation/EnemyDeathTiming';
it('progressively pales, loosens only after reaction, and fades body/blood together without red',()=>{
 for(const [role,timing] of Object.entries(ENEMY_DEATH_TIMING)){
  expect(timing.grayEndMs/timing.totalMs).toBeGreaterThanOrEqual(.45);expect(timing.grayEndMs/timing.totalMs).toBeLessThanOrEqual(.55);
  expect(timing.breakupStartMs).toBeGreaterThan(ENEMY_REACTION_TIMING[role as keyof typeof ENEMY_REACTION_TIMING].endMs);
  expect(enemyDeathPose(0,timing)).toMatchObject({gray:0,breakup:0,bodyOpacity:1,bodyVisible:true});
  expect(enemyDeathPose(timing.grayEndMs/2,timing).gray).toBeCloseTo(.5);
  expect(enemyDeathPose(timing.grayEndMs,timing).gray).toBe(1);
  expect(enemyDeathPose(timing.breakupStartMs,timing).breakup).toBe(0);
  for(let age=0;age<=timing.totalMs;age+=10){
   const body=enemyDeathPose(age,timing),blood=bloodSplatPose(age,timing);
   expect(body).not.toHaveProperty('red');expect(body.breakup).toBeLessThanOrEqual(timing.breakupDistance);
   if(age>=timing.fadeStartMs){expect(blood.opacity).toBeCloseTo(.58*body.bodyOpacity);expect(blood.visible).toBe(body.bodyVisible);}
  }
  expect(enemyDeathPose(timing.totalMs,timing)).toMatchObject({bodyVisible:false,bodyOpacity:0});
  expect(bloodSplatPose(timing.totalMs,timing)).toMatchObject({visible:false,opacity:0});
 }
});
it('retains pulse hierarchy with slower role pacing and a settled blood layer into fade',()=>{
 const {grunt,heavy,giant}=ENEMY_DEATH_TIMING;
 expect([grunt.totalMs,heavy.totalMs,giant.totalMs]).toEqual([520,1100,2600]);
 expect(grunt.bloodScale).toBeLessThan(heavy.bloodScale);expect(heavy.bloodScale).toBeLessThan(giant.bloodScale);
 for(const timing of Object.values(ENEMY_DEATH_TIMING)){
  let peaks=0;
  for(let age=timing.bloodStartMs+1;age<timing.bloodPulseEndMs-1;age++){
   const p=bloodSplatPose(age,timing);
   if(p.scale>bloodSplatPose(age-1,timing).scale&&p.scale>=bloodSplatPose(age+1,timing).scale)peaks++;
  }
  expect(peaks).toBe(timing.bloodPulseCount);
  expect(bloodSplatPose(timing.fadeStartMs,timing).opacity).toBeCloseTo(.58);
 }
});
