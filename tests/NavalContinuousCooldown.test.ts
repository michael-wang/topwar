import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { NavalBarrageConfigSchema } from '../src/config/navalBarrageConfig';
import { SeededRng } from '../src/core/Rng';
import { advanceNavalBarrage, emptyNavalBarrage, recordNavalSalvo, resolveNavalSalvo, setNavalBarrage, validateNavalBarrage } from '../src/simulation/navalBarrage';
import { makeArtilleryShell } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
const cfg=GameConfigSchema.parse(data).catharsis!.navalBarrage!;
it('preserves a sampled continuous deadline through cancellation, waiting, stop/restart and capacity skips',()=>{
  let s=setNavalBarrage(emptyNavalBarrage(42,cfg),cfg,0,true);
  s=advanceNavalBarrage(s,cfg,2,8,true,true);
  const shells=s.lastSalvo!.lanes.map((lane,i)=>makeArtilleryShell(i+1,{source:{id:'naval',type:'destroyer',position:{x:0,y:2.43,z:50.8}}},lane,[-2.8,-1.4,0,1.4,2.8],0,2,artilleryDefaults,.588));
  s=recordNavalSalvo(s,cfg,shells);s=resolveNavalSalvo(s,cfg,2.5);
  const deadline=s.nextAtSeconds!,rng=s.rngState;
  expect(advanceNavalBarrage(s,cfg,deadline-.01,8,true,true)).toBe(s);
  expect(validateNavalBarrage(JSON.parse(JSON.stringify(s)),cfg,deadline-.01,true)).toEqual(s);
  expect(s.rngState).toBe(rng);
  expect(()=>validateNavalBarrage({...s,cooldown:{...s.cooldown!,gapSeconds:6}},cfg,2.5,true)).toThrow();
  s=advanceNavalBarrage(s,cfg,1000,0,true,true);expect(s.capacitySkipped).toBe(1);expect(s.opportunities).toBe(2);
  expect(s.nextAtSeconds).toBeGreaterThanOrEqual(1002);expect(s.nextAtSeconds).toBeLessThan(1005);
  s=setNavalBarrage(s,cfg,1000,false);expect(s.cooldown).toBeUndefined();
  s=setNavalBarrage(s,cfg,1001,true);expect(s.nextAtSeconds).toBe(1003);
});
it.each([1,17,42,99,2026])('samples and persists continuous impact gaps once, with fixed-tick launch quantization: seed %i',seed=>{
  let s=setNavalBarrage(emptyNavalBarrage(seed,cfg),cfg,8.5,true),id=1;
  expect(s.nextAtSeconds).toBe(10.5);const samples:number[]=[];
  for(let i=0;i<1000;i++){
    const at=Math.ceil(s.nextAtSeconds!*60-1e-7)/60;
    if(s.cooldown){const gap=at-s.cooldown.resolvedAtSeconds;
      expect(gap-s.cooldown.gapSeconds).toBeGreaterThanOrEqual(-1e-8);
      expect(gap-s.cooldown.gapSeconds).toBeLessThan(1/60+1e-8);}
    s=advanceNavalBarrage(s,cfg,at,8,true,true);
    const shells=s.lastSalvo!.lanes.map(lane=>makeArtilleryShell(id++,{source:{id:'naval',type:'destroyer',position:{x:0,y:2.43,z:50.8}}},lane,[-2.8,-1.4,0,1.4,2.8],0,at,artilleryDefaults,.588));
    s=recordNavalSalvo(s,cfg,shells);const saved=JSON.parse(JSON.stringify(s));
    expect(validateNavalBarrage(saved,cfg,at,true,true,shells)).toEqual(s);
    expect(advanceNavalBarrage(s,cfg,at+.5,8,true,true,true)).toBe(s);
    const expected=new SeededRng(s.rngState),gap=2+expected.nextFloat()*3;
    s=resolveNavalSalvo(s,cfg,s.pendingImpact!.finalImpactAtSeconds);
    expect(s.cooldown!.gapSeconds).toBe(gap);expect(s.rngState).toBe(expected.getState());
    expect(resolveNavalSalvo(s,cfg,at)).toBe(s);samples.push(gap);
    expect(validateNavalBarrage(JSON.parse(JSON.stringify(s)),cfg,s.cooldown!.resolvedAtSeconds,true)).toEqual(s);
  }
  expect(samples.every(g=>g>=2&&g<5&&!Number.isInteger(g))).toBe(true);
  expect(Math.min(...samples)).toBeLessThan(2.03);expect(Math.max(...samples)).toBeGreaterThan(4.97);
});
it('rejects missing, mixed, reversed, unsafe and nonfinite cooldown ranges',()=>{
  for(const cooldown of [{initialDelaySeconds:2},{initialDelaySeconds:2,minimumGapSeconds:5,maximumGapSeconds:2},
    {initialDelaySeconds:2,minimumGapSeconds:2},{initialDelaySeconds:2,minimumGapSeconds:2,maximumGapSeconds:5,gapsSeconds:[2]},
    {initialDelaySeconds:2,minimumGapSeconds:-1,maximumGapSeconds:5},{initialDelaySeconds:2,minimumGapSeconds:2,maximumGapSeconds:Infinity}])
    expect(()=>NavalBarrageConfigSchema.parse({...cfg,postImpactCooldown:cooldown})).toThrow();
});
