import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation } from '../src/simulation/Simulation';
import { emptyGrenade, grenadeTarget, placeGrenadeSupply, enemiesInBlast } from '../src/simulation/grenade';
const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = () => new Simulation({ seed: 17, level: { id: 'grenade', length: 1000, enemyGroups: [], upgradeGates: [] },
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { ...config.player, trackHalfWidth: 3.2, defenseLineOffset: 1.5, normalEnemyRadius: .3,
  bossRadius: 2, forwardSpeed: 0, rifle: config.weapon.rifle, rocket: config.weapon.rocket };
const held = () => ({ ...emptyGrenade(), lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0, inventory: 1 as const });
it('authors the four-unit blast without changing single-target damage or supply/flight values', () => {
  expect(balance.grenade).not.toHaveProperty('throwRange');
  expect(balance.grenade).toMatchObject({ blastRadius: 4, damageEnemyHp: 9, capacity: 3,
    flightSeconds: .65, supplyPressureDepth: 24, supplyDelaySeconds: 8, supplyHitsRequired: 10 });
});
function armed() {
  const sim = make(), s = sim.getState(); s.grenade = held();
  s.weapons.rifleCooldownRemainingSeconds = 100;
  s.enemies = [
    { id: 1, archetype: 'grunt' as const, tier: 1, lane: 2, x: 0, z: 10, hp: 1 },
    { id: 2, archetype: 'heavy' as const, tier: 1, lane: 3, x: 1.4, z: 10, hp: 15 },
    { id: 3, archetype: 'giant' as const, tier: 1, lane: 1, x: -1.4, z: 10, hp: 172 },
  ];
  s.giantEncounter = { scheduledAtSeconds: 0, spawned: true }; sim.restoreState(s); return sim;
}
function ticks(sim: Simulation, count: number) { for (let i = 0; i < count; i++) sim.step(1/60, { targetX: 0 }, tuning); }
it('spends three charges sequentially, blocks overlapping flights, and restores reserves in flight', () => {
  const sim=armed(),s=sim.getState();s.grenade!.inventory=3;sim.restoreState(s);
  for(const reserve of [2,1,0]) {
    sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
    expect(sim.getState().grenade!.inventory).toBe(reserve);
    const clone=make();clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
    expect(clone.getState()).toEqual(sim.getState());
    for(let tick=0;tick<37;tick++) {
      sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
      clone.step(1/60,{targetX:0,throwGrenade:true},tuning);
      expect(sim.getState().grenade!.inventory).toBe(reserve);
    }
    ticks(sim,1);ticks(clone,1);expect(clone.getState()).toEqual(sim.getState());
    expect(sim.getState().grenade!.flight).toBeNull();
    expect(sim.consumeGrenadeEvents().filter(e=>e.kind==='grenadeDetonated')).toHaveLength(1);
  }
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
  expect(sim.getState().grenade!.inventory).toBe(0);expect(sim.getState().grenade!.flight).toBeNull();
});
it.each([0,1,2,3])('restores inventory %s and spends one charge for an empty-field throw', inventory => {
  const sim=armed(),s=sim.getState();s.grenade!.inventory=inventory;s.enemies=[];sim.restoreState(s);
  const clone=make();clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning);clone.step(1/60,{targetX:0,throwGrenade:true},tuning);
  expect(sim.getState()).toEqual(clone.getState());expect(sim.getState().grenade!.inventory).toBe(Math.max(0,inventory-1));
  expect(sim.getState().grenade!.flight?.targetZ).toBe(inventory ? 14 : undefined);
  expect(make().getState().grenade).toEqual(emptyGrenade());
});

it('lands an empty-field throw at the fixed center, with no XP, retargeting or duplicate consumption',()=>{
  const sim=armed(),s=sim.getState();s.enemies=[];s.grenade!.inventory=3;s.player.x=2.8;s.player.selectedLane=4;sim.restoreState(s);
  expect(grenadeTarget(s,balance.grenade)).toEqual({anchorId:null,x:0,z:14});
  sim.step(1/60,{targetX:2.8,throwGrenade:true},tuning);
  const saved=sim.getState(),clone=make();clone.restoreState(JSON.parse(JSON.stringify(saved)));
  for(let i=0;i<37;i++){sim.step(1/60,{targetX:-2.8,throwGrenade:true},tuning);clone.step(1/60,{targetX:-2.8,throwGrenade:true},tuning);}
  expect(sim.getState().grenade!.inventory).toBe(2);expect(sim.getState().grenade!.flight).toMatchObject({targetX:0,targetZ:14});
  ticks(sim,1);ticks(clone,1);expect(sim.getState()).toEqual(clone.getState());
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeDetonated',x:0,z:14,radius:4,victims:[]}]);
  expect(sim.getState().progression).toEqual(s.progression);ticks(sim,90);expect(sim.consumeGrenadeEvents()).toEqual([]);
});

it('restores historical config without an empty-field depth and preserves already captured flights',()=>{
  const sim=armed(),s=sim.getState();s.enemies=[];
  delete (s.catharsis!.balance.grenade as Partial<typeof balance.grenade>).emptyFieldDepth;
  sim.restoreState(JSON.parse(JSON.stringify(s)));
  expect(sim.getState().catharsis!.balance.grenade.emptyFieldDepth).toBe(14);
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
  const flying=sim.getState();flying.catharsis!.balance.grenade.emptyFieldDepth=20;
  sim.restoreState(JSON.parse(JSON.stringify(flying)));
  expect(sim.getState().grenade!.flight!.targetZ).toBe(14);
});

it('damages a real enemy entering an initially empty landing area exactly once',()=>{
  const sim=armed(),s=sim.getState();s.enemies=[];sim.restoreState(s);
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning);ticks(sim,20);
  const entered=sim.getState();entered.enemies=[{id:9,archetype:'grunt',tier:1,lane:2,x:0,z:14,hp:1}];sim.restoreState(entered);
  expect(sim.getState().grenade!.flight).toMatchObject({targetX:0,targetZ:14});ticks(sim,18);
  expect(sim.getState().enemies).toEqual([]);expect(sim.getState().progression!.xp).toBe(s.progression!.xp+1);
  const blast=sim.consumeGrenadeEvents();expect(blast).toHaveLength(1);expect(blast[0]).toMatchObject({kind:'grenadeDetonated',victims:[{id:9,killed:true,killXp:1}]});
  const after=sim.getState();sim.restoreState(JSON.parse(JSON.stringify(after)));ticks(sim,60);
  expect(sim.consumeGrenadeEvents()).toEqual([]);expect(sim.getState().progression).toEqual(after.progression);
});
it('schedules from the actual Lv3 crossing, then spawns at eight seconds even without further XP', () => {
  const sim = make(), s = sim.getState(); s.progression = { level: 2, xp: 59 };
  s.enemies = [{id:1,archetype:'grunt',tier:1,lane:2,x:0,z:1,hp:1}]; sim.restoreState(s);
  sim.step(1/60,{targetX:0},tuning); const entered = sim.getState().grenade!.lv3EnteredAtSeconds!;
  expect(entered).toBe(1/60); ticks(sim,479); expect(sim.getState().grenade!.supply).toBeNull();
  const quiet=sim.getState();quiet.projectiles=[];quiet.weapons.rifleCooldownRemainingSeconds=100;
  quiet.weapons.rifleMemberCooldowns=[100];sim.restoreState(quiet);
  ticks(sim,1); const g = sim.getState().grenade!;
  expect(g.supplySpawnedAtSeconds! - entered).toBeCloseTo(8); expect(g.supply).not.toBeNull();
  expect(sim.getState().progression).toEqual({level:3,xp:0});
  expect(make().getState().grenade).toEqual(emptyGrenade());
});
it('chooses a nearby clear lane and places supply ahead of the nearest same-lane obstruction', () => {
  const s = make().getState();
  s.enemies = [0,1,2,3,4].map((lane) => ({ id:lane+1, tier:1,archetype:'heavy',lane,x:(lane-2)*1.4,z:lane===3?12:7,hp:15 }));
  const supply = placeGrenadeSupply(s,balance.grenade);
  expect(supply.lane).toBe(3); expect(supply.depth).toBe(10.75);
});
it('keeps the supply-only pressure window unchanged without limiting throw targets', () => {
  const s=make().getState();
  s.enemies=[{id:1,tier:1,archetype:'heavy',lane:2,x:0,z:25,hp:15}];
  expect(placeGrenadeSupply(s,balance.grenade).lane).toBe(2);
  s.enemies[0].z=24;
  expect(placeGrenadeSupply(s,balance.grenade).lane).toBe(1);
  expect(grenadeTarget(s,balance.grenade)!.anchorId).toBe(1);
});
it('preserves an historical one-hit supply, consumes its Rifle hit, and fills three charges once across Lv4', () => {
  const sim = make(), s = sim.getState(); s.progression = {level:4,xp:0};
  s.grenade = {...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,supply:{lane:2,x:0,depth:8}};
  sim.restoreState(s); ticks(sim,20);
  expect(sim.getState().grenade!.inventory).toBe(3); expect(sim.getState().grenade!.supply).toBeNull();
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]); ticks(sim,600);
  expect(sim.consumeGrenadeEvents()).toEqual([]); expect(sim.getState().squad.count).toBe(1);
  expect(sim.getState().streamRewards).toEqual([]);
});
it('centers the nearest global cluster with stable ID ties and a fixed capture', () => {
  const sim=armed(),s=sim.getState(); s.enemies.push({id:4,tier:1,archetype:'grunt',lane:2,x:0,z:4,hp:1});
  expect(grenadeTarget(s,balance.grenade)).toEqual({anchorId:4,x:0,z:4});
  s.enemies=[{...s.enemies[0],id:8,x:2.8},{...s.enemies[0],id:7,x:-2.8}];
  expect(grenadeTarget(s,balance.grenade)).toEqual({anchorId:7,x:-2.8,z:10});
  s.enemies.reverse();expect(grenadeTarget(s,balance.grenade)!.anchorId).toBe(7);
  s.player.selectedLane=4;expect(grenadeTarget(s,balance.grenade)!.anchorId).toBe(7);
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning); const f=sim.getState().grenade!.flight!;
  sim.stepLane(1); ticks(sim,20);expect(sim.getState().grenade!.flight!.targetZ).toBe(f.targetZ);
});
it('does not activate after death, with or without enemies', () => {
  for(const mode of ['empty','enemies']) {
    const sim=armed(),s=sim.getState();
    if(mode==='empty')s.enemies=[];
    s.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};
    sim.restoreState(s);sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
    expect(sim.getState().grenade!.inventory).toBe(1);expect(sim.getState().grenade!.flight).toBeNull();
  }
});
it('detonates after 39 ticks: kills Grunt, leaves Heavy at 6 and Giant at 163, awarding only lethal XP', () => {
  const sim=armed();sim.step(1/60,{targetX:0,throwGrenade:true},tuning);ticks(sim,37);
  expect(sim.getState().enemies).toHaveLength(3); ticks(sim,1);
  expect(sim.getState().enemies.map(e=>e.hp)).toEqual([6,163]);expect(sim.getState().progression!.xp).toBe(1);
  const event=sim.consumeGrenadeEvents()[0];expect(event.kind).toBe('grenadeDetonated');
  if(event.kind==='grenadeDetonated')expect(event.victims.map(v=>v.id)).toEqual([1,2,3]);
  ticks(sim,60);expect(sim.getState().progression!.xp).toBe(1);expect(sim.consumeGrenadeEvents()).toEqual([]);
});
it('shares multi-kill XP overflow and squad rewards, including a wounded Heavy', () => {
  const sim=armed(),s=sim.getState(); s.progression={level:3,xp:100};
  s.enemies=[...Array.from({length:8},(_,i)=>({id:i+1,tier:1,archetype:'grunt' as const,lane:2,x:0,z:10+i*.05,hp:1})),
    {id:9,tier:1,archetype:'heavy',lane:3,x:1.4,z:10,hp:9}];
  sim.restoreState(s);sim.step(1/60,{targetX:0,throwGrenade:true},tuning);ticks(sim,38);
  expect(sim.getState().enemies).toHaveLength(0);expect(sim.getState().progression).toEqual({level:4,xp:8});
  expect(sim.getState().squad.count).toBe(2);ticks(sim,60);expect(sim.getState().progression!.xp).toBe(8);
});
it.each(['pending','spawned','held','flight'] as const)('restores %s identically and isolates snapshot data/events',phase=>{
  const sim=armed(),s=sim.getState();
  if(phase==='pending')s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0};
  if(phase==='spawned')s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,supply:{lane:2,x:0,depth:6}};
  sim.restoreState(s);if(phase==='flight')sim.step(1/60,{targetX:0,throwGrenade:true},tuning);
  const snapshot=JSON.parse(JSON.stringify(sim.getState())),clone=make(); clone.restoreState(snapshot);
  snapshot.grenade.inventory=0;
  expect(clone.getState()).toEqual(sim.getState());
  ticks(sim,600);ticks(clone,600);expect(clone.getState()).toEqual(sim.getState());
  clone.restoreState(clone.getState());expect(clone.consumeGrenadeEvents()).toEqual([]);
});
it('rejects corrupt lifecycle/config and future snapshot clocks',()=>{
  const sim=armed();
  for(const patch of [{inventory:4},{inventory:1,acquiredAtSeconds:null},{acquiredAtSeconds:10},{supplySpawnedAtSeconds:null}]) {
    const s=sim.getState();Object.assign(s.grenade!,patch);expect(()=>sim.restoreState(s)).toThrow();
  }
  for(const patch of [{capacity:4},{damageEnemyHp:0},{flightSeconds:0},{blastRadius:-1},{supplyHitsRequired:0},{supplyHitsRequired:1.5}])
    expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,grenade:{...data.catharsis.grenade,...patch}}})).toThrow();
});

