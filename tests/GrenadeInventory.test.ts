import { expect, it } from 'vitest';
import game from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { GrenadeConfigSchema, teachingGrenadeGrant } from '../src/config/grenadeConfig';
import { awardGrenades, emptyGrenade, GrenadeStateSchema } from '../src/simulation/grenade';
import { Simulation } from '../src/simulation/Simulation';
import { grenadeCountLabel } from '../src/ui/GrenadeButton';
const c=GameConfigSchema.parse(game);
const make=()=>new Simulation({seed:17,level:{id:'inventory',length:1000,enemyGroups:[],upgradeGates:[]},startSquad:1,startRocketCount:0,
  tiers:c.tiers,catharsis:{balance:c.catharsis!,trackHalfWidth:3.2}});
const tuning={...c.player,trackHalfWidth:3.2,defenseLineOffset:1.5,normalEnemyRadius:.3,bossRadius:2,forwardSpeed:0,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
function held(inventory:number){return {...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory};}
function collect(sim:Simulation,teaching=false){
  const s=sim.getState();s.grenade!.supply={lane:2,x:0,depth:14,...(teaching?{}:{rewardAmount:1 as const}),
    destruction:{mode:'staged',stage:2,recoverySeconds:.7,recoverAtSeconds:.7}};
  if(s.elapsedSeconds<.7){s.elapsedSeconds=.7;s.tick=42;}
  s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'rifle',tier:1,memberIndex:0,lane:2,x:0,z:13.5,slopeX:0,speed:60,damage:3,remainingRange:20,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);return sim.consumeGrenadeEvents();
}
it.each([0,1,2,3,4,19,20,50,100,1000])('awards exactly one recurring charge at inventory %i, preserves damage and emits once',n=>{
  const sim=make(),s=sim.getState();s.grenade=held(n);sim.restoreState(s);
  expect(collect(sim)).toEqual([{kind:'grenadeSupplyOpened',x:0,z:14,amount:1}]);
  expect(sim.getState().grenade!.inventory).toBe(n+1);expect(sim.consumeGrenadeEvents()).toEqual([]);
  const copy=make();copy.restoreState(JSON.parse(JSON.stringify(sim.getState())));expect(copy.getState()).toEqual(sim.getState());
});
it('accumulates consecutive supplies, throws one, rejects overlapping throws and restores in-flight accounting',()=>{
  const sim=make(),s=sim.getState();s.grenade=held(19);sim.restoreState(s);
  collect(sim);expect(sim.getState().grenade!.inventory).toBe(20);
  sim.step(1/60,{targetX:0,throwGrenade:true},tuning);expect(sim.getState().grenade!.inventory).toBe(19);
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeThrown'}]);
  const saved=JSON.parse(JSON.stringify(sim.getState())),clone=make();clone.restoreState(saved);
  for(const x of [sim,clone]){collect(x);expect(x.getState().grenade!.inventory).toBe(20);
    x.step(1/60,{targetX:0,throwGrenade:true},tuning);expect(x.getState().grenade!.inventory).toBe(20);expect(x.consumeGrenadeEvents()).toEqual([]);}
  expect(sim.getState()).toEqual(clone.getState());collect(sim);expect(sim.getState().grenade!.inventory).toBe(21);
  expect(make().getState().grenade!.inventory).toBe(0);
});
it('historical capacity aliases mean teaching reward only, including continuing inventory above three',()=>{
  const sim=make(),s=sim.getState();const {teachingGrantAmount:_grant,...g}=s.catharsis!.balance.grenade;
  s.catharsis!.balance.grenade={...g,capacity:3};s.grenade=held(20);sim.restoreState(s);
  expect(teachingGrenadeGrant(s.catharsis!.balance.grenade)).toBe(3);collect(sim);expect(sim.getState().grenade!.inventory).toBe(21);
  expect(()=>GrenadeConfigSchema.parse({...g,capacity:3,teachingGrantAmount:4})).toThrow();
});
it('refuses whole overflow rewards without false acquisition or precision loss',()=>{
  const sim=make(),s=sim.getState();s.grenade=held(Number.MAX_SAFE_INTEGER);sim.restoreState(s);
  expect(collect(sim)).toEqual([]);expect(sim.getState().grenade!.inventory).toBe(Number.MAX_SAFE_INTEGER);
  expect(sim.getState().grenade!.supply).toBeNull();
  expect(awardGrenades(Number.MAX_SAFE_INTEGER-2,3)).toBe(Number.MAX_SAFE_INTEGER-2);
  expect(awardGrenades(Number.MAX_SAFE_INTEGER-1,1)).toBe(Number.MAX_SAFE_INTEGER);
});
it.each([-1,.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN])('rejects invalid inventory %s in schema, restore and checked addition',n=>{
  expect(()=>GrenadeStateSchema.parse(held(n))).toThrow();const sim=make(),s=sim.getState();s.grenade=held(n);
  expect(()=>sim.restoreState(s)).toThrow();expect(()=>awardGrenades(n,1)).toThrow();
});
it('keeps extreme HUD text bounded and small counts exact',()=>{
  for(const n of [3,20,50,99,100,1000])expect(grenadeCountLabel(n)).toBe(String(n));
  for(const n of [10000,1e6,1e9,1e12,Number.MAX_SAFE_INTEGER])expect(grenadeCountLabel(n).length).toBeLessThanOrEqual(6);
});
