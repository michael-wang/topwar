import {expect,it} from 'vitest';
import config from './helpers/ShippingConfig';
import oldData from './fixtures/pre-b6b4-game.json';
import {GameConfigSchema} from '../src/config/configSchema';
import levelData from '../public/game-data/levels/level-001.json';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {Simulation} from '../src/simulation/Simulation';
import {createTankPlaytest} from '../src/app/TankPlaytest';
import {createSurvivalReview} from '../src/app/DevSurvivalReview';
import {qaSimulationTuning} from '../src/app/QaStressFixture';
import {createDefenseSquadFormation} from '../src/simulation/squad/formation';
import {encounterProgression,grantXp,survivingCasualtySetback} from '../src/simulation/progression';
import {advanceDefenseWaves} from '../src/simulation/enemies/defenseWaves';
import {SHELL_REVIEW_SOURCE} from './helpers/ShellReview';
const level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(config);
const options={seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
  catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}};
function make(lv=10,count=lv-7,legacy=false){
  const sim=lv>=9?createTankPlaytest(options,config.weapon.rifle.fireRate,false):new Simulation(options);
  const s=sim.getState();s.progression={level:lv,xp:lv===12?0:17};s.squad={count,rifleCounts:[count],rocketCount:0,rifleRemainder:0};
  s.enemies=[];s.projectiles=[];s.weapons.rifleMemberCooldowns=Array.from({length:count},(_,i)=>.02+i*.003);
  s.weapons.rifleCooldownRemainingSeconds=.02;s.defenseWaves!.nextAtSeconds=1000;
  if(legacy)delete s.catharsis!.balance.progression.casualtySetback;
  if(s.defenseTank)s.defenseTank.nextAttackAtSeconds=s.defenseTank.nextFlankAtSeconds=s.defenseTank.nextGiantAtSeconds=1000;
  sim.restoreState(s);return sim;
}
function casualty(sim:Simulation,source:'contact'|'breach'|'shell'='breach',amount=1){
  if(source==='shell'){
    for(let i=0;i<amount;i++)sim.launchArtillery({source:{...SHELL_REVIEW_SOURCE,position:{x:-3,y:1.2,z:8}}});
    for(let i=0;i<31;i++)sim.step(1/60,{targetX:0},tuning);
  }else{
    const s=sim.getState(),p=createDefenseSquadFormation(s.squad.count,tuning.formationSpacing,s.catharsis!.balance.progression)[0];
    for(let i=0;i<amount;i++)s.enemies.push({id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,archetype:'heavy',hp:15,
      x:source==='contact'?p.x:3,z:source==='contact'?p.z:-10});
    sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);
  }
}
function killHeavy(sim:Simulation){
  const s=sim.getState();s.combatStats!.shotsFired++;s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z:3,archetype:'heavy',hp:1}];
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'machineGun',tier:1,memberIndex:0,lane:2,slopeX:0,x:0,z:2.5,
    speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);
}
it.each(['contact','breach','shell'] as const)('one surviving %s removes one member, one combat level and all XP',source=>{
  const sim=make(),before=sim.getState();casualty(sim,source);const s=sim.getState();
  expect(s.squad.count).toBe(2);expect(s.progression).toEqual({level:9,xp:0,pressure:{level:10,xp:17}});
  expect(s.defenseTank!.startedAtSeconds).toBe(before.defenseTank!.startedAtSeconds);
  expect(s.defenseTank!.rngState).toBe(before.defenseTank!.rngState);
  expect(s.machineGunReleaseAtSeconds).toBe(before.machineGunReleaseAtSeconds);
  expect(s.defenseWaves).toEqual(before.defenseWaves);expect(s.rngState).toBe(before.rngState);
  const restored=make();restored.restoreState(s);expect(restored.getState()).toEqual(s);
});
it.each([[5,3,4,2],[4,2,3,1],[9,2,8,1],[11,4,10,3],[12,5,11,4]])('Lv%i/%i becomes Lv%i/%i', (lv,count,next,members)=>{
  const sim=make(lv,count);casualty(sim);expect(sim.getState().progression!.level).toBe(next);expect(sim.getState().progression!.xp).toBe(0);
  expect(sim.getState().squad.count).toBe(members);sim.restoreState(sim.getState());
});
it('applies clustered casualties individually, preserves survivor clocks and never replays latched encounters',()=>{
  const sim=make(12,5),control=make(12,5),before=sim.getState();casualty(sim,'breach',3);control.step(1/60,{targetX:0},tuning);
  const s=sim.getState();expect(s.progression).toEqual({level:9,xp:0,pressure:{level:12,xp:0}});
  expect(s.squad.count).toBe(2);expect(s.weapons.rifleMemberCooldowns).toEqual(control.getState().weapons.rifleMemberCooldowns!.slice(3));
  expect(s.levelEncounters).toEqual(before.levelEncounters);expect(s.giantEncounter).toEqual(before.giantEncounter);
  expect(s.postCapSurvival).toEqual(before.postCapSurvival);
});
it.each([1,6,7,8])('the final Lv%i member dies without a downgrade revival',lv=>{
  const sim=make(lv,1);casualty(sim);const dead=sim.getState();expect(dead.squad.count).toBe(0);expect(dead.progression!.level).toBe(lv);
  sim.step(1/60,{targetX:0},tuning);expect(sim.getState()).toEqual(dead);sim.restoreState(dead);
});
it('requires the full 450 XP to regain Lv10 and the third MG, without lowering Lv10 pressure',()=>{
  const sim=make();casualty(sim);
  for(let i=0;i<44;i++)killHeavy(sim);
  expect(sim.getState().progression).toEqual({level:9,xp:440,pressure:{level:10,xp:17}});expect(sim.getState().squad.count).toBe(2);
  killHeavy(sim);expect(sim.getState().progression).toEqual({level:10,xp:0,pressure:{level:10,xp:17}});expect(sim.getState().squad.count).toBe(3);
  killHeavy(sim);killHeavy(sim);expect(encounterProgression(sim.getState().progression!)).toEqual({level:10,xp:20});
});
it.each([false,true])('retains all future wave properties and Lv8 XP-lookahead through restoration (ahead=%s)',ahead=>{
  const sim=createSurvivalReview(options,config.weapon.rifle.fireRate,ahead?'survival8-ahead':'survival10-ahead');
  const original=sim.getState();original.progression!.xp=ahead?245:0;original.enemies=[];
  original.catharsis!.balance.postCapSurvival=structuredClone(config.catharsis!.postCapSurvival);
  const injured=structuredClone(original);injured.progression=survivingCasualtySetback(original.progression!);
  if(!ahead){injured.squad={count:2,rifleCounts:[2],rocketCount:0,rifleRemainder:0};injured.weapons.rifleMemberCooldowns!.splice(0,1);}
  // Authoritative peak survives a real checkpoint round trip independently of combat power.
  sim.restoreState(injured);const after=sim.getState();
  const now=original.defenseWaves!.nextAtSeconds;
  original.defenseWaves=advanceDefenseWaves(original.defenseWaves!,original,now,17,true);
  after.defenseWaves=advanceDefenseWaves(after.defenseWaves!,after,now,17,true);
  expect(after.enemies).toEqual(original.enemies);expect(after.defenseWaves).toEqual(original.defenseWaves);
  expect(after.enemyStream).toEqual(original.enemyStream);expect(after.rngState).toBe(original.rngState);
  if(ahead){expect(new Set(after.enemies.map(e=>e.lane)).size).toBe(5);expect(after.enemies.every(e=>e.survivalSpeedMultiplier===1.6)).toBe(true);}
});
it.each([8,10,12])('an embedded historical %i-level plan retains its casualty rules and cap',cap=>{
  const balance=structuredClone(cap===12?config.catharsis!:GameConfigSchema.parse(oldData).catharsis!);
  delete balance.progression.casualtySetback;
  const p=balance.progression;
  p.levelPlan=p.levelPlan.slice(0,cap);p.xpRequirements=p.xpRequirements.slice(0,cap-1);
  const sim=new Simulation({...options,catharsis:{balance,trackHalfWidth:config.track.halfWidth}}),s=sim.getState();
  s.progression={level:5,xp:17};s.squad={count:3,rifleCounts:[3],rocketCount:0,rifleRemainder:0};
  s.weapons.rifleMemberCooldowns=[.02,.03,.04];s.weapons.rifleCooldownRemainingSeconds=.02;s.enemies=[];
  sim.restoreState(s);casualty(sim);expect(sim.getState().progression).toEqual({level:5,xp:17});
  const saved=sim.getState();expect(saved.catharsis!.balance.progression.levelPlan).toHaveLength(cap);
  sim.restoreState(saved);expect(sim.getState()).toEqual(saved);
});
it('resets same-tick kill XP, keeps earned pressure and does not revive the last Rifle with a reward',()=>{
  const sim=make(),s=sim.getState();s.progression!.xp=899;
  s.enemies=[{id:s.enemyStream!.nextEnemyId++,tier:1,lane:4,x:3,z:-10,archetype:'heavy',hp:15}];
  sim.restoreState(s);killHeavyWithBreach(sim);
  expect(sim.getState().progression).toEqual({level:10,xp:0,pressure:{level:11,xp:9}});
  expect(sim.getState().squad.count).toBe(3);sim.restoreState(sim.getState());
  const rifle=make(3,1),r=rifle.getState();r.progression!.xp=109;
  r.enemies=[{id:r.enemyStream!.nextEnemyId++,tier:1,lane:4,x:3,z:-10,archetype:'heavy',hp:15}];rifle.restoreState(r);
  killHeavyWithBreach(rifle);expect(rifle.getState().squad.count).toBe(0);rifle.restoreState(rifle.getState());
});
function killHeavyWithBreach(sim:Simulation){
  const s=sim.getState();s.combatStats!.shotsFired++;
  s.enemies.push({id:s.enemyStream!.nextEnemyId++,tier:1,lane:2,x:0,z:3,archetype:'heavy',hp:1});
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'rifle',tier:1,memberIndex:0,lane:2,slopeX:0,x:0,z:2.5,
    speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);
}
it('retains XP pressure while recovering and advances it only when new progression exceeds the peak',()=>{
  const b=config.catharsis!.progression,injured=survivingCasualtySetback({level:8,xp:245});
  expect(grantXp(injured,300,b)).toEqual({level:8,xp:0,pressure:{level:8,xp:245}});
  expect(grantXp({level:8,xp:244,pressure:{level:8,xp:245}},2,b).pressure).toEqual({level:8,xp:246});
});
it('preserves old Defense casualty rules and rejects invalid or legacy-injected pressure transactionally',()=>{
  const old=make(10,3,true);casualty(old);expect(old.getState().progression).toEqual({level:10,xp:17});
  const sim=make();casualty(sim);const good=sim.getState(),outside=sim.getState();outside.progression!.pressure!.xp=18;
  expect(sim.getState()).toEqual(good);
  for(const peak of [{level:8,xp:0},{level:13,xp:0},{level:10,xp:900},{level:10,xp:-1},{level:10,xp:17,extra:0}]){
    const bad=structuredClone(good);bad.progression!.pressure=peak;expect(()=>sim.restoreState(bad)).toThrow();expect(sim.getState()).toEqual(good);
  }
  const bad=old.getState();bad.progression!.pressure={level:10,xp:17};expect(()=>old.restoreState(bad)).toThrow(/pressure/);
});
