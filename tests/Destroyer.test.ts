import { expect, it } from 'vitest';
import * as THREE from 'three';
import { carnivalOptions, carnivalEntry, carnivalPilotLane, carnivalPilotGrenade } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { createNavalReview } from '../src/app/NavalReview';
import { advanceDestroyer, destroyerMuzzle, destroyerPose, emptyDestroyer } from '../src/simulation/destroyer';
import { DestroyerRenderer } from '../src/rendering/DestroyerRenderer';
import { type Simulation } from '../src/simulation/Simulation';
const c = carnivalOptions.catharsis.balance.destroyer!;
const make = () => createNavalReview(carnivalOptions);
const step = (s: Simulation, n = 1) => { for (let i = 0; i < n; i++) s.step(1 / 60, { targetX: 0 }, pilotTuning); };
function dodge(s: Simulation) {
  const f = s.getFrameState(), lane = f.player.selectedLane!, threats = new Set(f.artillery?.shells.map(s => s.targetLane));
  if (!threats.has(lane)) return;
  const d = [-1, 1].sort((a,b) => Math.abs(lane+a-2)-Math.abs(lane+b-2)).find(d => lane+d>=0 && lane+d<5 && !threats.has(lane+d));
  if (d) s.stepLane(d as -1 | 1);
}
it('keeps deterministic muzzle transforms aligned through entry, station and exit', () => {
  const scene = new THREE.Scene(), r = new DestroyerRenderer(scene), p = new THREE.Vector3();
  for (const age of [0, .75, 2, 3.2, 8.8, 17.3, 24, 26.9]) {
    r.update({ state: { status: 'active', startedAtSeconds: 0, nextShotIndex: 0 }, config: c, elapsedSeconds: age });
    scene.updateMatrixWorld(true); r.muzzle.getWorldPosition(p); const m = destroyerMuzzle(age,c).position;
    expect(p.distanceTo(new THREE.Vector3(-m.x,m.y,m.z))).toBeLessThan(1e-10);
  }
  expect(destroyerPose(0,c).x).toBe(c.startX); expect(destroyerPose(c.entrySeconds,c).x).toBe(c.stationX);
  expect(destroyerPose(c.durationSeconds,c).x).toBe(c.exitX);r.dispose();expect(scene.children).toHaveLength(0);
});
it('fires five locked, deterministic shots after the introduction, including overlap, then exits', () => {
  const s=make(), events=[];let peak=0;
  for(let i=0;i<60*(c.durationSeconds+2);i++){dodge(s);step(s);events.push(...s.consumeArtilleryEvents());peak=Math.max(peak,s.getFrameState().artillery!.shells.length);}
  const launches=events.filter(e=>e.kind==='artilleryLaunch');expect(launches).toHaveLength(5);
  launches.forEach((e,i)=>{expect(e.shell.launchedAtSeconds).toBeCloseTo(c.shotTimes[i]);expect(e.shell.source).toEqual(destroyerMuzzle(e.shell.launchedAtSeconds,c));});
  expect(launches[0].shell.launchedAtSeconds).toBeGreaterThan(c.radioAtSeconds+c.radioDurationSeconds);
  expect(peak).toBe(2);expect(s.getState().squad.count).toBe(3);expect(s.getState().destroyer!.status).toBe('complete');
  expect(s.getState().enemies).toEqual([]);expect(s.getState().artillery!.shells).toEqual([]);
});
it('resolves real one-soldier hits and cancels future attacks on death; Retry recreates entry',()=>{
  const s=make(),initial=s.getState();step(s,60*20);expect(s.getState().squad.count).toBe(0);
  expect(s.getState().destroyer!.nextShotIndex).toBe(4);expect(s.getState().artillery!.shells).toEqual([]);
  const dead=s.getState();step(s,600);expect(s.getState()).toEqual(dead);expect(make().getState()).toEqual(initial);
});
it.each([60,360,870,1260,1410,1560])('continues snapshots without duplicate launches at tick %i',tick=>{
  const a=make();for(let i=0;i<tick;i++){dodge(a);step(a);}a.consumeArtilleryEvents();
  const b=make();b.restoreState(JSON.parse(JSON.stringify(a.getState())));expect(b.consumeArtilleryEvents()).toEqual([]);
  for(let i=0;i<120;i++)for(const s of [a,b]){dodge(s);step(s);}
  expect(b.getState()).toEqual(a.getState());expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
});
it('rejects impossible phase clocks/cursors and skips historical snapshots past the boundary',()=>{
  const s=make(),valid=s.getState();for(const edit of [(v:typeof valid)=>v.destroyer!.startedAtSeconds=2,(v:typeof valid)=>v.destroyer!.nextShotIndex=4]){
    const bad=structuredClone(valid);edit(bad);expect(()=>s.restoreState(bad)).toThrow();expect(s.getState()).toEqual(valid);
  }
  const old=structuredClone(valid);delete old.destroyer;s.restoreState(old);step(s,1500);
  expect(s.getState().destroyer!.status).toBe('skipped');expect(s.getState().artillery!.shells).toEqual([]);
  delete old.catharsis!.balance.destroyer;s.restoreState(old);expect(s.getState().destroyer).toBeUndefined();
});
it('consumes missed shot opportunities without a deferred volley',()=>{
  const r=advanceDestroyer({status:'active',startedAtSeconds:0,nextShotIndex:0},c,undefined,18,true);
  expect(r).toEqual({state:{status:'active',startedAtSeconds:0,nextShotIndex:4},fire:true});
  expect(advanceDestroyer(r.state,c,undefined,18.1,true).fire).toBe(false);
  expect(advanceDestroyer(emptyDestroyer(),c,{status:'skipped',startedAtSeconds:null,elapsedSeconds:0,nextWaveIndex:0},0,true).state.status).toBe('skipped');
});
it('preserves the shorter encounter clocks serialized by pre-voice P3-B snapshots',()=>{
  const a=make(),old=a.getState();
  Object.assign(old.catharsis!.balance.destroyer!,{durationSeconds:24,exitAtSeconds:20,
    radioDurationSeconds:4.2,shotTimes:[5.8,9,13,14.3,18]});
  a.restoreState(old);for(let i=0;i<400;i++){dodge(a);step(a);}a.consumeArtilleryEvents();
  const b=make();b.restoreState(JSON.parse(JSON.stringify(a.getState())));
  const launches:number[]=[];
  for(let i=400;i<1500;i++)for(const s of [a,b]){dodge(s);step(s);}
  expect(b.getState()).toEqual(a.getState());
  expect(b.getState().catharsis!.balance.destroyer!.radioDurationSeconds).toBe(4.2);
  expect(b.getState().destroyer!.status).toBe('complete');
  for(const e of b.consumeArtilleryEvents())if(e.kind==='artilleryLaunch')launches.push(e.shell.launchedAtSeconds);
  expect(launches).toHaveLength(4);launches.forEach((time,i)=>expect(time).toBeCloseTo([9,13,14.3,18][i]));
});
it('hands Carnival to Destroyer to survival once, consumes wave deadlines, and keeps XP/remaining enemies active',()=>{
  const s=carnivalEntry(17);let navalStart:number|null=null,fallbackStart:number|null=null;let launches=0;
  for(let i=0;i<60*62;i++){
    const b=s.getState();if(b.destroyer?.status==='active')dodge(s);
    else if(i%12===0){const lane=carnivalPilotLane(b);if(lane!==b.player.selectedLane)s.stepLane(lane<b.player.selectedLane! ? -1:1);}
    s.step(1/60,{targetX:0,throwGrenade:carnivalPilotGrenade(s.getFrameState())},pilotTuning);
    const a=s.getState();launches+=s.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch').length;
    if(a.destroyer!.status==='active'){
      navalStart??=a.destroyer!.startedAtSeconds;expect(a.postCapSurvival!.startedAtSeconds).toBeNull();
      expect(a.enemies.filter(e=>e.id>=b.enemyStream!.nextEnemyId)).toEqual([]);
      expect(a.defenseWaves!.nextAtSeconds).toBeGreaterThan(a.elapsedSeconds);
    }
    if(a.postCapSurvival!.startedAtSeconds!==null){fallbackStart??=a.postCapSurvival!.startedAtSeconds;
      const added=a.enemies.filter(e=>e.id>=b.enemyStream!.nextEnemyId);expect(added.length).toBeLessThanOrEqual(3);
    }
  }
  expect(navalStart).toBeCloseTo(24+1/60);expect(fallbackStart).toBeCloseTo(navalStart!+c.durationSeconds);
  expect(launches).toBe(5);expect(s.getState().progression!.level).toBeGreaterThanOrEqual(7);
  expect(s.getState().postCapSurvival!.nextGiantAtSeconds).toBeCloseTo(fallbackStart!+24);
});
