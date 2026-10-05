// Mass casualties keep the exact captured pose; priority threats retain physical breakup.
export const GRUNT_DEATH_BODY = { totalMs: 520, liftStartMs: 50, liftEndMs: 350,
  liftUnits: .26, fadeStartMs: 140 } as const;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
export function gruntDeathBody(ageMs: number): { lift: number; opacity: number; visible: boolean } {
  const t = GRUNT_DEATH_BODY;
  const rise = clamp((ageMs - t.liftStartMs) / (t.liftEndMs - t.liftStartMs));
  const fade = clamp((ageMs - t.fadeStartMs) / (t.totalMs - t.fadeStartMs));
  return { lift: t.liftUnits * (1 - (1 - rise) ** 2),
    opacity: 1 - fade * fade * (3 - 2 * fade), visible: ageMs >= 0 && ageMs < t.totalMs };
}
