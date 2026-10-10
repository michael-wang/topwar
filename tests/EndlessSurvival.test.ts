import { expect, it } from 'vitest';
import { survivalSimulation, survivalDecision, runSurvivalPilot } from '../scripts/qa/survivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { advanceDefenseWaves } from '../src/simulation/enemies/defenseWaves';
import { postCapOrdinarySettings, advancePostCapSurvival } from '../src/simulation/postCapSurvival';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { createDevReviewFixture as createQaFixture } from './helpers/ReviewFixtures';
import oldSaves from './fixtures/old-survival.json';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

it.each([6,7,8])('uses progression Lv%i for future composition even after casualties', level => {
  const sim = survivalSimulation(17,'lv8'), s = sim.getState();
  s.progression = { level, xp: 0 }; s.squad = { count: 1, rifleCounts: [1], rifleRemainder: 0, rocketCount: 0 };
  s.weapons.rifleMemberCooldowns = [0]; sim.restoreState(s);
  const frame = sim.getState(); frame.enemies = [];
  const balance = frame.catharsis!.balance, settings = postCapOrdinarySettings(balance, frame.postCapSurvival, level)!;
  expect(settings).toEqual({groupSize:level===8?42:30,heavyCount:level===8?6:4,pressureLaneCount:level===8?4:3});
  const rng = frame.rngState, oldId = frame.enemyStream!.nextEnemyId;
  const next = advanceDefenseWaves({nextAtSeconds:6},frame,6,17,true);
  expect(next.nextAtSeconds).toBe(12); expect(frame.rngState).toBe(rng);
  expect(frame.enemies.filter(e=>e.id>=oldId)).toHaveLength(settings.groupSize);
  expect(frame.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(settings.heavyCount);
  expect(new Set(frame.enemies.map(e=>e.lane)).size).toBe(settings.pressureLaneCount);
});

it('consumes cap-blocked and missed rows without deleting survivors or accumulating a backlog',()=>{
  const s=survivalSimulation(17,'lv8').getState(), original=s.enemies[0];
  s.enemies=Array.from({length:150},(_,i)=>({...original,id:i+1})); s.enemyStream!.nextEnemyId=151;
  const before=structuredClone(s.enemies), row=s.enemyStream!.nextRowIndex, rng=s.rngState;
  const next=advanceDefenseWaves({nextAtSeconds:6},s,24,17,true);
  expect(next.nextAtSeconds).toBe(30); expect(s.enemies).toEqual(before); expect(s.enemyStream!.nextEnemyId).toBe(151);
  expect(s.enemyStream!.nextRowIndex).toBeGreaterThan(row); expect(s.rngState).toBe(rng);
  s.enemies=[];advanceDefenseWaves(next,s,25,17,true);expect(s.enemies).toHaveLength(0);
  advanceDefenseWaves(next,s,30,17,true);expect(s.enemies).toHaveLength(42);
  // Exactly fitting groups are admitted. Already-over-cap crowds are preserved.
  s.enemies=Array.from({length:138},(_,i)=>({...original,id:i+1}));s.enemyStream!.nextEnemyId=139;
  advanceDefenseWaves({nextAtSeconds:36},s,36,17,true);expect(s.enemies).toHaveLength(180);
  s.enemies.push({...original,id:999});const over=structuredClone(s.enemies);
  advanceDefenseWaves({nextAtSeconds:42},s,42,17,true);expect(s.enemies).toEqual(over);
});

it('bounds recurring Giants by the Survival population cap and skips full opportunities',()=>{
  const s=survivalSimulation(17,'lv8').getState(), original=s.enemies[0];
  s.enemies=Array.from({length:180},(_,i)=>({...original,id:i+1}));s.elapsedSeconds=24;
  s.postCapSurvival=advancePostCapSurvival(s.postCapSurvival,s);
  expect(s.enemies).toHaveLength(180);expect(s.postCapSurvival.nextGiantAtSeconds).toBe(48);
  s.enemies=[];s.elapsedSeconds=25;s.postCapSurvival=advancePostCapSurvival(s.postCapSurvival,s);expect(s.enemies).toHaveLength(0);
  s.elapsedSeconds=48;s.postCapSurvival=advancePostCapSurvival(s.postCapSurvival,s);
  expect(s.enemies).toHaveLength(1);expect(s.enemies[0]).toMatchObject({archetype:'giant',hp:172});
});

it.each(oldSaves)('retains historical serialized three-Heavy settings and deadlines', save=>{
  const a=survivalSimulation(17,'lv8'),b=survivalSimulation(17,'lv8');
  a.restoreState(save as unknown as ReturnType<typeof a.getState>);b.restoreState(JSON.parse(JSON.stringify(save)));
  expect(a.getState()).toEqual(b.getState());
  expect(a.getState().catharsis!.balance.postCapSurvival.advancedProfile).toBeUndefined();
  const deadline=a.getState().defenseWaves!.nextAtSeconds; let next=a.getState().enemyStream!.nextEnemyId, wave=0;
  for(let tick=0;tick<600;tick++) {
    const input=survivalDecision(a,tick,'competent');
    // Replay the same explicit lane command, without a second independent pilot.
    const lane=a.getFrameState().player.selectedLane!, other=b.getFrameState().player.selectedLane!;
    if(lane!==other)b.stepLane(lane<other?-1:1);
    a.step(1/60,input,pilotTuning);b.step(1/60,input,pilotTuning);
    const s=a.getFrameState(),added=s.enemies.filter(e=>e.id>=next&&e.archetype!=='giant');
    if(added.length){expect(added).toHaveLength(3);expect(added.every(e=>e.archetype==='heavy')).toBe(true);wave++;}
    next=s.enemyStream!.nextEnemyId;
  }
  expect(a.getState()).toEqual(b.getState());expect(wave).toBeGreaterThan(0);
  expect(a.getState().defenseWaves!.nextAtSeconds).toBeCloseTo(deadline+12);
});

it('exposes Lv8 Survival in human LATE while retaining the old Lv6 QA entry',()=>{
  const c=GameConfigSchema.parse(gameData),options={seed:17,startSquad:1,startRocketCount:0,tiers:c.tiers,
    catharsis:{balance:c.catharsis!,trackHalfWidth:c.track.halfWidth},level:LevelDefinitionSchema.parse(levelData)};
  const a=createDevReviewFixture(options,c.weapon.rifle.fireRate,'late'),s=a.getState();
  expect(s.progression).toEqual({level:8,xp:0});expect(s.squad.count).toBe(3);
  expect(s.weapons.rifleMemberCooldowns).toEqual([0,1/54,2/54]);
  expect(s.enemies).toHaveLength(42);expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(6);
  expect(s.defenseWaves!.nextAtSeconds).toBe(6);
  const b=createDevReviewFixture(options,c.weapon.rifle.fireRate,'late');expect(b.getState()).toEqual(s);
  b.restoreState(JSON.parse(JSON.stringify(s)));expect(b.getState()).toEqual(s);
  expect(createQaFixture(options,c.weapon.rifle.fireRate,'late').getState().progression!.level).toBe(6);
});

it('starts after +27 naval completion and admits its first full wave exactly one second later',()=>{
  const sim=survivalSimulation(17,'natural'); let activation:number|null=null,nextId=0;
  for(let tick=0;tick<60*140;tick++) {
    sim.step(1/60,survivalDecision(sim,tick,'competent'),pilotTuning);
    const s=sim.getFrameState();
    if(s.postCapSurvival!.startedAtSeconds!==null) {
      activation=s.postCapSurvival!.startedAtSeconds;
      expect(s.carnival!.status).toBe('complete');expect(s.destroyer!.status).toBe('complete');
      expect(activation-s.machineGunReleaseAtSeconds!).toBeCloseTo(27);
      expect(s.defenseWaves!.nextAtSeconds).toBeCloseTo(activation+1);nextId=s.enemyStream!.nextEnemyId;break;
    }
  }
  expect(activation).not.toBeNull();
  for(let i=0;i<59;i++)sim.step(1/60,{targetX:0},pilotTuning);
  expect(sim.getFrameState().enemyStream!.nextEnemyId).toBe(nextId);
  sim.step(1/60,{targetX:0},pilotTuning);
  const s=sim.getState(),newEnemies=s.enemies.filter(e=>e.id>=nextId);
  expect(s.elapsedSeconds-activation!).toBeCloseTo(1);
  expect(s.enemyStream!.nextEnemyId-nextId).toBe(s.progression!.level===8?42:30);
  expect(newEnemies.filter(e=>e.archetype==='heavy')).toHaveLength(s.progression!.level===8?6:4);
  expect(s.defenseWaves!.nextAtSeconds).toBeCloseTo(activation!+7);
});

it.each([1,17,42,99,2026])('replays 180 seconds of natural and three-MG Survival deterministically for seed %i',seed=>{
  for(const scenario of ['natural','lv8'] as const) {
    const {stepMs:_,...a}=runSurvivalPilot(seed,scenario),{stepMs:__,...b}=runSurvivalPilot(seed,scenario);
    expect(a).toEqual(b);expect(a.survivalSeconds).toBeGreaterThanOrEqual(180);expect(a.peakEnemies).toBeLessThanOrEqual(180);
    expect(a.waves.filter(w=>w.total).every(w=>w.total===(w.level>=8?42:30)&&w.heavies===(w.level>=8?6:4))).toBe(true);
    expect(a.opportunities.filter(o=>o.kind==='giant').map(o=>Math.round(o.age))).toEqual([24,48,72,96,120,144,168]);
    expect(a.opportunities.filter(o=>o.kind==='supply').map(o=>Math.round(o.age))).toEqual([30,60,90,120,150,180]);
    if(scenario==='natural')expect(a.firstWaveAge).toBeCloseTo(1);
  }
},30000);
