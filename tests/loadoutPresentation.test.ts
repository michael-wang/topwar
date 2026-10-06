import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { loadoutPresentation } from '../src/ui/loadoutPresentation';
const balance=GameConfigSchema.parse(data).catharsis!.progression;
it.each([[1,'cartridge',1],[2,'cartridge',2],[3,'cartridge',3],[4,'soldier',2],[5,'soldier',3]] as const)(
  'shows Level %i as %s stage %i from the explicit plan', (level,kind,stage)=>{
    expect(loadoutPresentation({level,xp:0},balance)).toEqual({weapon:'rifle',enhancement:{kind,stage,slots:3}});
  });
it('uses configured progression unlocks rather than live counts, percentage or multiplier text',()=>{
  const context={level:4,xp:10};
  expect(loadoutPresentation(context,balance).enhancement.stage).toBe(2);
  expect(loadoutPresentation({level:5,xp:0},balance).enhancement.stage).toBe(3);
  const plan={...balance,levelPlan:balance.levelPlan.map(stage=>({...stage,squadStage:1}))};
  expect(loadoutPresentation(context,plan).enhancement).toEqual({kind:'cartridge',stage:3,slots:3});
  expect(loadoutPresentation({level:100,xp:0},balance).enhancement).toEqual({kind:'cartridge',stage:1,slots:3});
});

it('shows the evolved weapon with Stage I rather than Rifle soldier pips',()=>{
expect(loadoutPresentation({level:6,xp:0},balance)).toEqual({weapon:'machineGun',enhancement:{kind:'cartridge',stage:1,slots:3}});
});