it('uses inclusive circular distance without falloff and excludes entities outside the circle',()=>{
  const sim=armed(),s=sim.getState();
  s.catharsis!.balance.heavySpeed=0;
  s.grenade!.inventory=0;s.grenade!.flight={startX:0,startZ:0,targetX:0,targetZ:10,startedAtSeconds:0,
    flightSeconds:1/60,damageEnemyHp:9,blastRadius:4};
  s.enemies=[0,4,4.001].map((x,i)=>({id:i+1,tier:1,archetype:'heavy',lane:2,x,z:10,hp:15}));
  s.enemies.push({id:4,tier:1,archetype:'heavy',lane:2,x:3,z:13,hp:15});
  sim.restoreState(s);ticks(sim,1);expect(sim.getState().enemies.map(e=>e.hp)).toEqual([6,6,15,15]);
});
it('does not award the same victim twice when a Rifle and detonation resolve in one tick',()=>{
  const sim=armed(),s=sim.getState();s.enemies=s.enemies.slice(0,1);
  s.grenade!.inventory=0;s.grenade!.flight={startX:0,startZ:0,targetX:0,targetZ:10,startedAtSeconds:0,
    flightSeconds:1/60,damageEnemyHp:9,blastRadius:4};
  s.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,slopeX:0,x:0,z:9.5,speed:60,damage:3,remainingRange:20,
    blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];s.weapons.nextProjectileId=2;
  sim.restoreState(s);ticks(sim,1);expect(sim.getState().progression!.xp).toBe(1);
  const event=sim.consumeGrenadeEvents()[0];if(event.kind==='grenadeDetonated')expect(event.victims).toEqual([]);
});

