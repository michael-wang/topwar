import type { SimulationOptions, Simulation } from '../simulation/Simulation';
import { createTankPlaytest } from './TankPlaytest';
import { admitTankFlanks } from '../simulation/defenseTank';

export const TANK_ARTILLERY_REVIEWS = [
  { role: 'boss-rhythm-2-a', label: 'Phase 2 — A：同時發射', phase: 2, mode: 'randomSimultaneous' },
  { role: 'boss-rhythm-2-b', label: 'Phase 2 — B：間隔發射', phase: 2, mode: 'randomStaggered' },
  { role: 'boss-rhythm-3-a', label: 'Phase 3 — A：同時發射', phase: 3, mode: 'randomSimultaneous' },
  { role: 'boss-rhythm-3-b', label: 'Phase 3 — B：間隔發射', phase: 3, mode: 'randomStaggered' },
] as const;
export type TankArtilleryReviewFixture = typeof TANK_ARTILLERY_REVIEWS[number]['role'];

// Local DEV only. Each pair differs solely in the optional firing policy.
export function createTankArtilleryReview(options: SimulationOptions, rate: number,
  role: TankArtilleryReviewFixture): Simulation {
  const review = TANK_ARTILLERY_REVIEWS.find(r => r.role === role), balance = structuredClone(options.catharsis?.balance);
  if (!review || !balance?.defenseTank) throw Error('Invalid Tank artillery review');
  balance.defenseTank.salvoPolicy = { mode: review.mode,
    cooldownSeconds: [{ min: 3.5, max: 5.5 }, { min: 2.5, max: 4.5 }, { min: 2.5, max: 6 }],
    gapSeconds: { min: .3, max: .6 } };
  const sim = createTankPlaytest({ ...options, catharsis: { ...options.catharsis!, balance } },
    rate, false, review.phase === 2 ? .65 : .3);
  const s = sim.getState(), tank = s.defenseTank!, c = s.catharsis!.balance.defenseTank!;
  // Start after entry/radio, with ordinary flank composition and one second to orient.
  tank.startedAtSeconds = s.elapsedSeconds - c.entrySeconds - 6;
  tank.activeAtSeconds = s.elapsedSeconds - 6; tank.entranceCleared = true;
  tank.nextAttackAtSeconds = s.elapsedSeconds + 1;
  admitTankFlanks(s, tank, c);
  sim.restoreState(s); return sim;
}
