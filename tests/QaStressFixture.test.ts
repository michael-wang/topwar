import { expect,it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createQaStressFixture,advanceQaPreparation,qaSimulationTuning } from '../src/app/QaStressFixture';
const c=GameConfigSchema.parse(data),level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(c);
export function stressScene(){const s=createQaStressFixture({seed:42,level,startSquad:1,startRocketCount:0,tiers:c.tiers,
  catharsis:{balance:c.catharsis!,trackHalfWidth:c.track.halfWidth}},tuning);
  let ready=false,tick=0;for(;tick<5400&&!ready;tick++)ready=advanceQaPreparation(s,tuning,tick);
  return {sim:s,ready,tick};}
it('prepares bounded real combat, preserves shipping AHEAD config and validates the complete authoritative state',()=>{
  const a=stressScene(),b=stressScene();expect(a.ready).toBe(true);expect(a.tick).toBeLessThan(5400);
  const s=a.sim.getState();expect(s).toEqual(b.sim.getState());expect(s.progression!.level).toBe(10);
  expect(s.enemies.length).toBeGreaterThanOrEqual(100);expect(s.enemies.length).toBeLessThanOrEqual(180);
  expect(s.projectiles.length).toBeGreaterThanOrEqual(20);expect(s.artillery!.shells.length).toBeGreaterThan(0);
  expect(s.enemies.some(e=>e.archetype==='heavy')).toBe(true);expect(s.squad.count).toBeGreaterThan(0);
  expect(s.catharsis!.balance.postCapSurvival).toEqual(c.catharsis!.postCapSurvival);
  b.sim.restoreState(JSON.parse(JSON.stringify(s)));expect(b.sim.getState()).toEqual(s);expect(b.sim.consumeArtilleryEvents()).toEqual([]);
});