it('awards every expanded crowd victim once through ordinary XP overflow', () => {
  const sim=armed(),s=sim.getState();s.progression={level:3,xp:100};
  s.enemies=Array.from({length:32},(_,i)=>({id:32-i,tier:1,archetype:'grunt' as const,
    lane:i%5,x:(i%5-2)*.9,z:10+Math.floor(i/5)*.15,hp:1}));
  sim.restoreState(s);sim.step(1/60,{targetX:0,throwGrenade:true},tuning);ticks(sim,38);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().progression).toEqual({level:4,xp:22});
  const event=sim.consumeGrenadeEvents()[0];
  expect(event.kind).toBe('grenadeDetonated');
  if(event.kind==='grenadeDetonated') {
    expect(event.victims.map(v=>v.id)).toEqual(Array.from({length:32},(_,i)=>i+1));
    expect(event.victims.reduce((sum,v)=>sum+v.killXp,0)).toBe(32);
  }
  ticks(sim,60);expect(sim.getState().progression).toEqual({level:4,xp:22});
});

it('clears the smaller near emergency instead of a dense distant selected-lane crowd', () => {
  const sim=armed(),s=sim.getState();
  const near=[{id:1,tier:1,archetype:'grunt' as const,lane:0,x:-2.8,z:2.5,hp:1},
    {id:2,tier:1,archetype:'grunt' as const,lane:1,x:-1.4,z:3,hp:1},
    {id:3,tier:1,archetype:'grunt' as const,lane:0,x:-2.8,z:3.5,hp:1}];
  const far=Array.from({length:30},(_,i)=>({id:4+i,tier:1,archetype:'grunt' as const,lane:2,x:0,z:14+i*.02,hp:1}));
  s.enemies=[...far,...near];s.player.selectedLane=2;
  const target=grenadeTarget(s,balance.grenade)!;
  expect(target.anchorId).toBe(1);expect(target.x).toBeCloseTo(-7/3);expect(target.z).toBe(3);
  expect(enemiesInBlast(s.enemies,target.x,target.z,4).map(e=>e.id)).toEqual([1,2,3]);
  sim.restoreState(s);sim.step(1/60,{targetX:0,throwGrenade:true},tuning);ticks(sim,38);
  const blast=sim.consumeGrenadeEvents().find(e=>e.kind==='grenadeDetonated')!;
  expect(blast.kind==='grenadeDetonated' && blast.victims.map(e=>e.id)).toEqual([1,2,3]);
  expect(sim.getState().enemies.map(e=>e.id)).toEqual(far.map(e=>e.id));
  expect(sim.getState().progression!.xp).toBe(3);
});

