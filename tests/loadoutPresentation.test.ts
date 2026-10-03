import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { loadoutPresentation } from '../src/ui/loadoutPresentation';
const balance=GameConfigSchema.parse(data).catharsis!.progression;
const context={baseFireRate:3,squadCount:1,initialSquadCount:1,reinforcementArrived:false};
it('projects actual diminishing fire-rate math without defining progression', () => {
  expect([1,2,3,4,5,6,7].map(level=>loadoutPresentation({level,xp:0},balance,context).value))
    .toEqual(['+0%','+33%','+67%','+100%','+117%','+130%','+130%']);
  expect(loadoutPresentation({level:3,xp:0},balance,{...context,baseFireRate:2.5})).toEqual({weapon:'rifle',trait:'fireRate',value:'+80%'});
});
it('uses arrived squad truth rather than level labels, retaining truthful power after a loss', () => {
  expect(loadoutPresentation({level:7,xp:0},balance,context).trait).toBe('fireRate');
  expect(loadoutPresentation({level:7,xp:0},balance,{...context,squadCount:2,reinforcementArrived:true})).toEqual({weapon:'rifle',trait:'squad',value:'×2'});
  expect(loadoutPresentation({level:8,xp:0},balance,{...context,squadCount:1,reinforcementArrived:true}).trait).toBe('fireRate');
  expect(loadoutPresentation({level:5,xp:0},{...balance,reinforcementLevel:5},{...context,squadCount:4,initialSquadCount:2,reinforcementArrived:true}).value).toBe('×2');
});
