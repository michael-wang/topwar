import type { SimulationOptions, Simulation } from '../simulation/Simulation';
import { createAirSupportPlaytest } from './TankPlaytest';
import { effectivePrimaryFireRate, progressionStage } from '../simulation/progression';
import { attackLanePositions } from '../simulation/enemies/laneComposition';

export const MANUAL_AIR_SUPPORT_REVIEWS = [
  { role: 'manual-air-3', label: '手動空襲 · 3 MG', count: 3, hp: 2100 },
  { role: 'manual-air-5', label: '手動空襲 · 5 MG 終結測試', count: 5, hp: 450 },
] as const;
export type ManualAirSupportFixture = typeof MANUAL_AIR_SUPPORT_REVIEWS[number]['role'];
export function createManualAirSupportReview(options: SimulationOptions, rate: number, role: ManualAirSupportFixture): Simulation {
  const review = MANUAL_AIR_SUPPORT_REVIEWS.find(r => r.role === role), balance = structuredClone(options.catharsis?.balance);
  if (!review || !balance?.commanderSupport?.heavyRaid?.lastStand) throw Error('Invalid manual support review');
  const last = balance.commanderSupport.heavyRaid.lastStand;
  last.triggerPolicy = 'manualPlayerCall'; delete last.livingMgHpThresholds;
  const sim = createAirSupportPlaytest({ ...options, catharsis: { ...options.catharsis!, balance } }, rate), s = sim.getState();
  const level = review.count + 7;
  if (progressionStage(level, balance.progression).squadStage !== review.count) throw Error('Manual review needs authored MG progression');
  s.progression = { level, xp: 0 }; s.squad = { count: review.count, rifleCounts: [review.count], rifleRemainder: 0, rocketCount: 0 };
  s.defenseTank!.hp = review.hp;
  // The lethal review initially shoots a real flank, leaving the timing/choice to the player.
  const lane = review.count === 5 ? 0 : 2;
  const lanes = attackLanePositions(5, options.catharsis!.trackHalfWidth, balance.edgeInset);
  s.player.x = lanes[lane]; s.player.selectedLane = lane;
  const interval = 1 / effectivePrimaryFireRate(rate, level, balance);
  s.weapons.rifleCooldownRemainingSeconds = 0;
  s.weapons.rifleMemberCooldowns = Array.from({ length: review.count }, (_, i) => i * interval / review.count);
  sim.restoreState(s); return sim;
}
