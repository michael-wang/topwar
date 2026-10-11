import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { NavalBarrageConfigSchema } from '../src/config/navalBarrageConfig';
import { advanceNavalBarrage, emptyNavalBarrage, setNavalBarrage, validateNavalBarrage } from '../src/simulation/navalBarrage';
import { createNavalBarrageReview } from '../src/app/DevNavalBarrageReview';
import { carnivalOptions } from '../scripts/qa/carnivalPilot';
import { survivalDecision } from '../scripts/qa/survivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
const c=GameConfigSchema.parse(data), config=c.catharsis!.navalBarrage!;
const fixture=(role:'barrage8-on'|'barrage9-on'|'barrage10-on'|'barrage10-off'='barrage10-on',seed=17)=>createNavalBarrageReview(carnivalOptions,c.weapon.rifle.fireRate,role,seed);
it('authors production AHEAD, independent +27 barrage trigger and fixed 1/2 shell bounds',()=>{
  expect(config).toMatchObject({minimumShells:1,maximumShells:2,minimumIntervalSeconds:1,maximumIntervalSeconds:2,targetLanes:[0,1,2,3,4]});
  expect(c.catharsis!.levelEncounters!.triggers[1]).toMatchObject({when:{kind:'machineGunRelease',delaySeconds:27},actions:['startSurvival','ordinaryOn','barrageOn']});
});
it('has an approximately uniform count/interval/lane distribution with different reproducible seeds',()=>{
  const schedules=[];
  for(const seed of [1,17,42,99,2026]) {
    let s=setNavalBarrage(emptyNavalBarrage(seed,config),config,27,true), twos=0,sum=0;
    const lanes=[0,0,0,0,0], first=[];
    expect(s.nextAtSeconds).toBeGreaterThanOrEqual(28);expect(s.nextAtSeconds).toBeLessThan(29);
    for(let i=0;i<5000;i++) {
      const at=s.nextAtSeconds!;s=advanceNavalBarrage(s,config,at,8,true,true);const salvo=s.lastSalvo!;
      if(i<10)first.push(salvo);expect(salvo.lanes.length).toBeGreaterThanOrEqual(1);expect(salvo.lanes.length).toBeLessThanOrEqual(2);
      expect(new Set(salvo.lanes).size).toBe(salvo.lanes.length);twos+=salvo.lanes.length-1;
      salvo.lanes.forEach(l=>lanes[l]++);sum+=s.nextAtSeconds!-at;
    }
    expect(twos/5000).toBeGreaterThan(.47);expect(twos/5000).toBeLessThan(.53);
    expect(sum/5000).toBeGreaterThan(1.47);expect(sum/5000).toBeLessThan(1.53);
    for(const count of lanes)expect(count/lanes.reduce((a,b)=>a+b)).toBeCloseTo(.2,1);
    schedules.push(first);
  }
  expect(new Set(schedules.map(s=>JSON.stringify(s))).size).toBe(5);
});
it('consumes blocked opportunities with the same RNG draws and never catches up a backlog',()=>{
  const s=setNavalBarrage(emptyNavalBarrage(17,config),config,0,true);
  const launch=advanceNavalBarrage(s,config,100,8,true,true), blocked=advanceNavalBarrage(s,config,100,0,true,true);
  expect(blocked.lastSalvo!.outcome).toBe('capacity');expect(blocked.capacitySkipped).toBe(1);
  expect(blocked.opportunities).toBe(1);expect(blocked.rngState).toBe(launch.rngState);expect(blocked.nextAtSeconds).toBe(launch.nextAtSeconds);
  expect(advanceNavalBarrage(blocked,config,100,8,true,true)).toBe(blocked);
  expect(advanceNavalBarrage(s,config,100,8,false,true).lastSalvo!.outcome).toBe('absent');
  expect(advanceNavalBarrage(s,config,100,8,true,false).enabled).toBe(false);
});
it('supports authored three-shell salvos and rejects invalid profiles',()=>{
  const three=NavalBarrageConfigSchema.parse({...config,minimumShells:3,maximumShells:3});
  const s=setNavalBarrage(emptyNavalBarrage(1,three),three,0,true);
  expect(advanceNavalBarrage(s,three,s.nextAtSeconds!,8,true,true).lastSalvo!.lanes).toHaveLength(3);
  for(const patch of [{maximumShells:9},{targetLanes:[0,0]},{minimumIntervalSeconds:3},{maximumShells:0},{targetLanes:[0]}])
    expect(()=>NavalBarrageConfigSchema.parse({...config,...patch})).toThrow();
});
it.each([8,9,10] as const)('uses real Lv%i loadout and does not change enemies between on/off fixtures',level=>{
  const on=createNavalBarrageReview(carnivalOptions,3,`barrage${level}-on`),off=createNavalBarrageReview(carnivalOptions,3,`barrage${level}-off`);
  expect(on.getState().enemies).toEqual(off.getState().enemies);expect(on.getState().defenseWaves).toEqual(off.getState().defenseWaves);
  expect(on.getState().progression).toEqual({level,xp:0});expect(on.getState().squad.count).toBe(level-7);
  expect(on.getState().destroyer!.status).toBe('skipped');expect(off.getState().navalBarrage!.enabled).toBe(false);
});
it('pauses barrage without removing ship; resumes without intro; retreat leaves waves and barrage independent',()=>{
  const s=fixture();s.commandEncounter('barrageOff');const cursor=s.getState().enemyStream!.nextEnemyId;
  for(let i=0;i<300;i++)s.step(1/60,survivalDecision(s,i,'competent'),pilotTuning);
  expect(s.consumeArtilleryEvents()).toEqual([]);expect(s.getState().navalPresence!.status).toBe('stationed');
  expect(s.getState().enemyStream!.nextEnemyId).toBeGreaterThan(cursor);
  const intro=s.getState().destroyer;s.commandEncounter('barrageOn');s.commandEncounter('destroyerRetreat');
  for(let i=0;i<600&&s.getFrameState().squad.count;i++)s.step(1/60,survivalDecision(s,i,'competent'),pilotTuning);
  expect(s.getState().destroyer).toEqual(intro);expect(s.getState().navalPresence!.status).toBe('absent');
  expect(s.getState().navalBarrage!.absentSkipped).toBeGreaterThan(0);
  s.commandEncounter('destroyerEnter');expect(s.getState().navalBarrage!.enabled).toBe(true);
});
it('restores in-flight salvos and RNG with no replay; identical inputs preserve every clock and event',()=>{
  const a=fixture(),b=fixture();
  for(let i=0;i<240;i++)a.step(1/60,survivalDecision(a,i,'competent'),pilotTuning);
  a.consumeArtilleryEvents();const saved=JSON.parse(JSON.stringify(a.getState()));expect(saved.artillery.shells.length).toBeGreaterThan(0);
  b.restoreState(saved);expect(b.consumeArtilleryEvents()).toEqual([]);
  for(let i=240;i<1200&&a.getFrameState().squad.count;i++) {
    const input=survivalDecision(a,i,'competent');const other=survivalDecision(b,i,'competent');expect(other).toEqual(input);
    a.step(1/60,input,pilotTuning);b.step(1/60,other,pilotTuning);expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
  }
  expect(b.getState()).toEqual(a.getState());
  expect(a.getState().rngState).toBe(saved.rngState);
});
it('rejects missing RNG state, duplicated lanes and invalid deadlines atomically',()=>{
  const s=fixture();for(let i=0;i<180;i++)s.step(1/60,survivalDecision(s,i,'competent'),pilotTuning);
  const good=s.getState();for(const change of [
    (v:typeof good)=>delete v.navalBarrage,
    (v:typeof good)=>v.navalBarrage!.rngState=-1,
    (v:typeof good)=>v.navalBarrage!.nextAtSeconds=0,
    (v:typeof good)=>v.navalBarrage!.nextAtSeconds=v.elapsedSeconds,
    (v:typeof good)=>v.navalBarrage!.lastSalvo!.lanes=[0,0],
    (v:typeof good)=>v.navalBarrage!.opportunities++,
  ]) {const bad=structuredClone(good);change(bad);expect(()=>s.restoreState(bad)).toThrow();expect(s.getState()).toEqual(good);}
  expect(validateNavalBarrage(good.navalBarrage,config,good.elapsedSeconds,true)).toEqual(good.navalBarrage);
});

