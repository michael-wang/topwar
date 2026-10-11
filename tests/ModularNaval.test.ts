import { expect, it } from 'vitest';
import { modularIntro } from './helpers/ModularNaval';
import { Simulation } from '../src/simulation/Simulation';
import { carnivalOptions, carnivalPilotLane } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { navalPresencePose } from '../src/simulation/navalPresence';
import { GameConfigSchema } from '../src/config/configSchema';
import data from '../public/game-data/game.json';

function advance(s: Simulation, seconds: number) {
  for (let i=0;i<Math.round(seconds*60);i++) {
    const f=s.getFrameState(); if(f.tick%12===0) {
      const lane=carnivalPilotLane(f); if(lane!==f.player.selectedLane)s.stepLane(lane<f.player.selectedLane! ? -1:1);
    }
    s.step(1/60,{targetX:0},pilotTuning); s.consumePresentationEvents(); s.consumeGrenadeEvents();
  }
}
it('keeps five introductory shots, station at +23/+27 and first Survival deadline +28',()=>{
  const s=modularIntro(), start=s.getFrameState().machineGunReleaseAtSeconds!; advance(s,23);
  expect(s.getFrameState().navalPresence!.status).toBe('stationed');
  const shots=s.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch');
  expect(shots.map(e=>Number((e.shell.launchedAtSeconds-start).toFixed(6)))).toEqual([8.8,12,16,17.3,21]);
  advance(s,4); const f=s.getFrameState();
  expect(f.squad.count).toBeGreaterThan(0); expect(f.destroyer!.status).toBe('complete');
  expect(f.postCapSurvival!.startedAtSeconds).toBeCloseTo(start+27,7);
  expect(f.defenseWaves!.nextAtSeconds).toBeCloseTo(start+28,7);
  expect(navalPresencePose(f.navalPresence!,f.elapsedSeconds,f.catharsis!.balance.destroyer!).x).toBe(f.catharsis!.balance.destroyer!.stationX);
  const cursor=f.enemyStream!.nextEnemyId; advance(s,1);
  expect(s.getFrameState().enemyStream!.nextEnemyId).toBeGreaterThan(cursor);
});
it.each([15,26,35])('restores exact independent clocks and in-flight shells at %is',seconds=>{
  const a=modularIntro();advance(a,seconds);a.consumeArtilleryEvents();
  const b=modularIntro(); b.restoreState(JSON.parse(JSON.stringify(a.getState())));
  advance(a,5);advance(b,5);expect(b.getState()).toEqual(a.getState());
  expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
});
it('allows authored late entrance, retreat and reentry without MG/Carnival or introductory shots',()=>{
  const c=GameConfigSchema.parse(data);c.catharsis!.levelEncounters={version:1,initialOrdinaryEnabled:true,triggers:[
    {id:'later',when:{kind:'time',seconds:2},actions:['destroyerEnter']}]};
  const s=new Simulation({...carnivalOptions,catharsis:{...carnivalOptions.catharsis,balance:c.catharsis!}});
  advance(s,8); expect(s.getFrameState().navalPresence!.status).toBe('stationed');
  expect(s.getFrameState().machineGunReleaseAtSeconds).toBeNull();expect(s.consumeArtilleryEvents()).toEqual([]);
  const deadline=s.getFrameState().defenseWaves!.nextAtSeconds;
  s.commandEncounter('destroyerRetreat');advance(s,4);
  expect(s.getFrameState().navalPresence!.status).toBe('absent');
  expect(s.getFrameState().defenseWaves!.nextAtSeconds).toBeGreaterThanOrEqual(deadline);
  s.commandEncounter('destroyerEnter');advance(s,4);expect(s.getFrameState().navalPresence!.status).toBe('stationed');
  expect(s.getFrameState().defenseWaves!.nextAtSeconds).toBeGreaterThan(deadline);
  expect(s.getFrameState().destroyer!.status).toBe('pending');expect(s.consumeArtilleryEvents()).toEqual([]);
});
it('rejects missing or replayed modular cursors and invalid presence clocks atomically',()=>{
  const s=modularIntro();advance(s,5);const good=s.getState();
  for(const change of [
    (v:typeof good)=>delete v.levelEncounters,
    (v:typeof good)=>v.levelEncounters!.triggers[0].consumedAtSeconds=null,
    (v:typeof good)=>v.navalPresence!.enteredAtSeconds=99,
    (v:typeof good)=>v.levelEncounters!.triggers[1].consumedAtSeconds=5,
  ]) {const bad=structuredClone(good);change(bad);expect(()=>s.restoreState(bad)).toThrow();expect(s.getState()).toEqual(good);}
});
