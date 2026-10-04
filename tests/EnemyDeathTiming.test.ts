import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING, enemyDeathPose, bloodSplatPose } from '../src/presentation/EnemyDeathTiming';
it('holds gray then dark red before late fade without any transform policy',()=>{
 for(const timing of Object.values(ENEMY_DEATH_TIMING)){
  expect(timing.bloodStartMs).toBeGreaterThan(0);expect(timing.grayEndMs).toBeLessThan(timing.redStartMs);expect(timing.redCompleteMs).toBeLessThan(timing.fadeStartMs);
  expect(enemyDeathPose(0,timing)).toMatchObject({gray:0,red:0,bodyOpacity:1,bodyVisible:true});
  expect(enemyDeathPose(timing.grayEndMs,timing)).toMatchObject({gray:1,red:0,bodyOpacity:1});
  expect(enemyDeathPose(timing.redCompleteMs,timing)).toMatchObject({gray:1,red:1,bodyOpacity:1});
  const fading=enemyDeathPose((timing.fadeStartMs+timing.totalMs)/2,timing);
  expect(fading).toMatchObject({gray:1,red:1,bodyOpacity:.5,bodyVisible:true});
  expect(enemyDeathPose(timing.totalMs,timing)).toMatchObject({bodyVisible:false,bodyOpacity:0});
  expect(Object.keys(fading)).toEqual(['progress','bodyVisible','gray','red','bodyOpacity']);
 }
});
it('increases duration, blot size and repeated pulse count by threat level',()=>{
 const {grunt,heavy,giant}=ENEMY_DEATH_TIMING;
 expect(grunt.totalMs).toBe(300);expect(heavy.totalMs).toBe(850);expect(giant.totalMs).toBe(2200);
 expect(grunt.bloodScale).toBeLessThan(heavy.bloodScale);expect(heavy.bloodScale).toBeLessThan(giant.bloodScale);
 for(const timing of Object.values(ENEMY_DEATH_TIMING)){
  let peaks=0;
  for(let age=timing.bloodStartMs+1;age<timing.bloodEndMs-1;age++){
   const p=bloodSplatPose(age,timing);
   if(p.scale>bloodSplatPose(age-1,timing).scale&&p.scale>=bloodSplatPose(age+1,timing).scale)peaks++;
   if(age>timing.bloodStartMs+(timing.bloodEndMs-timing.bloodStartMs)*.1)expect(p.scale).toBeGreaterThan(.8);
  }
  expect(peaks).toBe(timing.bloodPulseCount);expect(bloodSplatPose(0,timing).visible).toBe(false);
  expect(bloodSplatPose(timing.bloodEndMs,timing)).toMatchObject({visible:false,opacity:0});
 }
});
