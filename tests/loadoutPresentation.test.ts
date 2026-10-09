import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { loadoutPresentation } from '../src/ui/loadoutPresentation';
const balance = GameConfigSchema.parse(data).catharsis!.progression;
it.each([[1,1,null],[2,2,null],[3,3,null],[4,3,2],[5,3,3],[6,1,null],[7,1,2],[8,1,3]] as const)(
  'separates Level %i weapon stage %i from optional squad stage %s', (level,weaponStage,squadStage) => {
    expect(loadoutPresentation({level,xp:0},balance)).toEqual({weapon:level>=6?'machineGun':'rifle',weaponStage,squadStage});
  });
it('derives permanent stages from the authored plan, independent of XP and live casualties',()=>{
  expect(loadoutPresentation({level:4,xp:10},balance)).toEqual(loadoutPresentation({level:4,xp:179},balance));
  const plan={...balance,levelPlan:balance.levelPlan.map(stage=>({...stage,squadStage:1}))};
  expect(loadoutPresentation({level:4,xp:0},plan)).toEqual({weapon:'rifle',weaponStage:3,squadStage:null});
  expect(loadoutPresentation({level:100,xp:0},balance)).toEqual({weapon:'machineGun',weaponStage:1,squadStage:3});
});
