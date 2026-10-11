import { survivalSimulation, survivalDecision, type SurvivalScenario } from './survivalPilot';
import { survivalReviewConfig, type SurvivalReviewMode } from '../../src/app/DevSurvivalReview';
import { admitDefenseGroup } from '../../src/simulation/enemies/defenseGroup';
import { effectiveSeed } from '../../src/simulation/enemies/effectiveSeed';
import { postCapOrdinarySettings } from '../../src/simulation/postCapSurvival';
import levelData from '../../public/game-data/levels/level-001.json';
export { survivalDecision };
export { pilotTuning, bindObserver, advanceDefenseWaves, effectiveSeed, levelData, gameData } from './survivalDiagnosticRun';
export { SurvivalPressureDiagnosis as SurvivalDiagnosis } from './survivalPressureDiagnosis';

export function makeRun(seed: number, scenario: SurvivalScenario, mode: SurvivalReviewMode = 'baseline') {
  const sim=survivalSimulation(seed,scenario),s=sim.getState(),b=s.catharsis!.balance;
  b.postCapSurvival=survivalReviewConfig(b.postCapSurvival,mode);
  if(scenario!=='natural') {
    s.enemies=[];s.enemyStream!.nextEnemyId=1;
    const settings=postCapOrdinarySettings(b,s.postCapSurvival,s.progression!.level,s.progression!.xp)!;
    admitDefenseGroup(s.enemies,s.enemyStream!,s.enemyStream!.nextRowIndex-1,effectiveSeed(seed,levelData.enemyStream!.seed),
      {...b,...settings},s.catharsis!.trackHalfWidth,b.defenseSpawnAheadDistance);
    s.defenseWaves!.nextAtSeconds=settings.waveIntervalSeconds??b.postCapSurvival.waveIntervalSeconds!;
  }
  sim.restoreState(s);return sim;
}
