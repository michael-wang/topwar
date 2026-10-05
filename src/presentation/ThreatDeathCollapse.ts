// Priority-threat weight is a downward settle, then a hold; never a depth retreat.
export const THREAT_DEATH_COLLAPSE = {
  heavy: { startMs: 80, peakMs: 300, holdEndMs: 420, sinkUnits: .13, angleDegrees: 22 },
  giant: { startMs: 150, peakMs: 650, holdEndMs: 850, sinkUnits: .22, angleDegrees: 16 },
} as const;
const smooth = (p: number) => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
export function threatCollapseProgress(ageMs: number, role: 'heavy' | 'giant'): number {
  const t = THREAT_DEATH_COLLAPSE[role];
  return smooth((ageMs - t.startMs) / (t.peakMs - t.startMs));
}
// The complete maul + grip settles a little later than the torso, as one assembly.
export function giantMaulSettle(ageMs: number): number { return .035 * smooth((ageMs - 230) / 470); }
