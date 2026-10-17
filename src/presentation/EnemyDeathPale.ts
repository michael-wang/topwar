import type { EnemyDeathRole } from './EnemyDeathTiming';

// Biological roles drain during impact/recoil. Mechanical GIANT keeps its paint.
export const DEATH_PALE_COLOR = '#b9beba';
export const DEATH_PALE_COMPLETE_MS = { grunt: 95, heavy: 185 } as const;
export function enemyDeathPale(ageMs: number, role: EnemyDeathRole): number {
  if (role === 'giant') return 0;
  const p = Math.max(0, Math.min(1, ageMs / DEATH_PALE_COMPLETE_MS[role]));
  return p * p * (3 - 2 * p);
}
