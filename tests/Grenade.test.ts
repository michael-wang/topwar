import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation } from '../src/simulation/Simulation';
import { emptyGrenade, grenadeTarget, placeGrenadeSupply } from '../src/simulation/grenade';
const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = () => new Simulation({ seed: 17, level: { id: 'grenade', length: 1000, enemyGroups: [], upgradeGates: [] },
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { ...config.player, trackHalfWidth: 3.2, defenseLineOffset: 1.5, normalEnemyRadius: .3,
  bossRadius: 2, forwardSpeed: 0, rifle: config.weapon.rifle, rocket: config.weapon.rocket };
const held = () => ({ ...emptyGrenade(), lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0, inventory: 1 as const });
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
it('requires one same-lane Rifle hit, consumes it, and grants only one held charge across Lv4', () => {
  const sim = make(), s = sim.getState(); s.progression = {level:4,xp:0};
  s.grenade = {...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,supply:{lane:2,x:0,depth:8}};
  sim.restoreState(s); ticks(sim,20);
  expect(sim.getState().grenade!.inventory).toBe(1); expect(sim.getState().grenade!.supply).toBeNull();
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeAcquired'}]); ticks(sim,600);
  expect(sim.consumeGrenadeEvents()).toEqual([]); expect(sim.getState().squad.count).toBe(1);
  expect(sim.getState().streamRewards).toEqual([]);
});
it('maximizes cross-lane blast count with nearest-depth then ID tie-breaking and a fixed capture', () => {
  const sim=armed(),s=sim.getState(); s.enemies.push({id:4,tier:1,archetype:'grunt',lane:2,x:0,z:4,hp:1});
  expect(grenadeTarget(s,balance.grenade)!.id).toBe(1);
  s.enemies=s.enemies.filter(e=>e.lane===2); expect(grenadeTarget(s,balance.grenade)!.id).toBe(4);
  s.enemies=[{...s.enemies[0],id:8},{...s.enemies[0],id:7}];expect(grenadeTarget(s,balance.grenade)!.id).toBe(7);
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning); const f=sim.getState().grenade!.flight!;
  sim.stepLane(1); ticks(sim,20);expect(sim.getState().grenade!.flight!.targetZ).toBe(f.targetZ);
});
it('does not consume an empty-lane or out-of-range throw or activate after death', () => {
  for(const mode of ['empty','range','dead']) {
    const sim=armed(),s=sim.getState();
    if(mode==='empty')s.player.selectedLane=0;
    if(mode==='range')s.enemies.forEach(e=>e.z=balance.grenade.throwRange+1);
    if(mode==='dead')s.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};
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
  for(const patch of [{inventory:2},{inventory:1,acquiredAtSeconds:null},{acquiredAtSeconds:10},{supplySpawnedAtSeconds:null}]) {
    const s=sim.getState();Object.assign(s.grenade!,patch);expect(()=>sim.restoreState(s)).toThrow();
  }
  for(const patch of [{capacity:2},{damageEnemyHp:0},{flightSeconds:0},{blastRadius:-1},{supplyHitsRequired:2}])
    expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,grenade:{...data.catharsis.grenade,...patch}}})).toThrow();
});

it('uses inclusive circular distance without falloff and excludes entities outside the circle',()=>{
  const sim=armed(),s=sim.getState();
  s.catharsis!.balance.heavySpeed=0;
  s.grenade!.inventory=0;s.grenade!.flight={startX:0,startZ:0,targetX:0,targetZ:10,startedAtSeconds:0,
    flightSeconds:1/60,damageEnemyHp:9,blastRadius:2};
  s.enemies=[0,2,2.001].map((x,i)=>({id:i+1,tier:1,archetype:'heavy',lane:2,x,z:10,hp:15}));
  sim.restoreState(s);ticks(sim,1);expect(sim.getState().enemies.map(e=>e.hp)).toEqual([6,6,15]);
});
it('does not award the same victim twice when a Rifle and detonation resolve in one tick',()=>{
  const sim=armed(),s=sim.getState();s.enemies=s.enemies.slice(0,1);
  s.grenade!.inventory=0;s.grenade!.flight={startX:0,startZ:0,targetX:0,targetZ:10,startedAtSeconds:0,
    flightSeconds:1/60,damageEnemyHp:9,blastRadius:2};
  s.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,slopeX:0,x:0,z:9.5,speed:60,damage:3,remainingRange:20,
    blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];s.weapons.nextProjectileId=2;
  sim.restoreState(s);ticks(sim,1);expect(sim.getState().progression!.xp).toBe(1);
  const event=sim.consumeGrenadeEvents()[0];if(event.kind==='grenadeDetonated')expect(event.victims).toEqual([]);
});
