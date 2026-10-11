import { survivalSimulation, survivalDecision, type SurvivalScenario } from './survivalPilot';
import { survivalReviewConfig } from '../../src/app/DevSurvivalReview';
import { admitDefenseGroup } from '../../src/simulation/enemies/defenseGroup';
import { effectiveSeed } from '../../src/simulation/enemies/effectiveSeed';
import { postCapOrdinarySettings } from '../../src/simulation/postCapSurvival';
import levelData from '../../public/game-data/levels/level-001.json';
export { survivalDecision };
export { pilotTuning, SurvivalDiagnosis, bindObserver } from './survivalDiagnosticRun';
export { advanceDefenseWaves, effectiveSeed, levelData, gameData } from './survivalDiagnosticRun';
export type SurvivalCandidate = 'baseline' | 'heavy' | 'speed' | 'combined-six' | 'combined';
export function makeRun(seed: number, scenario: SurvivalScenario, candidate: SurvivalCandidate = 'baseline') {
  const sim = survivalSimulation(seed, scenario), s = sim.getState(), balance = s.catharsis!.balance;
  balance.postCapSurvival = survivalReviewConfig(balance.postCapSurvival,
    candidate === 'baseline' || candidate === 'speed' ? 'baseline' : 'experimental');
  const c = balance.postCapSurvival;
  if (candidate === 'speed') c.advancedProfile!.ordinarySpeedMultiplier = 1.4;
  if (candidate === 'heavy') {
    delete c.advancedProfile!.ordinarySpeedMultiplier; delete c.capProfile!.ordinarySpeedMultiplier;
  }
  if (candidate === 'heavy' || candidate === 'combined-six') delete c.capProfile!.waveIntervalSeconds;
  if (scenario !== 'natural') {
    s.enemies = []; s.enemyStream!.nextEnemyId = 1;
    const settings = postCapOrdinarySettings(balance, s.postCapSurvival, s.progression!.level)!;
    admitDefenseGroup(s.enemies, s.enemyStream!, s.enemyStream!.nextRowIndex - 1,
      effectiveSeed(seed, levelData.enemyStream!.seed), { ...balance, ...settings },
      s.catharsis!.trackHalfWidth, balance.defenseSpawnAheadDistance);
    s.defenseWaves!.nextAtSeconds = settings.waveIntervalSeconds ?? c.waveIntervalSeconds!;
  }
  sim.restoreState(s); return sim;
}
