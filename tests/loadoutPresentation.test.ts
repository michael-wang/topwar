import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { loadoutPresentation } from '../src/ui/loadoutPresentation';
const balance=GameConfigSchema.parse(data).catharsis!.progression;
const context={baseFireRate:3,squadCount:1,initialSquadCount:1,reinforcementArrived:false};
it('projects actual diminishing fire-rate math without defining progression', () => {
  expect([1,2,3,4,5,6,7].map(level=>loadoutPresentation({level,xp:0},balance,context).enhancement.value))
    .toEqual(['+0%','+33%','+67%','+100%','+117%','+130%','+130%']);
  expect(loadoutPresentation({level:3,xp:0},balance,{...context,baseFireRate:2.5})).toEqual({weapon:'rifle',enhancement:{kind:'fireRate',value:'+80%'}});
});
it('uses arrived squad truth rather than level labels, retaining truthful power after a loss', () => {
  expect(loadoutPresentation({level:7,xp:0},balance,context).enhancement.kind).toBe('fireRate');
  expect(loadoutPresentation({level:7,xp:0},balance,{...context,squadCount:2,reinforcementArrived:true})).toEqual({weapon:'rifle',enhancement:{kind:'squad',value:'×2'}});
  expect(loadoutPresentation({level:8,xp:0},balance,{...context,squadCount:1,reinforcementArrived:true}).enhancement.kind).toBe('fireRate');
  expect(loadoutPresentation({level:5,xp:0},{...balance,reinforcementLevel:5},{...context,squadCount:4,initialSquadCount:2,reinforcementArrived:true}).enhancement.value).toBe('×2');
});
it('separates weapon identity from current enhancement truth without inventing future upgrade stages',()=>{
  for(const level of [1,3,6,7,20]){
    const model=loadoutPresentation({level,xp:0},balance,context);
    expect(Object.keys(model)).toEqual(['weapon','enhancement']);expect(model.weapon).toBe('rifle');
    expect(Object.keys(model.enhancement)).toEqual(['kind','value']);
    expect(model.enhancement.kind).toBe('fireRate');expect(model.enhancement.value).toMatch(/^\+\d+%$/);
  }
  const low=loadoutPresentation({level:1,xp:0},balance,{...context,squadCount:3,reinforcementArrived:true});
  expect(low.enhancement).toEqual({kind:'squad',value:'×3'}); // Actual squad, never a level-selected soldier stage.
});
