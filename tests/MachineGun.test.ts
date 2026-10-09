import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { progressionStage, grantXp } from '../src/simulation/progression';
import { controlledSimulation, comparePrimary } from '../scripts/qa/p2aComparison';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { projectRenderState } from '../src/app/projectRenderState';
const config=GameConfigSchema.parse(data), balance=config.catharsis!;
const step=(sim:ReturnType<typeof controlledSimulation>, ticks=1)=>{for(let i=0;i<ticks;i++)sim.step(1/60,{targetX:0},pilotTuning);};

it('authors eight explicit stages, unchanged Rifle progression and a 220 XP family boundary',()=>{
  expect(balance.progression.xpRequirements).toEqual([28,60,110,180,220,200,300]);
  expect(balance.progression.levelPlan.map(p=>[p.weaponFamily,p.fireRateStage,p.squadStage])).toEqual([
    ['rifle',1,1],['rifle',2,1],['rifle',3,1],['rifle',3,2],['rifle',3,3],['machineGun',1,1],['machineGun',1,2],['machineGun',1,3]]);
  expect(balance.machineGun).toEqual({fireRate:18,projectileSpeed:60,range:80,damageEnemyHp:1});
  expect(grantXp({level:5,xp:219},1,balance.progression)).toEqual({level:6,xp:0});
  expect(grantXp({level:1,xp:0},100000,balance.progression)).toEqual({level:8,xp:0});
});
it('validates relational plan length and family-local stage progression',()=>{
  const source=structuredClone(data);
  source.catharsis.progression.levelPlan.pop();source.catharsis.progression.xpRequirements.pop();
  expect(GameConfigSchema.parse(source).catharsis!.progression.levelPlan).toHaveLength(7);
  source.catharsis.progression.xpRequirements.pop();expect(()=>GameConfigSchema.parse(source)).toThrow();
  for (const patch of [ {weaponFamily:'rocket'}, {weaponFamily:'rifle',squadStage:1}, {fireRateStage:2} ]) {
    const bad=structuredClone(data);Object.assign(bad.catharsis.progression.levelPlan[5],patch);
    expect(()=>GameConfigSchema.parse(bad)).toThrow();
  }
});
it.each([1,2,3])('evolves %i living Rifle soldiers once without casualties, retaining Grenade and clearing stale volleys',count=>{
  const sim=controlledSimulation(5), state=sim.getState();state.progression!.xp=219;
  state.squad={count,rocketCount:0,rifleCounts:[count],rifleRemainder:0};state.weapons.rifleMemberCooldowns=Array(count).fill(.1);
  state.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:1,supply:null,flight:null};
  state.enemies=[{id:1,tier:1,archetype:'grunt',lane:2,x:0,z:3,hp:1}];
  state.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,memberIndex:0,slopeX:0,x:0,z:2.5,speed:60,
    damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  state.weapons.nextProjectileId=2;sim.restoreState(state);
  const clone=controlledSimulation(5);clone.restoreState(JSON.parse(JSON.stringify(state)));
  step(sim);step(clone);expect(clone.getState()).toEqual(sim.getState());
  const evolved=sim.getState();expect(evolved.progression).toEqual({level:6,xp:0});
  expect(evolved.squad).toEqual({count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0});
  expect(evolved.projectiles).toHaveLength(0);expect(evolved.weapons.rifleMemberCooldowns).toEqual([1/18]);
  expect(sim.consumePresentationEvents()).toEqual([]);expect(evolved.grenade!.inventory).toBe(1);
  clone.restoreState(JSON.parse(JSON.stringify(evolved)));step(sim,180);step(clone,180);
  expect(clone.getState()).toEqual(sim.getState());
  expect(projectRenderState(sim.getFrameState(),{catharsis:sim.getFrameState().catharsis,trackHalfWidth:3.2,
    formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7}).squad.weaponFamily).toBe('machineGun');
});
it('crosses several stages in a burst Grenade kill grant and produces one coherent specialist',()=>{
  const sim=controlledSimulation(5),s=sim.getState();s.progression={level:3,xp:109};
  s.catharsis!.balance.progression.gruntKillXp=100; // A large ordinary kill reward exercises repeated overflow.
  s.squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};s.weapons.rifleMemberCooldowns=[10];
  s.enemies=Array.from({length:5},(_,i)=>({id:i+1,tier:1,archetype:'grunt' as const,lane:2,x:0,z:12+i*.1,hp:1}));
  s.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:0,supply:null,
    flight:{startX:0,startZ:0,targetX:0,targetZ:12,startedAtSeconds:0,flightSeconds:1/60,damageEnemyHp:9,blastRadius:4}};
  sim.restoreState(s);step(sim);
  expect(sim.getState().progression).toEqual({level:6,xp:99});expect(sim.getState().squad.count).toBe(1);
  expect(sim.consumePresentationEvents()).toEqual([]);expect(sim.consumeGrenadeEvents()[0]).toMatchObject({kind:'grenadeDetonated'});
  step(sim,60);expect(sim.getState().squad.count).toBe(1);
});
it('shares lane collisions, one-hit damage and bounded primary projectile semantics',()=>{
  const sim=controlledSimulation(6);step(sim);const bullet=sim.getState().projectiles[0];
  expect(bullet).toMatchObject({kind:'machineGun',tier:1,lane:2,speed:60,damage:config.tiers.tier1Power,
    blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0});
  expect(bullet.remainingRange).toBeCloseTo(79);
  const s=sim.getState();s.enemies=[{id:1,tier:1,archetype:'heavy',lane:2,x:0,z:3,hp:15},
    {id:2,tier:1,archetype:'grunt',lane:1,x:-1.4,z:3,hp:1}];
  s.projectiles=[{...bullet,x:0,z:2.5}];s.weapons.rifleMemberCooldowns=[10];sim.restoreState(s);step(sim);
  expect(sim.getState().enemies.map(e=>e.hp)).toEqual([14,1]);
  const giant=sim.getState();giant.enemies[0]={...giant.enemies[0],archetype:'giant',hp:172};
  giant.giantEncounter={scheduledAtSeconds:0,spawned:true};giant.projectiles=[{...bullet,id:2,x:0,z:2.5}];giant.weapons.nextProjectileId=3;sim.restoreState(giant);step(sim);
  expect(sim.getState().enemies[0].hp).toBe(171);
});
it('improves cadence, Grunt pack clear and fifteen-hit Heavy TTK over Lv5',()=>{
  const rifle=comparePrimary(5),mg=comparePrimary(6);
  expect(rifle.shotsPerSecond).toBe(13.5);expect(mg.shotsPerSecond).toBe(18);
  expect(mg.grunts.kills).toBe(30);expect(mg.grunts.seconds).toBeLessThan(rifle.grunts.seconds);
  expect(mg.heavy.focusedSeconds).toBeLessThan(rifle.heavy.focusedSeconds);
  expect(mg.heavy.focusedSeconds).toBeGreaterThan(.7);expect(mg.heavy.focusedSeconds).toBeLessThan(.85);
});
it('keeps reinforcement deferred and isolated no-stream MG measurements free of Giant',()=>{
  expect(balance.giant.unlockLevel).toBe(5);const sim=controlledSimulation(6);step(sim,60*20);
  expect(sim.getState().giantEncounter).toEqual({scheduledAtSeconds:null,spawned:false});
  expect(sim.getState().reinforcement).toEqual({startedAtSeconds:null,arrived:false});
  expect(progressionStage(6,balance.progression).weaponFamily).toBe('machineGun');
});

