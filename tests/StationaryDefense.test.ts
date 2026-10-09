import { expect, it } from 'vitest';
import { Simulation } from '../src/simulation/Simulation';
import { carnivalOptions, carnivalPilotLane, carnivalPilotGrenade } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';
import { DefenseWaveConfigSchema } from '../src/config/defenseConfig';

// Isolate the accepted motion/fallback; naval handoff has dedicated coverage.
const fallbackOptions={...carnivalOptions,catharsis:{...carnivalOptions.catharsis,
  balance:{...carnivalOptions.catharsis.balance,destroyer:{...carnivalOptions.catharsis.balance.destroyer!,enabled:false}}}};
const make=(seed=17)=>new Simulation({...fallbackOptions,seed});
const step=(sim:Simulation,n=1)=>{for(let i=0;i<n;i++)sim.step(1/60,{targetX:0},pilotTuning);};
const quiet=()=>{
  const sim=new Simulation({...carnivalOptions,level:{id:'contact',length:100,enemyGroups:[],upgradeGates:[]}});
  const s=sim.getState();s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;sim.restoreState(s);return sim;
};

it.each([1,42])('keeps Z=0 through six minutes of seeded progression and survival (%i)',seed=>{
  const sim=make(seed);
  for(let tick=0;tick<60*360;tick++) {
    const b=sim.getFrameState();if(tick%12===0){const lane=carnivalPilotLane(b);if(lane!==b.player.selectedLane)sim.stepLane(lane<b.player.selectedLane! ? -1:1);}
    sim.step(1/60,{targetX:0,throwGrenade:carnivalPilotGrenade(sim.getFrameState())},pilotTuning);expect(sim.getFrameState().player.z).toBe(0);sim.consumePresentationEvents();
  }
  expect(sim.getState().elapsedSeconds).toBeCloseTo(360);expect(sim.getState().progression!.level).toBe(8);
  expect(sim.getState().enemyStream!.nextRowIndex).toBeGreaterThan(300);
});

it.each([['grunt',.85],['heavy',.72],['giant',.68]] as const)('moves only %s at %f units/s regardless of forward tuning', (archetype,speed)=>{
  for(const forwardSpeed of [0,.6,3]) {
    const sim=quiet(),s=sim.getState();s.enemies=[{id:1,tier:1,archetype,lane:0,x:-2.8,z:20,hp:archetype==='grunt'?1:archetype==='heavy'?15:172}];if(archetype==='giant')s.giantEncounter={scheduledAtSeconds:0,spawned:true};sim.restoreState(s);
    sim.step(1,{targetX:0},{...pilotTuning,forwardSpeed});
    expect(sim.getState().player.z).toBe(0);expect(sim.getState().enemies[0].z).toBeCloseTo(20-speed);
  }
});

it.each([[0,2,'normalEnemyContact'],[2.8,2,'normalEnemyContact']] as const)(
  'resolves enemy-only sweep / crossing at x=%f from z=%f', (x,z,kind)=>{
    const sim=quiet(),s=sim.getState();s.enemies=[{id:1,tier:1,archetype:'grunt',lane:x===0?2:4,x,z,hp:1}];sim.restoreState(s);
    sim.step(x===0?3:5,{targetX:0},pilotTuning);
    expect(sim.getState().squad.count).toBe(0);expect(sim.getState().enemies).toEqual([]);
    expect(sim.consumePresentationEvents()[0].kind).toBe(kind);
    const dead=sim.getState();step(sim,60);expect(sim.getState()).toEqual(dead);
  });

