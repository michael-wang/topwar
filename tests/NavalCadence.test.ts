import { expect,it } from 'vitest';
// Historical launch-based B.5 policy remains supported unchanged.
import data from './fixtures/pre-b6b6-game.json';
import previousData from './fixtures/pre-b6b5-game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { DestroyerConfigSchema } from '../src/config/destroyerConfig';
import { advanceNavalBarrage,emptyNavalBarrage,setNavalBarrage,validateNavalBarrage } from '../src/simulation/navalBarrage';
import { modularIntro } from './helpers/ModularNaval';
import { createNavalBarrageReview } from '../src/app/DevNavalBarrageReview';
import { carnivalOptionsFor } from '../scripts/qa/carnivalPilot';
import { survivalDecision } from '../scripts/qa/survivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
const c=GameConfigSchema.parse(data),cfg=c.catharsis!.navalBarrage!;

it('holds a due opportunity without draws/backlog; fires immediately when legal, not one new interval after impact',()=>{
  const s=setNavalBarrage(emptyNavalBarrage(42,cfg),cfg,0,true),due=s.nextAtSeconds!;
  const held=advanceNavalBarrage(s,cfg,due,8,true,true,true);
  expect(held).toEqual({...s,heldAtSeconds:due});
  for(const now of [due,due+1,10])expect(advanceNavalBarrage(held,cfg,now,8,true,true,true)).toBe(held);
  expect(validateNavalBarrage(held,cfg,10,true,true)).toEqual(held);
  for(const patch of [{heldAtSeconds:due-1},{heldAtSeconds:11},{enabled:false,nextAtSeconds:null}])
    expect(()=>validateNavalBarrage({...held,...patch},cfg,10,true,false)).toThrow('held');
  expect(()=>validateNavalBarrage(held,{...cfg,overlapPolicy:undefined},10,true,true)).toThrow('held');
  expect(()=>validateNavalBarrage(s,cfg,10,true,false)).toThrow('deadline');
  const atImpact=advanceNavalBarrage(held,cfg,10,8,true,true,false);
  expect(atImpact.lastSalvo!.atSeconds).toBe(10);expect(atImpact.opportunities).toBe(1);
  expect(atImpact.nextAtSeconds!-10).toBeGreaterThanOrEqual(2);expect(atImpact.nextAtSeconds!-10).toBeLessThan(3);
  expect(advanceNavalBarrage(atImpact,cfg,10,8,true,true,false)).toBe(atImpact);
  const old={...cfg,overlapPolicy:undefined};
  expect(advanceNavalBarrage(s,old,10,8,true,true,true).opportunities).toBe(1);
});

it.each([1,17,42,99,2026])('uses unified post-radio salvos with no predecessor overlap or scripted replay for seed %i',seed=>{
  const sim=modularIntro(seed,c),start=sim.getFrameState().machineGunReleaseAtSeconds!;
  let previousImpact=-Infinity,previousLaunch=-Infinity,first:number|null=null,peak=0,groups=0;
  for(let tick=0;tick<60*40&&sim.getFrameState().squad.count;tick++) {
    sim.step(1/60,survivalDecision(sim,tick,'competent'),pilotTuning);
    const s=sim.getFrameState(),launches=sim.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch');
    sim.consumePresentationEvents();sim.consumeGrenadeEvents();peak=Math.max(peak,s.artillery?.shells.length??0);
    if(launches.length){groups++;first??=s.elapsedSeconds-start;
      expect(launches.length).toBeGreaterThanOrEqual(1);expect(launches.length).toBeLessThanOrEqual(2);
      expect(new Set(launches.map(e=>e.shell.targetLane)).size).toBe(launches.length);
      expect(s.elapsedSeconds+1e-8).toBeGreaterThanOrEqual(previousImpact);
      expect(s.elapsedSeconds-previousLaunch).toBeGreaterThanOrEqual(2-1e-8);
      previousLaunch=s.elapsedSeconds;previousImpact=Math.max(...launches.map(e=>e.shell.impactAtSeconds));
    }
    if(s.elapsedSeconds-start>=27-1e-8){expect(s.destroyer!.status).toBe('complete');
      expect(s.postCapSurvival!.startedAtSeconds).toBeCloseTo(start+27,7);expect(s.navalPresence!.status).toBe('stationed');
      expect(s.navalBarrage!.enabledAtSeconds).toBeCloseTo(start+8.5,7);}
  }
  expect(first).toBeGreaterThanOrEqual(10.5);expect(first).toBeLessThan(11.5+1/60);
  expect(groups).toBeGreaterThan(0);expect(peak).toBeLessThanOrEqual(2);
  if(groups<=2)expect(sim.getFrameState().squad.count).toBe(0); // A real first salvo may kill the sole MG.
  expect(sim.getState().destroyer!.nextShotIndex).toBe(0);
});