it('evolves coherently if a live XP threshold edit crosses the family boundary',()=>{
 const sim=controlledSimulation(5),s=sim.getState();s.progression!.xp=210;sim.restoreState(s);
 sim.setCatharsisBalance({...balance,progression:{...balance.progression,xpRequirements:[28,60,110,180,200,200,300]}});
 expect(sim.getState().progression).toEqual({level:6,xp:10});expect(sim.getState().squad.count).toBe(1);
 expect(sim.getState().weapons.rifleMemberCooldowns).toEqual([1/18]);expect(sim.consumePresentationEvents()).toEqual([]);
 expect(()=>sim.restoreState(JSON.parse(JSON.stringify(sim.getState())))).not.toThrow();
});
it('ordinary burst Grenade rewards cross Lv5 to Lv6 with overflow exactly once',()=>{
 const sim=controlledSimulation(5),s=sim.getState();s.progression!.xp=215;
 s.enemies=Array.from({length:12},(_,i)=>({id:i+1,tier:1,archetype:'grunt' as const,lane:2,x:0,z:12+i*.1,hp:1}));
 s.weapons.rifleCooldownRemainingSeconds=10;s.weapons.rifleMemberCooldowns=[10,10,10];
 s.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:0,supply:null,
 flight:{startX:0,startZ:0,targetX:0,targetZ:12,startedAtSeconds:0,flightSeconds:1/60,damageEnemyHp:9,blastRadius:4}};
 sim.restoreState(s);step(sim);expect(sim.getState().progression).toEqual({level:6,xp:7});expect(sim.getState().squad.count).toBe(1);
 const event=sim.consumeGrenadeEvents().find(e=>e.kind==='grenadeDetonated')!;
 expect(event.kind==='grenadeDetonated' && event.victims.reduce((sum,v)=>sum+v.killXp,0)).toBe(12);
 step(sim,120);expect(sim.getState().squad.count).toBe(1);expect(sim.consumeGrenadeEvents()).toEqual([]);
});

it('MG projectile kills share ordinary one-time XP even with concurrent Rifle damage',()=>{
 const sim=controlledSimulation(6),s=sim.getState();s.progression={level:5,xp:0};
 s.enemies=[{id:1,tier:1,archetype:'grunt',lane:2,x:0,z:3,hp:1}];
 s.weapons.rifleCooldownRemainingSeconds=10;s.weapons.rifleMemberCooldowns=[10];
 const shot={tier:1,lane:2,memberIndex:0,slopeX:0,x:0,z:2.5,speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0};
 s.projectiles=[{...shot,id:1,kind:'machineGun'},{...shot,id:2,kind:'rifle'}];s.weapons.nextProjectileId=3;
 sim.restoreState(s);step(sim);expect(sim.getState().enemies).toHaveLength(0);expect(sim.getState().progression!.xp).toBe(1);
 step(sim,120);expect(sim.getState().progression!.xp).toBe(1);
});
