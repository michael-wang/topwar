import { z } from 'zod';

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const CombatStatsSchema = z.strictObject({
  gruntKills: count, heavyKills: count, giantKills: count,
  shotsFired: count, shotsHit: count, grenadesUsed: count,
}).refine(s => s.shotsHit <= s.shotsFired, 'Hits cannot exceed fired shots');
export type CombatStats = z.infer<typeof CombatStatsSchema>;
export const emptyCombatStats = (): CombatStats => ({ gruntKills: 0, heavyKills: 0, giantKills: 0,
  shotsFired: 0, shotsHit: 0, grenadesUsed: 0 });
export function combatResults(stats: Readonly<CombatStats>, clearSeconds: number) {
  return { ...stats, clearSeconds, totalKills: stats.gruntKills + stats.heavyKills + stats.giantKills,
    accuracy: stats.shotsFired ? stats.shotsHit / stats.shotsFired : 0 };
}
