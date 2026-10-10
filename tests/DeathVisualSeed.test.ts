import { expect,it } from 'vitest';
import { DeathVisualSequence,deathVisualSeed,deathComposition,DEATH_COMPOSITIONS } from '../src/rendering/enemies/DeathVisualSeed';
import { splashShapes,activeDropletCount,activeRibbonCount } from '../src/rendering/enemies/FluidBloodSplash';
import bloodSource from '../src/rendering/enemies/IntegratedDeathBlood.ts?raw';
import fluidSource from '../src/rendering/enemies/FluidBloodSplash.ts?raw';
import seedSource from '../src/rendering/enemies/DeathVisualSeed.ts?raw';
import appSource from '../src/app/GameApp.ts?raw';
import { createDevReviewFixture } from './helpers/ReviewFixtures';
import gameData from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import level from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

it('replays six coherent compositions and avoids adjacent same-role repeats',()=>{
 expect(DEATH_COMPOSITIONS).toBeGreaterThanOrEqual(6);
 for(const role of ['grunt','heavy','giant'] as const){
  const a=new DeathVisualSequence(),b=new DeathVisualSequence(),directions=new Set<string>();let previous=-1;
  for(let i=0;i<100;i++){
   const seed=a.next(i,role);expect(seed).toBe(b.next(i,role));const c=deathComposition(seed);
   expect(c).not.toBe(previous);previous=c;
  }
  for(let salt=0;salt<6;salt++){
   a.reset(salt);const c=deathComposition(a.next(1,role));
   directions.add(splashShapes[role][c][0].direction.toArray().join(','));
   expect(activeRibbonCount(role,c)).toBeGreaterThanOrEqual(2);expect(activeDropletCount(role,c)).toBeGreaterThanOrEqual(4);
   expect(deathVisualSeed(1,role,0,salt)).toBe(deathVisualSeed(1,role,0,salt));
  }expect(directions.size).toBe(6);
  a.reset();b.reset();expect(a.next(9,role)).toBe(b.next(9,role));
 }
 expect(bloodSource+seedSource+fluidSource).not.toContain('Math.random');
});
it('keeps the development visual cycle outside validated gameplay and production activation',()=>{
 expect(appSource).toContain('import.meta.env.DEV && this.devReviewFixture ? ++this.devReviewVisualSalt : 0');
 const c=GameConfigSchema.parse(gameData),options={seed:5,level:LevelDefinitionSchema.parse(level),startSquad:c.player.startSquad,startRocketCount:c.player.startRocketCount,tiers:c.tiers,catharsis:{trackHalfWidth:c.track.halfWidth,balance:c.catharsis!}};
 const a=createDevReviewFixture(options,3,'machineGun').getState(),b=createDevReviewFixture(options,3,'machineGun').getState();
 expect(a).toEqual(b);expect(a).not.toHaveProperty('visualSalt');
});
