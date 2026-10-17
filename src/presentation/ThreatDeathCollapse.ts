// Priority-threat weight is a downward settle, then a hold; never a depth retreat.
export const THREAT_DEATH_COLLAPSE = {
  heavy: { startMs: 80, peakMs: 350, holdEndMs: 515, sinkUnits: .26, angleDegrees: 29, compression: .10 },
  giant: { startMs: 150, peakMs: 750, holdEndMs: 1050, sinkUnits: .40, angleDegrees: 20, compression: .07 },
} as const;
const smooth = (p: number) => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
export function threatCollapseProgress(ageMs: number, role: 'heavy' | 'giant'): number {
  const t = THREAT_DEATH_COLLAPSE[role];
  return smooth((ageMs - t.startMs) / (t.peakMs - t.startMs));
}
