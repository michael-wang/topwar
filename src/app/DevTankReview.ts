import type { SimulationOptions, Simulation } from '../simulation/Simulation';
import { createTankPlaytest } from './TankPlaytest';
export { createVictoryReview } from './TankPlaytest';

export type TankReviewFixture = 'boss-intro' | 'boss-phase1' | 'boss-phase2' | 'boss-phase3' | 'boss-finish';
export const BOSS_TEST_PRESETS = {
  'boss-intro': { label: 'INTRO', hpFraction: 1 },
  'boss-phase1': { label: 'PHASE 1', hpFraction: 1 },
  'boss-phase2': { label: 'PHASE 2', hpFraction: .65 },
  'boss-phase3': { label: 'PHASE 3', hpFraction: .3 },
  'boss-finish': { label: 'FINISH', hpFraction: .02 },
} as const;

// Retained regression presets do not enter the closed-playtest bundle.
export function createTankReview(options: SimulationOptions, rate: number, role: TankReviewFixture): Simulation {
  const preset = BOSS_TEST_PRESETS[role];
  if (!preset) throw Error('Invalid BOSS TEST preset');
  return createTankPlaytest(options, rate, role === 'boss-intro', preset.hpFraction);
}