it.each([0,-.1,.1,10,24,38,44,47])('keeps a living emergency at relative depth %s eligible even outside the selected lane', depth => {
  const s=make().getState();s.player.z=12;s.player.selectedLane=4;
  s.enemies=[{id:1,tier:1,archetype:'grunt',lane:0,x:-2.8,z:12+depth,hp:1}];
  expect(grenadeTarget(s,balance.grenade)).toEqual({anchorId:1,x:-2.8,z:12+depth});
});

it('excludes dead and legacy entities and retains the urgent position inside an unweighted local centroid', () => {
  const s=make().getState();s.enemies=[{id:1,tier:1,archetype:'grunt',lane:0,x:0,z:0,hp:1},
    {id:2,tier:1,archetype:'heavy',lane:1,x:3,z:1,hp:15},
    {id:3,tier:1,archetype:'giant',lane:1,x:4,z:0,hp:172},
    {id:4,tier:1,x:0,z:0,hp:100},{id:5,tier:1,archetype:'grunt',x:0,z:0,hp:0}];
  const target=grenadeTarget(s,balance.grenade)!;
  expect(target).toEqual({anchorId:1,x:7/3,z:1/3});
  expect(enemiesInBlast(s.enemies,target.x,target.z,4).map(e=>e.id)).toContain(1);
  const ordinary=target;s.enemies.reverse();expect(grenadeTarget(s,balance.grenade)).toEqual(ordinary);
});

