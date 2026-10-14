import {expect,it} from 'vitest';
import config from './helpers/ShippingConfig';
import oldData from './fixtures/pre-b6b4-game.json';
import levelData from '../public/game-data/levels/level-001.json';
import {GameConfigSchema} from '../src/config/configSchema';
import {ProgressionConfigSchema} from '../src/config/progressionConfig';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {createTankPlaytest} from '../src/app/TankPlaytest';
import {Simulation} from '../src/simulation/Simulation';
import {qaSimulationTuning} from '../src/app/QaStressFixture';
import {grantXp,effectivePrimaryFireRate,requiredXp} from '../src/simulation/progression';
const level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(config);
function make(){const sim=createTankPlaytest({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
  catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},config.weapon.rifle.fireRate,false);
  const s=sim.getState();s.enemies=[];s.defenseTank!.nextAttackAtSeconds=s.defenseTank!.nextFlankAtSeconds=s.defenseTank!.nextGiantAtSeconds=1000;
  sim.restoreState(s);return sim;}
function killHeavy(sim:Simulation){const s=sim.getState();s.weapons.rifleMemberCooldowns!.fill(100);s.weapons.rifleCooldownRemainingSeconds=100;
  s.combatStats!.shotsFired++; // Account for the controlled live bullet below.
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z:3,archetype:'heavy',hp:1}];
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'machineGun',tier:1,memberIndex:0,lane:2,slopeX:0,x:0,z:2.5,
    speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);}
it('preserves the original ten stages and adds only the 900/1800 XP MG squad rewards at Stage III rate',()=>{
  const old=GameConfigSchema.parse(oldData).catharsis!.progression,b=config.catharsis!;
  expect(b.progression.levelPlan.slice(0,10)).toEqual(old.levelPlan);expect(b.progression.xpRequirements.slice(0,9)).toEqual(old.xpRequirements);
  expect(b.progression.xpRequirements.slice(9)).toEqual([900,1800]);
  expect(b.progression.levelPlan.slice(10)).toEqual([{weaponFamily:'machineGun',fireRateStage:3,squadStage:4},{weaponFamily:'machineGun',fireRateStage:3,squadStage:5}]);
  for(const lv of [10,11,12])expect(effectivePrimaryFireRate(3,lv,b)).toBe(effectivePrimaryFireRate(3,10,b));
  expect(grantXp({level:10,xp:899},1,b.progression)).toEqual({level:11,xp:0});
  expect(grantXp({level:11,xp:1799},1,b.progression)).toEqual({level:12,xp:0});
  expect(grantXp({level:9,xp:449},2702,b.progression)).toEqual({level:12,xp:0});
  expect(grantXp({level:12,xp:0},Number.MAX_SAFE_INTEGER,b.progression)).toEqual({level:12,xp:0});
  expect(()=>grantXp({level:10,xp:899},Number.MAX_SAFE_INTEGER,b.progression)).toThrow(/supported range/);
});
it('earns Lv9–12 through authoritative kills, adds one soldier at each threshold and stops accumulating at the new cap',()=>{
  const sim=make();
  for(const [kills,lv,count] of [[45,10,3],[90,11,4],[180,12,5]]){
    for(let i=0;i<kills-1;i++)killHeavy(sim);
    const before=sim.getState();expect(before.progression).toEqual({level:lv-1,xp:requiredXp(lv-1,config.catharsis!.progression)-10});
    killHeavy(sim);const s=sim.getState();expect(s.progression).toEqual({level:lv,xp:0});expect(s.squad.count).toBe(count);
    expect(s.weapons.rifleMemberCooldowns).toHaveLength(count);
  }
  killHeavy(sim);expect(sim.getState().progression).toEqual({level:12,xp:0});expect(sim.getState().squad.count).toBe(5);
});
it.each([11,12])('fires all %i-level MG members independently and restores the same deterministic clocks',lv=>{
  const sim=make(),s=sim.getState(),count=lv-7,interval=1/effectivePrimaryFireRate(config.weapon.rifle.fireRate,lv,config.catharsis!);
  s.progression={level:lv,xp:0};s.squad={count,rifleCounts:[count],rifleRemainder:0,rocketCount:0};
  s.weapons.rifleMemberCooldowns=Array.from({length:count},(_,i)=>i*interval/count);s.weapons.rifleCooldownRemainingSeconds=0;
  sim.restoreState(s);const copy=make();copy.restoreState(s);const ids=Array.from({length:count},()=>new Set<number>());
  const frozen=sim.getState();expect(sim.getState()).toEqual(frozen);
  for(let tick=0;tick<60;tick++){sim.step(1/60,{targetX:0},tuning);copy.step(1/60,{targetX:0},tuning);
    for(const p of sim.getState().projectiles)ids[p.memberIndex!].add(p.id);}
  expect(sim.getState()).toEqual(copy.getState());expect(ids.every(set=>set.size>=26&&set.size<=28)).toBe(true);
  expect(sim.getState().weapons.rifleMemberCooldowns).toHaveLength(count);
  expect(sim.getState().weapons.rifleMemberCooldowns!.every(c=>c>=0&&c<=interval)).toBe(true);
});
it('permits five MG stages but rejects extra Rifle soldiers, stage IV fire rates and unlimited levels',()=>{
  const p=config.catharsis!.progression;
  for(const change of ['rifle','rate','level','sixth'] as const){const c=structuredClone(p);
    if(change==='rifle')c.levelPlan[4].squadStage=4;
    if(change==='rate')c.levelPlan[11].fireRateStage=4;
    if(change==='sixth')c.levelPlan[11].squadStage=6;
    if(change==='level'){c.levelPlan.push({...c.levelPlan[11]});c.xpRequirements.push(1800);}
    expect(ProgressionConfigSchema.safeParse(c).success).toBe(false);
  }
});
it.each([6,8,10])('retains an embedded historical %i-level progression cap',cap=>{
  const old=GameConfigSchema.parse(oldData),p=old.catharsis!.progression;
  p.levelPlan=p.levelPlan.slice(0,cap);p.xpRequirements=p.xpRequirements.slice(0,cap-1);
  const parsed=ProgressionConfigSchema.parse(p);
  expect(grantXp({level:cap,xp:0},10000,parsed)).toEqual({level:cap,xp:0});expect(requiredXp(cap,parsed)).toBe(Infinity);
});
