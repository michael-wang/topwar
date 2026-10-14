import {expect, it} from 'vitest';
import {VictoryCelebration} from '../src/presentation/VictoryCelebration';
import {createVictoryReview} from '../src/app/TankPlaytest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {defaultRuntimeTuning} from '../src/app/runtimeTuning';
const level=LevelDefinitionSchema.parse(levelData),tuning={...defaultRuntimeTuning(config,level),formationSpacing:config.player.formationSpacing};
const make=()=>createVictoryReview({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
  catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},config.weapon.rifle.fireRate);
it('allows movement and fire through explosions, movement only through commendation, then freezes position at results without mutating official state',()=>{
  const sim=make(),official=sim.getState(),c=new VictoryCelebration(sim.getFrameState(),0,tuning);
  c.stepLane(1);c.update(100,false,false,false);expect(c.player.x).toBeGreaterThan(official.player.x);expect(c.projectiles.length).toBeGreaterThan(0);
  const latest=Math.max(...c.projectiles.map(p=>p.id)),shot=c.projectiles[0],z=shot.z;
  c.stepLane(-1);c.update(150,false,true,false);expect(shot.z).toBeGreaterThan(z);
  expect(c.projectiles.every(p=>p.id<=latest)).toBe(true);expect(c.player.x).toBeLessThan(config.track.halfWidth);
  c.stepLane(1);c.update(175,false,true,true);const x=c.player.x;
  expect(c.stepLane(-1)).toBe(false);c.update(200,false,false,true);expect(c.player.x).toBe(x);
  expect(c.projectiles.every(p=>p.id<=latest)).toBe(true);
  c.update(20000,false,false,true);expect(c.projectiles).toEqual([]);
  expect(sim.getState()).toEqual(official);expect(official.projectiles).toEqual([]);expect(official.defenseTank!.hp).toBe(0);
});
it('freezes physical presentation and cadence on Pause and latches cease-fire across Skip/restore',()=>{
  const c=new VictoryCelebration(make().getFrameState(),0,tuning);c.stepLane(1);c.update(100,false,false,false);
  const frozen=JSON.stringify({player:c.player,shots:c.projectiles});
  c.update(100,true,false,false);c.update(100,true,false,false);expect(JSON.stringify({player:c.player,shots:c.projectiles})).toBe(frozen);
  c.update(110,false,true,false);const ids=c.projectiles.map(p=>p.id);c.update(120,false,false,true);
  expect(c.projectiles.map(p=>p.id)).toEqual(ids);
  const restored=new VictoryCelebration(make().getFrameState(),0,tuning);restored.update(0,true,true,false);
  restored.update(100,false,false,false);expect(restored.projectiles).toEqual([]);
});
it('retains existing bullet identity, speed, slope and expiry through the lethal transition and cease-fire',()=>{
  const state=make().getFrameState(),existing=[{id:991,kind:'machineGun' as const,tier:1,x:1,z:state.player.z+2,
    speed:7,remainingRange:.5,slopeX:.2,damage:1,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  const c=new VictoryCelebration(state,0,tuning,existing);c.update(60,false,true,false);
  expect(c.projectiles).toHaveLength(1);expect(c.projectiles[0]).toMatchObject({id:991,z:2.42,x:1.084});
  c.update(80,false,true,true);expect(c.projectiles).toEqual([]);expect(existing[0].z).toBe(state.player.z+2);
});
it('uses authored MG cadence and formation in a reusable pool bounded by flight duration',()=>{
  const state=make().getState();state.weapons.rifleMemberCooldowns!.fill(0);
  const c=new VictoryCelebration(state,0,tuning),pool=c as unknown as {free:unknown[];interval:number;nextId:number};
  const capacity=pool.free.length,start=pool.nextId;
  for(let i=1;i<=180;i++)c.update(i*1000/60,false,false,false);
  const expected=state.squad.count*(Math.floor(3/pool.interval)+1);
  expect(Math.abs(pool.nextId-start-expected)).toBeLessThanOrEqual(state.squad.count);
  expect(c.projectiles.every(p=>p.kind==='machineGun')).toBe(true);
  expect(c.projectiles.length+pool.free.length).toBe(capacity);
});
