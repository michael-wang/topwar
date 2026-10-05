import type { EnemyDeathRole } from './EnemyDeathTiming';

// Color drains smoothly during impact/recoil, ahead of the longer kill payoff.
export const DEATH_PALE_COLOR = '#b9beba';
export const DEATH_PALE_COMPLETE_MS = { grunt: 130, heavy: 185, giant: 290 } as const;
export function enemyDeathPale(ageMs: number, role: EnemyDeathRole): number {
  const p = Math.max(0, Math.min(1, ageMs / DEATH_PALE_COMPLETE_MS[role]));
  return p * p * (3 - 2 * p);
}
