import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { Simulation } from '../src/simulation/Simulation';
const config = GameConfigSchema.parse(data);
const level = { id:'live-tuning',length:1000,enemyGroups:[],upgradeGates:[] };
it('starts from authored Defense tuning and rejects unknown control configuration', () => {
  const tuning=defaultRuntimeTuning(config,level);
  expect(tuning).toMatchObject({bulletSpeed:60,bulletRange:80,fireRate:3,forwardSpeed:0,
    musicVolume:.5,enemyVisualScale:1.4,gruntSpeed:.85,heavyHp:15,heavySpeed:.72,heavyChance:.25,groupSize:24});
  expect(()=>GameConfigSchema.parse({...data,controls:{mouseSensitivity:1}})).toThrow();
});
it('updates living Heavy HP by fraction while preserving positions, IDs, clocks and RNG', () => {
  const sim=new Simulation({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
    catharsis:{balance:config.catharsis!,trackHalfWidth:3.2}});
  const state=sim.getState();state.enemies=[{id:1,tier:1,lane:2,archetype:'heavy',x:0,z:20,hp:6}];
  sim.restoreState(state);
  sim.setCatharsisBalance({...state.catharsis!.balance,heavyHp:30});
  expect(sim.getState()).toEqual({...state,catharsis:{...state.catharsis!,balance:{...state.catharsis!.balance,heavyHp:30}},
    enemies:[{...state.enemies[0],hp:12}]});
});
