import { survivalSimulation, survivalDecision, type SurvivalScenario } from './survivalPilot';
import { pilotTuning } from './p15Pilot';
import { SurvivalDiagnosis } from './survivalDiagnosis';
import { bindObserver } from './survivalDiagnosisHooks';
export { advanceDefenseWaves } from '../../src/simulation/enemies/defenseWaves';
export { effectiveSeed } from '../../src/simulation/enemies/effectiveSeed';
export { default as levelData } from '../../public/game-data/levels/level-001.json';
export { default as gameData } from '../../public/game-data/game.json';
export { survivalSimulation, survivalDecision, pilotTuning, SurvivalDiagnosis, bindObserver };
export type Policy = 'competent' | 'slower' | 'fixed';
export function makeRun(seed: number, scenario: SurvivalScenario) { return survivalSimulation(seed, scenario); }