it('restores an overdue held deadline and long flight exactly without consuming random state or replaying cues',()=>{
  const options=carnivalOptionsFor(c),a=createNavalBarrageReview(options,3,'barrage10-on');
  a.launchArtillery({source:{id:'stage1-destroyer',type:'destroyer',position:{x:0,y:2.43,z:50.8}},targetLane:0,
    flight:{horizontalSpeed:4,gravity:8,minimumFlightSeconds:.5}});
  const original=a.getState().navalBarrage!;
  for(let i=0;i<240;i++)a.step(1/60,survivalDecision(a,i,'competent'),pilotTuning);
  const saved=a.getState();expect(saved.navalBarrage).toMatchObject(original);expect(saved.navalBarrage!.heldAtSeconds).toBeDefined();
  expect(saved.navalBarrage!.nextAtSeconds).toBeLessThan(saved.elapsedSeconds);
  a.consumeArtilleryEvents();a.consumePresentationEvents();a.consumeGrenadeEvents();
  const b=createNavalBarrageReview(options,3,'barrage10-on');b.restoreState(JSON.parse(JSON.stringify(saved)));
  expect(b.consumeArtilleryEvents()).toEqual([]);
  for(let i=240;i<840&&a.getFrameState().squad.count;i++) {
    const input=survivalDecision(a,i,'competent');if(b.getFrameState().player.selectedLane!==a.getFrameState().player.selectedLane)
      b.stepLane(a.getFrameState().player.selectedLane!<b.getFrameState().player.selectedLane! ? -1:1);
    a.step(1/60,input,pilotTuning);b.step(1/60,input,pilotTuning);
    expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
  }
  expect(b.getState()).toEqual(a.getState());expect(a.getState().navalBarrage!.opportunities).toBeGreaterThan(0);
  const cancelled=createNavalBarrageReview(options,3,'barrage10-on');cancelled.restoreState(saved);cancelled.cancelArtillery();
  const paused=cancelled.getState();b.restoreState(paused);expect(b.getState()).toEqual(paused);
  cancelled.step(1/60,{targetX:0},pilotTuning);
  expect(cancelled.getState().navalBarrage!.opportunities).toBe(1);
  expect(cancelled.getState().navalBarrage!.lastSalvo!.atSeconds).toBeCloseTo(saved.elapsedSeconds+1/60);
});

it('keeps historical B.4 clocks, attacks, ground presentation and overlapping policy saved independently',()=>{
  const old=GameConfigSchema.parse(previousData);expect(old.catharsis!.destroyer!.attackPolicy).toBeUndefined();
  expect(old.catharsis!.navalBarrage!.overlapPolicy).toBeUndefined();expect(old.catharsis!.artillery!.warningPresentation).toBeUndefined();
  const a=modularIntro(17,old);for(let i=0;i<60*29;i++)a.step(1/60,survivalDecision(a,i,'competent'),pilotTuning);
  expect(a.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch').slice(0,5).map(e=>Number((e.shell.launchedAtSeconds-a.getState().machineGunReleaseAtSeconds!).toFixed(6))))
    .toEqual([8.8,12,16,17.3,21]);
  const b=modularIntro(17,c);b.restoreState(a.getState());expect(b.getState()).toEqual(a.getState());
});

it('rejects invalid new opt-ins without weakening historical scripted-shot validation',()=>{
  expect(()=>DestroyerConfigSchema.parse({...c.catharsis!.destroyer,shotTimes:[8.8]})).toThrow();
  expect(()=>DestroyerConfigSchema.parse({...c.catharsis!.destroyer,attackPolicy:undefined})).toThrow();
  expect(()=>DestroyerConfigSchema.parse({...c.catharsis!.destroyer,entrySeconds:28})).toThrow();
  expect(()=>DestroyerConfigSchema.parse({...c.catharsis!.destroyer,radioDurationSeconds:24})).toThrow();
  expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,levelEncounters:undefined}})).toThrow();
  expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,navalBarrage:{...data.catharsis.navalBarrage,overlapPolicy:'sometimes'}}})).toThrow();
});
