import { expect, it } from 'vitest';
import { InvasionPresentation } from '../src/presentation/InvasionPresentation';
import { prepareOpeningCohort, landingCount, landingHandoffSeconds, landingSurfZ } from '../src/app/openingCohort';
import { Simulation } from '../src/simulation/Simulation';
import { projectRenderState } from '../src/app/projectRenderState';
import { pilotTuning } from '../scripts/qa/DefensePilot';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

const make = (seed = 17476) => new Simulation({ seed, level: LevelDefinitionSchema.parse(levelData), startSquad: 1,
  startRocketCount: 0, tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } });
const project = (sim: Simulation) => projectRenderState(sim.getFrameState(), { formationSpacing: config.player.formationSpacing,
  trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset, catharsis: sim.getState().catharsis });

it.each([17,17476,0xffffffff])('keeps real cohort identities, wave cursors and RNG for seed %s', seed => {
  const sim=make(seed), original=sim.getState();
  expect(original.enemies).toHaveLength(120);
  prepareOpeningCohort(sim);
  const before=sim.getState();
  expect(before.enemies).toHaveLength(landingCount);
  expect({...before,enemies:original.enemies}).toEqual(original);
  before.enemies.forEach(e=>{const source=original.enemies.find(o=>o.id===e.id)!;expect({...e,x:source.x,z:source.z,lane:source.lane}).toEqual(source);});
  expect(before.enemies.slice(0,3).map(e=>e.lane)).toEqual([1,2,3]);
  const restored=make(seed);restored.restoreState(before);
  for(let i=0;i<120;i++){sim.step(1/60,{targetX:0},pilotTuning);restored.step(1/60,{targetX:0},pilotTuning);}
  expect(sim.getState()).toEqual(restored.getState());
  expect(sim.getState().enemies.filter(e=>e.id>=original.enemyStream!.nextEnemyId)).toHaveLength(24);
  expect(sim.getState().enemies.some(e=>e.id>landingCount&&e.id<original.enemyStream!.nextEnemyId)).toBe(false);
  const ongoing=sim.getState();prepareOpeningCohort(sim);expect(sim.getState()).toEqual(ongoing);
});

it.each([false,true])('admits every enemy at surf, walks continuously and hands off exact T=0 (reduced=%s)', reduced => {
  const sim=make();prepareOpeningCohort(sim);const before=sim.getState(), projected=project(sim);
  for(const end of [landingHandoffSeconds,landingHandoffSeconds+.0002708333,landingHandoffSeconds+2.5]) {
    const opening=new InvasionPresentation(projected,config.catharsis!);opening.setBriefing(end-10.224,end);
    const previous=new Map<number,{x:number;z:number}>();let count=0;
    for(let frame=0;frame/60<end;frame++) {
      const enemies=opening.sample(frame/60,reduced).enemies;
      expect(enemies.length-count).toBeGreaterThanOrEqual(0);expect(enemies.length-count).toBeLessThanOrEqual(1);count=enemies.length;
      for(const e of enemies){const last=previous.get(e.id), speed=e.archetype==='heavy'?.72:.85;
        if(last){expect(last.z-e.z).toBeCloseTo(speed/60,9);expect(e.x).toBe(last.x);}
        else expect(e.z).toBeGreaterThanOrEqual(landingSurfZ-speed/60-1e-9);
        previous.set(e.id,{x:e.x,z:e.z});
      }
    }
    expect(opening.sample(end,reduced).enemies).toEqual(projected.enemies);
    expect([...opening.poseTimes.values()].every(t=>t===0)).toBe(true);
    expect(sim.getState()).toEqual(before);
    // Skip cuts straight to this same real cohort, even before audio readiness.
    expect(new InvasionPresentation(projected,config.catharsis!).sample(landingHandoffSeconds).enemies).toEqual(projected.enemies);
  }
});
