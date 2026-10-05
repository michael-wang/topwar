import type { BloodSplatTiming } from '../../presentation/EnemyDeathTiming';

// A brief bullet-contact punctuation, separate from the later fluid payoff.
// Heavy/Giant retain their accepted surviving-hit presentation without doubling.
export const GRUNT_LETHAL_CONTACT: BloodSplatTiming = {
  bloodStartMs: 0, bloodEndMs: 100, bloodPulseCount: 1, bloodScale: .25,
};
// Simulation IDs are positive. This non-following owner survives removal cancel.
export const lethalContactOwner = (enemyId: number): number => -1 - enemyId;