it('admits every six seconds beyond the old horizon, with fixed origins and no giant step backlog',()=>{
  const sim=make(),s=sim.getState();s.catharsis!.balance.gruntSpeed=0;s.catharsis!.balance.heavySpeed=0;
  s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000];sim.restoreState(s);
  let next=s.enemyStream!.nextEnemyId;const times:number[]=[];
  for(let tick=0;tick<3600;tick++){step(sim);const f=sim.getFrameState();if(f.enemyStream!.nextEnemyId!==next){
    const group=f.enemies.filter(e=>e.id>=next);expect(group).toHaveLength(24);
    expect(group.every(e=>e.z>=38&&e.z<=47)).toBe(true);times.push(f.elapsedSeconds);next=f.enemyStream!.nextEnemyId;
  }}
  expect(times).toHaveLength(10);expect(times[0]).toBeCloseTo(5/3);
  for(let i=1;i<times.length;i++)expect(times[i]-times[i-1]).toBeCloseTo(6);
  const before=sim.getState().enemyStream!.nextEnemyId;sim.step(60,{targetX:0},pilotTuning);
  expect(sim.getState().enemyStream!.nextEnemyId-before).toBe(24);
  expect(sim.getState().defenseWaves!.nextAtSeconds).toBeGreaterThan(sim.getState().elapsedSeconds);
});

it('migrates nonzero-Z eight/six-level snapshots once, preserving relative entities, Grenade and deadlines',()=>{
  for(const max of [6,8]) {
    const sim=make(),s=sim.getState(),origin=42;
    s.elapsedSeconds=70;s.tick=4200;s.player.z=origin;s.progression={level:6,xp:0};
    s.catharsis!.balance.progression.levelPlan=s.catharsis!.balance.progression.levelPlan.slice(0,max);
    s.catharsis!.balance.progression.xpRequirements=s.catharsis!.balance.progression.xpRequirements.slice(0,max-1);
    s.catharsis!.balance.gruntSpeed=.25;s.catharsis!.balance.heavySpeed=.12;s.catharsis!.balance.giant.speed=.08;
    delete s.catharsis!.balance.defenseMotionVersion;delete s.defenseWaves;delete s.carnival;
    s.machineGunReleaseAtSeconds=60;s.enemyStream!.nextRowIndex=101;
    s.enemies=[{id:1,tier:1,lane:2,archetype:'heavy',hp:7,x:0,z:origin+15}];s.enemyStream!.nextEnemyId=2;
    s.projectiles=[{id:1,kind:'machineGun',tier:1,memberIndex:0,lane:2,slopeX:0,x:0,z:origin+5,speed:60,
      remainingRange:50,damage:3,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];s.weapons.nextProjectileId=2;
    s.grenade={lv3EnteredAtSeconds:30,supplySpawnedAtSeconds:38,acquiredAtSeconds:39,inventory:1,supply:null,
      flight:{startX:0,startZ:origin,targetX:0,targetZ:origin+15,startedAtSeconds:69.8,flightSeconds:.65,damageEnemyHp:9,blastRadius:4}};
    const original=structuredClone(s);sim.restoreState(s);const migrated=sim.getState();expect(s).toEqual(original);
    expect(migrated.player.z).toBe(0);expect(migrated.enemies[0].z).toBe(15);expect(migrated.projectiles[0].z).toBe(5);
    expect(migrated.grenade!.flight).toMatchObject({startZ:0,targetZ:15,startedAtSeconds:69.8});
    expect(migrated.catharsis!.balance.gruntSpeed).toBeCloseTo(.85);expect(migrated.defenseWaves!.nextAtSeconds).toBeCloseTo(70+(30+102*.6-42-47)/.6);
    expect(migrated.progression).toEqual(s.progression);expect(migrated.weapons).toEqual(s.weapons);
    const clone=make(99);clone.restoreState(JSON.parse(JSON.stringify(migrated)));expect(clone.getState()).toEqual(migrated);
    step(sim,600);step(clone,600);expect(clone.getState()).toEqual(sim.getState());
  }
});

it.each(['curve','evolve','carnival','late','mg7','mg8'] as const)('keeps %s entry stationary and its Retry deterministic',role=>{
  const makeEntry=()=>createDevReviewFixture(carnivalOptions,3,role),sim=makeEntry(),initial=sim.getState();
  step(sim,600);expect(sim.getState().player.z).toBe(0);expect(makeEntry().getState()).toEqual(initial);
  const clone=makeEntry();clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));step(sim,120);step(clone,120);expect(clone.getState()).toEqual(sim.getState());
});

