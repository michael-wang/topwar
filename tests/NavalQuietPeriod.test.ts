import { expect,it } from 'vitest';
import data from './fixtures/pre-b6b7-game.json';
import historical from './fixtures/pre-b6b6-game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { NavalBarrageConfigSchema } from '../src/config/navalBarrageConfig';
import { advanceNavalBarrage,emptyNavalBarrage,recordNavalSalvo,resolveNavalSalvo,setNavalBarrage,validateNavalBarrage } from '../src/simulation/navalBarrage';
import { makeArtilleryShell } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
import { createNavalBarrageReview } from '../src/app/DevNavalBarrageReview';
import { carnivalOptionsFor } from '../scripts/qa/carnivalPilot';
import { survivalDecision } from '../scripts/qa/survivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
const c=GameConfigSchema.parse(data),cfg=c.catharsis!.navalBarrage!;
it.each([1,17,42,99,2026])('draws one of all four actual post-impact gaps exactly once for seed %i',seed=>{
  let s=setNavalBarrage(emptyNavalBarrage(seed,cfg),cfg,8.5,true),nextId=1;
  expect(s.nextAtSeconds).toBe(10.5);const counts=[0,0,0,0];let doubles=0;
  for(let i=0;i<1000;i++){
    const launchAt=s.nextAtSeconds!;s=advanceNavalBarrage(s,cfg,launchAt,8,true,true);
    const shells=s.lastSalvo!.lanes.map(targetLane=>makeArtilleryShell(nextId++,{
      source:{id:'naval',type:'destroyer',position:{x:0,y:2.43,z:50.8}}},targetLane,[-2.8,-1.4,0,1.4,2.8],0,launchAt,artilleryDefaults,.588));
    doubles+=shells.length-1;s=recordNavalSalvo(s,cfg,shells);const flight=s;
    for(let j=0;j<3;j++)expect(advanceNavalBarrage(s,cfg,launchAt+.5,8,true,true,true)).toBe(flight);
    expect(validateNavalBarrage(s,cfg,launchAt+.5,true,true,shells)).toEqual(s);
    const impact=s.pendingImpact!.finalImpactAtSeconds;s=resolveNavalSalvo(s,cfg,impact);
    const gap=s.nextAtSeconds!-impact;expect(gap).toBeCloseTo(s.cooldown!.gapSeconds,7);counts[s.cooldown!.gapSeconds]++;
    expect(resolveNavalSalvo(s,cfg,impact)).toBe(s);
    expect(validateNavalBarrage(s,cfg,impact,true)).toEqual(s);
  }
  for(const n of counts){expect(n).toBeGreaterThan(190);expect(n).toBeLessThan(310);}
  expect(doubles).toBeGreaterThan(420);expect(doubles).toBeLessThan(580);
});
it('keeps old launch-based configurations unchanged and rejects invalid opt-ins/state',()=>{
  const old=GameConfigSchema.parse(historical).catharsis!.navalBarrage!;
  const s=setNavalBarrage(emptyNavalBarrage(42,old),old,0,true);
  expect(s.nextAtSeconds).toBeGreaterThanOrEqual(2);expect(s.nextAtSeconds).toBeLessThan(3);
  for(const patch of [{overlapPolicy:undefined},{postImpactCooldown:{initialDelaySeconds:-1,gapsSeconds:[0,1]}},
    {postImpactCooldown:{initialDelaySeconds:2,gapsSeconds:[0,0]}},{postImpactCooldown:{initialDelaySeconds:2,gapsSeconds:[]}}])
    expect(()=>NavalBarrageConfigSchema.parse({...cfg,...patch})).toThrow();
  expect(()=>validateNavalBarrage({...s,cooldown:{resolvedAtSeconds:0,gapSeconds:2}},old,0,true)).toThrow();
});
it('round-trips pending shells/cooldowns, cancellation, restart and large steps without replay',()=>{
  const options=carnivalOptionsFor(c),a=createNavalBarrageReview(options,3,'barrage10-on',42),b=createNavalBarrageReview(options,3,'barrage10-on',42);
  for(let i=0;i<180;i++)a.step(1/60,survivalDecision(a,i,'competent'),pilotTuning);
  const saved=a.getState();expect(saved.navalBarrage!.pendingImpact).toBeDefined();a.consumeArtilleryEvents();b.restoreState(saved);
  expect(b.consumeArtilleryEvents()).toEqual([]);
  for(let i=180;i<1000&&a.getFrameState().squad.count;i++){
    const input=survivalDecision(a,i,'competent'),other=survivalDecision(b,i,'competent');expect(other).toEqual(input);
    a.step(1/60,input,pilotTuning);b.step(1/60,other,pilotTuning);expect(a.consumeArtilleryEvents()).toEqual(b.consumeArtilleryEvents());
  }
  expect(a.getState()).toEqual(b.getState());a.restoreState(saved);a.cancelArtillery();
  const cancelled=a.getState();expect(cancelled.navalBarrage!.cooldown!.resolvedAtSeconds).toBe(cancelled.elapsedSeconds);
  b.restoreState(cancelled);expect(b.getState()).toEqual(cancelled);
  a.commandEncounter('barrageOff');expect(a.getState().navalBarrage!.pendingImpact).toBeUndefined();
  a.commandEncounter('barrageOn');expect(a.getState().navalBarrage!.nextAtSeconds).toBeCloseTo(a.getState().elapsedSeconds+2);
  const due=setNavalBarrage(emptyNavalBarrage(4,cfg),cfg,0,true),late=advanceNavalBarrage(due,cfg,100,0,true,true);
  expect(late.opportunities).toBe(1);expect(late.capacitySkipped).toBe(1);expect(late.nextAtSeconds).toBeGreaterThanOrEqual(100);
});
it('updates the final deadline on partial cancellation and draws only once on the last cancellation',()=>{
  const options=carnivalOptionsFor(c),sim=createNavalBarrageReview(options,3,'barrage10-on',17);
  for(let tick=0;tick<180;tick++)sim.step(1/60,survivalDecision(sim,tick,'competent'),pilotTuning);
  const before=sim.getState(),shells=before.artillery!.shells;expect(shells).toHaveLength(2);
  const later=[...shells].sort((a,b)=>b.impactAtSeconds-a.impactAtSeconds)[0];sim.cancelArtillery(later.id);
  const partial=sim.getState();expect(partial.navalBarrage!.pendingImpact!.finalImpactAtSeconds).toBe(partial.artillery!.shells[0].impactAtSeconds);
  expect(partial.navalBarrage!.rngState).toBe(before.navalBarrage!.rngState);
  sim.restoreState(partial);expect(sim.getState()).toEqual(partial);
  sim.cancelArtillery();const final=sim.getState();expect(final.navalBarrage!.cooldown!.resolvedAtSeconds).toBe(final.elapsedSeconds);
  const rng=final.navalBarrage!.rngState;sim.cancelArtillery();expect(sim.getState().navalBarrage!.rngState).toBe(rng);
  sim.restoreState(final);expect(sim.getState()).toEqual(final);
  sim.restoreState(before);sim.commandEncounter('barrageOff');sim.commandEncounter('barrageOn');
  const restarted=sim.getState();expect(restarted.artillery).toEqual(before.artillery);
  expect(restarted.navalBarrage!.nextAtSeconds).toBeCloseTo(restarted.elapsedSeconds+2);
  sim.restoreState(restarted);expect(sim.getState()).toEqual(restarted);
});