it('prioritizes a still-living enemy just past player Z over one still approaching it', () => {
  const s=make().getState();s.enemies=[
    {id:1,tier:1,archetype:'grunt',lane:4,x:2.8,z:.01,hp:1},
    {id:2,tier:1,archetype:'grunt',lane:0,x:-2.8,z:-.1,hp:1}];
  expect(grenadeTarget(s,balance.grenade)).toEqual({anchorId:2,x:-2.8,z:-.1});
});

it('damages a surviving Heavy only once when a Rifle and blast resolve together', () => {
  const sim=armed(),s=sim.getState();s.enemies=[s.enemies[1]];
  s.grenade!.inventory=0;s.grenade!.flight={startX:0,startZ:0,targetX:1.4,targetZ:10,
    startedAtSeconds:0,flightSeconds:1/60,damageEnemyHp:9,blastRadius:4};
  s.projectiles=[{id:1,kind:'rifle',tier:1,lane:3,slopeX:0,x:1.4,z:9.5,speed:60,
    damage:config.tiers.tier1Power,remainingRange:20,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  s.weapons.nextProjectileId=2;sim.restoreState(s);ticks(sim,1);
  expect(sim.getState().enemies[0].hp).toBe(5);expect(sim.getState().progression!.xp).toBe(0);
  ticks(sim,10);expect(sim.getState().enemies[0].hp).toBe(5);
});