it('rejects invalid timer snapshots without partial restoration',()=>{
  const sim=make(),original=sim.getState();for(const nextAtSeconds of [-1,NaN,Infinity]){
    const s=sim.getState();s.defenseWaves={nextAtSeconds};expect(()=>sim.restoreState(s)).toThrow();expect(sim.getState()).toEqual(original);
  }
});

it('consumes phase-owned ordinary deadlines and resumes only the next slot after Carnival',()=>{
  const sim=createDevReviewFixture(fallbackOptions,3,'carnival');
  step(sim);const release=sim.getState().machineGunReleaseAtSeconds;
  expect(sim.getState().defenseWaves!.nextAtSeconds).toBeCloseTo(5/3+6);
  const resumed:number[]=[];
  for(let tick=1;tick<60*32;tick++) {
    const before=sim.getState();
    if(tick%12===0){const lane=carnivalPilotLane(before);if(lane!==before.player.selectedLane)sim.stepLane(lane<before.player.selectedLane! ? -1:1);}
    step(sim);const after=sim.getState();
    expect(after.player.z).toBe(0);expect(after.machineGunReleaseAtSeconds).toBe(release);
    if(after.carnival!.status==='active') {
      expect(after.defenseWaves!.nextAtSeconds).toBeGreaterThan(after.elapsedSeconds);
      const added=after.enemies.filter(e=>e.id>=before.enemyStream!.nextEnemyId);
      expect(added.every(e=>e.archetype==='grunt')).toBe(true);
    } else if(after.enemyStream!.nextEnemyId>before.enemyStream!.nextEnemyId) {
      resumed.push(after.elapsedSeconds);
      expect(after.enemyStream!.nextEnemyId-before.enemyStream!.nextEnemyId).toBe(3);
    }
  }
  expect(resumed).toHaveLength(2);expect(resumed[0]).toBeCloseTo(5/3+24);expect(resumed[1]-resumed[0]).toBeCloseTo(6);
  expect(sim.getState().carnival!.elapsedSeconds).toBe(24);
});

it('validates explicit wave timing and converts old approach speeds only once',()=>{
  for(const intervalSeconds of [0,-1,Infinity,NaN])expect(()=>DefenseWaveConfigSchema.parse({intervalSeconds,firstWaveDelaySeconds:0})).toThrow();
  const old={...carnivalOptions.catharsis.balance,defenseMotionVersion:undefined,gruntSpeed:.25,heavySpeed:.12,
    giant:{...carnivalOptions.catharsis.balance.giant,speed:.08}};
  const migrated=CatharsisConfigSchema.parse(old);
  expect(migrated).toMatchObject({defenseMotionVersion:2,gruntSpeed:.85,heavySpeed:.72});
  expect(migrated.giant.speed).toBeCloseTo(.68);
  expect(CatharsisConfigSchema.parse(migrated)).toEqual(migrated);
});

it('keeps legacy non-defense player travel and old enemy speed configuration',()=>{
  const legacy=CatharsisConfigSchema.parse({...carnivalOptions.catharsis.balance,defenseMode:false,defenseMotionVersion:undefined,
    gruntSpeed:.25,heavySpeed:.12,groupSize:1});
  expect(legacy.gruntSpeed).toBe(.25);expect(legacy.heavySpeed).toBe(.12);
  const sim=new Simulation({...carnivalOptions,catharsis:undefined,level:{id:'legacy',length:100,enemyGroups:[],upgradeGates:[]}});
  sim.step(1,{targetX:0},{...pilotTuning,forwardSpeed:.6});expect(sim.getState().player.z).toBe(.6);expect(sim.getState().defenseWaves).toBeUndefined();
});