it('enforces real artillery capacity without partial salvos, and launches simultaneous authoritative shells',()=>{
  const small=fixture(),state=small.getState();state.catharsis!.balance.artillery!.maxActive=1;small.restoreState(state);
  for(let i=0;i<1200&&small.getFrameState().squad.count;i++) {
    small.step(1/60,survivalDecision(small,i,'competent'),pilotTuning);
    expect(small.getFrameState().artillery?.shells.length??0).toBeLessThanOrEqual(1);
  }
  expect(small.getState().navalBarrage!.capacitySkipped).toBeGreaterThan(0);
  const sim=fixture();let pairs=0,peak=0;
  for(let i=0;i<1200&&sim.getFrameState().squad.count;i++) {
    sim.step(1/60,survivalDecision(sim,i,'competent'),pilotTuning);
    const launch=sim.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch');
    if(launch.length===2){pairs++;expect(launch[0].shell.launchedAtSeconds).toBe(launch[1].shell.launchedAtSeconds);
      expect(launch[0].shell.targetLane).not.toBe(launch[1].shell.targetLane);}
    peak=Math.max(peak,sim.getFrameState().artillery?.shells.length??0);
  }
  expect(pairs).toBeGreaterThan(0);expect(peak).toBeGreaterThan(2);expect(peak).toBeLessThanOrEqual(8);
});
