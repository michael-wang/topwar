import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import { createNavalBarrageReview } from '../../src/app/DevNavalBarrageReview';
export { survivalDecision } from './survivalPilot';
export { pilotTuning } from './p15Pilot';
export { SurvivalDiagnosis } from './survivalDiagnosis';
export { bindObserver } from './survivalDiagnosisHooks';
export function makeNavalRun(seed:number, scenario:'natural'|'lv8'|'lv9'|'lv10', barrage:boolean, config:unknown=data) {
  const c=GameConfigSchema.parse(config);
  const options={seed,level:LevelDefinitionSchema.parse(levelData),startSquad:1,startRocketCount:0,tiers:c.tiers,
    catharsis:{balance:c.catharsis!,trackHalfWidth:c.track.halfWidth}};
  if(scenario==='natural') {options.catharsis.balance.navalBarrage!.enabled=barrage;return new Simulation(options);}
  return createNavalBarrageReview(options,c.weapon.rifle.fireRate,`barrage${Number(scenario.slice(2)) as 8|9|10}-${barrage?'on':'off'}`,seed);
}
