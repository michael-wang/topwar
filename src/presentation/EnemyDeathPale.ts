import type { EnemyDeathRole } from './EnemyDeathTiming';

// Immediate death confirmation, independent of the longer breakup/payoff clocks.
export const DEATH_PALE_COLOR = '#b9beba';
export const DEATH_PALE_INITIAL = .70;
export const DEATH_PALE_COMPLETE_MS = { grunt: 45, heavy: 65, giant: 80 } as const;
export function enemyDeathPale(ageMs: number, role: EnemyDeathRole): number {
  const p = Math.max(0, Math.min(1, ageMs / DEATH_PALE_COMPLETE_MS[role]));
  return DEATH_PALE_INITIAL + (1 - DEATH_PALE_INITIAL) * p * p * (3 - 2 * p);
}
