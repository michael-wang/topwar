import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { createSurvivalReview, survivalReviewConfig, type SurvivalReviewFixture } from '../src/app/DevSurvivalReview';
import { postCapOrdinarySettings } from '../src/simulation/postCapSurvival';
import { advanceDefenseWaves } from '../src/simulation/enemies/defenseWaves';
import { enemyApproachSpeed } from '../src/simulation/enemies/latePressure';
import { effectivePrimaryFireRate } from '../src/simulation/progression';
import { pilotTuning } from '../scripts/qa/DefensePilot';

const c=GameConfigSchema.parse(data), options={seed:17,level:LevelDefinitionSchema.parse(levelData),
  startSquad:1,startRocketCount:0,tiers:c.tiers,catharsis:{balance:c.catharsis!,trackHalfWidth:c.track.halfWidth}};
const make=(role:SurvivalReviewFixture)=>createSurvivalReview(options,c.weapon.rifle.fireRate,role);
it.each([7,8,9,10] as const)('uses authored Lv%i weapons in both modes and deterministic real mixed groups',level=>{
  for(const mode of ['baseline','experimental','staged','ahead'] as const){
    const role=`survival${level}-${mode}` as const, a=make(role),b=make(role),s=a.getState(),balance=s.catharsis!.balance;
    expect(s).toEqual(b.getState());expect(s.seed).toBe(17);expect(s.progression!.level).toBe(level);
    expect(s.squad.count).toBe(level<9?1:level-7);
    expect(effectivePrimaryFireRate(c.weapon.rifle.fireRate,level,balance)*s.squad.count).toBe([22.5,27,54,81][level-7]);
    const late=mode==='staged'||mode==='ahead';
    const h=level===7?4:mode==='baseline'?6:late&&level>=9?level===9?15:19:level===10?15:11;
    expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(h);
    expect(s.enemies).toHaveLength(level===7?30:42);
    expect(s.enemies.every(e=>e.survivalSpeedMultiplier===(late&&level>=9?1.6:mode!=='baseline'&&level>=8?1.4:undefined))).toBe(true);
    expect(s.defenseWaves!.nextAtSeconds).toBe(late&&level>=9?level===9?5:4:mode==='experimental'&&level===10?4.5:6);
    for(let t=0;t<420;t++){a.step(1/60,{targetX:0},pilotTuning);b.step(1/60,{targetX:0},pilotTuning);}
    expect(a.getState()).toEqual(b.getState());expect(a.getState().weapons.nextProjectileId).toBeGreaterThan(20);
    const saved=a.getState();const advance=()=>{for(let t=0;t<120;t++)a.step(1/60,{targetX:0},pilotTuning);return a.getState();};
    const expected=advance();a.restoreState(JSON.parse(JSON.stringify(saved)));expect(advance()).toEqual(expected);
    expect(make(role).getState()).toEqual(s); // same selected preset on Retry
  }
});
it('stamps only future ordinary admissions, leaving pre-existing and Giant movement unchanged',()=>{
  const s=make('survival8-baseline').getState(),b=s.catharsis!.balance,old=s.enemies[0];
  b.postCapSurvival=survivalReviewConfig(b.postCapSurvival,'experimental');
  const first=s.enemyStream!.nextEnemyId;
  advanceDefenseWaves(s.defenseWaves!,s,6,17,true);
  expect(old.survivalSpeedMultiplier).toBeUndefined();expect(enemyApproachSpeed(old,b)).toBe(old.archetype==='heavy'?b.heavySpeed:b.gruntSpeed);
  for(const e of s.enemies.filter(e=>e.id>=first))expect(enemyApproachSpeed(e,b)).toBe((e.archetype==='heavy'?b.heavySpeed:b.gruntSpeed)*1.4);
  expect(enemyApproachSpeed({...old,archetype:'giant',survivalSpeedMultiplier:1.4},b)).toBe(b.giant.speed);
});
it('moves stamped ordinary enemies at the saved speed in real simulation ticks, with original Giant speed',()=>{
  const sim=make('survival8-experimental'),s=sim.getState(),b=s.catharsis!.balance;
  const grunt=s.enemies.find(e=>e.archetype==='grunt')!,heavy=s.enemies.find(e=>e.archetype==='heavy')!;
  s.enemies=[{...grunt,id:1,z:40},{...heavy,id:2,z:40},
    {...grunt,id:3,z:40,survivalSpeedMultiplier:undefined},
    {id:4,tier:1,lane:2,archetype:'giant',x:0,z:40,hp:b.giant.hp}];
  delete s.enemies[2].survivalSpeedMultiplier;
  s.enemyStream!.nextEnemyId=5;s.defenseWaves!.nextAtSeconds=100;
  s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;
  sim.restoreState(s);for(let t=0;t<60;t++)sim.step(1/60,{targetX:0},pilotTuning);
  expect(sim.getState().enemies.map(e=>40-e.z)).toEqual(expect.arrayContaining([
    expect.closeTo(b.gruntSpeed*1.4,9),expect.closeTo(b.heavySpeed*1.4,9),expect.closeTo(b.gruntSpeed,9),expect.closeTo(b.giant.speed,9)]));
});
it('changes cadence only after the already-scheduled opportunity when upgrading to Lv10',()=>{
  const s=make('survival9-experimental').getState();s.progression!.level=10;s.enemies=[];
  const due=s.defenseWaves!;
  expect(advanceDefenseWaves(due,s,6-1e-6,17,true)).toEqual(due);expect(s.enemies).toHaveLength(0);
  const next=advanceDefenseWaves(due,s,6,17,true);
  expect(s.enemies).toHaveLength(42);expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(15);
  expect(next.nextAtSeconds).toBe(10.5);
  advanceDefenseWaves(next,s,6,17,true);expect(s.enemies).toHaveLength(42);
});
it('consumes blocked and missed cap-level slots without backlog, population deletion or RNG consumption',()=>{
  const s=make('survival10-experimental').getState(),original=s.enemies[0];
  while(s.enemies.length<180)s.enemies.push({...original,id:s.enemyStream!.nextEnemyId++});
  const rng=s.rngState,id=s.enemyStream!.nextEnemyId;
  const next=advanceDefenseWaves(s.defenseWaves!,s,100,17,true);
  expect(s.enemies).toHaveLength(180);expect(s.enemyStream!.nextEnemyId).toBe(id);expect(s.rngState).toEqual(rng);
  expect(next.nextAtSeconds).toBe(103.5);
  s.enemies=[];expect(advanceDefenseWaves(next,s,100,17,true)).toEqual(next);expect(s.enemies).toHaveLength(0);
  advanceDefenseWaves(next,s,103.5,17,true);expect(s.enemies).toHaveLength(42);
});
it('selects profiles by level despite casualties and keeps optional Survival independently disabled',()=>{
  const s=make('survival10-experimental').getState(),b=s.catharsis!.balance;s.squad.count=1;
  expect(postCapOrdinarySettings(b,s.postCapSurvival,10)).toMatchObject({heavyCount:15,waveIntervalSeconds:4.5});
  expect(postCapOrdinarySettings(b,s.postCapSurvival,9)).toMatchObject({heavyCount:11,survivalSpeedMultiplier:1.4});
  expect(postCapOrdinarySettings(b,{...s.postCapSurvival!,startedAtSeconds:null},10)).toBeUndefined();
  b.postCapSurvival.enabled=false;expect(postCapOrdinarySettings(b,s.postCapSurvival,10)).toBeUndefined();
});
it('restores historical configs and unstamped enemies without reinterpreting their movement',()=>{
  const historical=make('survival8-baseline').getState();
  delete historical.catharsis!.balance.postCapSurvival.advancedProfile;
  Object.assign(historical.catharsis!.balance.postCapSurvival,{ordinaryGroupSize:3,heavyCount:3,pressureLaneCount:3});
  const sim=new Simulation(options);sim.restoreState(JSON.parse(JSON.stringify(historical)));
  expect(sim.getState()).toEqual(historical);
  const b=sim.getState().catharsis!.balance;expect(postCapOrdinarySettings(b,historical.postCapSurvival,8)?.groupSize).toBe(3);
  expect(historical.enemies.every(e=>enemyApproachSpeed(e,b)===(e.archetype==='heavy'?b.heavySpeed:b.gruntSpeed))).toBe(true);
});
it('rejects invalid optional profiles, enemy speed fields and Giant/legacy speed stamps',()=>{
  const s=make('survival8-experimental').getState(),sim=new Simulation(options);
  for(const speed of [0,-1,Infinity,NaN,4.1]){const bad=structuredClone(s);bad.enemies[0].survivalSpeedMultiplier=speed;expect(()=>sim.restoreState(bad)).toThrow();}
  const bad=structuredClone(s);bad.enemies[0].archetype='giant';expect(()=>sim.restoreState(bad)).toThrow();
  expect(()=>new Simulation({...options,catharsis:undefined})).toThrow('Beachhead Defense configuration is required');
  for(const patch of [{ordinarySpeedMultiplier:0},{ordinarySpeedMultiplier:5},{waveIntervalSeconds:0},{startLevel:8},{pressureLaneCount:6}]){
    const d:any=structuredClone(data);d.catharsis.postCapSurvival=survivalReviewConfig(c.catharsis!.postCapSurvival,'experimental');
    Object.assign(d.catharsis.postCapSurvival.capProfile,patch);expect(()=>GameConfigSchema.parse(d)).toThrow();
  }
});
it('applies AHEAD at exactly 245 XP only to future admissions, without a new threshold wave',()=>{
  const s=make('survival8-ahead').getState(),b=s.catharsis!.balance;
  expect(postCapOrdinarySettings(b,s.postCapSurvival,8,244)).toMatchObject({groupSize:42,heavyCount:11,pressureLaneCount:4,survivalSpeedMultiplier:1.4,waveIntervalSeconds:6});
  expect(postCapOrdinarySettings(b,s.postCapSurvival,8,245)).toMatchObject({groupSize:42,heavyCount:11,pressureLaneCount:5,survivalSpeedMultiplier:1.6,waveIntervalSeconds:6});
  expect(postCapOrdinarySettings(b,s.postCapSurvival,9,245)).toMatchObject({heavyCount:15,pressureLaneCount:5,waveIntervalSeconds:5});
  const original=structuredClone(s.enemies),due=s.defenseWaves!;s.progression!.xp=245;
  expect(advanceDefenseWaves(due,s,5.999,17,true)).toEqual(due);expect(s.enemies).toEqual(original);
  const next=advanceDefenseWaves(due,s,6,17,true);
  expect(s.enemies.slice(0,42)).toEqual(original);const fresh=s.enemies.slice(42);
  expect(fresh).toHaveLength(42);expect(new Set(fresh.map(e=>e.lane)).size).toBe(5);
  expect(fresh.every(e=>e.survivalSpeedMultiplier===1.6)).toBe(true);expect(next.nextAtSeconds).toBe(12);
});
it.each([['staged',9,5,15],['staged',10,4,19],['ahead',9,5,15],['ahead',10,4,19]] as const)('keeps pending deadlines at %s Lv%i', (mode,level,interval,heavy)=>{
  const s=make(`survival${level===9?8:9}-${mode}`).getState(),due=s.defenseWaves!,at=due.nextAtSeconds;
  s.progression!.level=level;s.progression!.xp=0;s.enemies=[];
  expect(advanceDefenseWaves(due,s,at-1e-6,17,true)).toEqual(due);expect(s.enemies).toHaveLength(0);
  const next=advanceDefenseWaves(due,s,at,17,true);
  expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(heavy);expect(next.nextAtSeconds).toBe(at+interval);
  expect(new Set(s.enemies.map(e=>e.lane)).size).toBe(5);
});
it('strips optional review settings when returning to saved BASELINE or EXPERIMENTAL controls',()=>{
  const root=c.catharsis!.postCapSurvival;
  for(const mode of ['baseline','experimental'] as const)
    expect(survivalReviewConfig(survivalReviewConfig(root,'ahead'),mode)).toEqual(survivalReviewConfig(root,mode));
});
it('strictly validates ordered profiles, XP boundaries and the authored progression cap',()=>{
  const good=make('survival8-ahead').getState().catharsis!.balance;
  for(const patch of [
    {levelProfiles:[]},{advancedProfile:{startLevel:8,ordinaryGroupSize:42,heavyCount:11,pressureLaneCount:4}},
    {levelProfiles:[...good.postCapSurvival.levelProfiles!].reverse()},
    {levelProfiles:[{startLevel:11,ordinaryGroupSize:42,heavyCount:19,pressureLaneCount:5}]},
    {levelProfiles:[{startLevel:8,ordinaryGroupSize:42,heavyCount:43,pressureLaneCount:5}]},
    {xpLookahead:{level:8,minimumXp:350,pressureLaneCount:5,ordinarySpeedMultiplier:1.6}},
    {xpLookahead:{level:8,minimumXp:0,pressureLaneCount:5,ordinarySpeedMultiplier:1.6}},
    {xpLookahead:{level:7,minimumXp:245,pressureLaneCount:5,ordinarySpeedMultiplier:1.6}},
    {xpLookahead:{level:8,minimumXp:245,pressureLaneCount:6,ordinarySpeedMultiplier:1.6}},
  ]){const d:any=structuredClone(data);d.catharsis=structuredClone(good);Object.assign(d.catharsis.postCapSurvival,patch);expect(()=>GameConfigSchema.parse(d)).toThrow();}
});
