// Presentation clocks only: no hit-stop, invulnerability or gameplay delay.
export const GIANT_REVEAL_MS = 1500;
export const GIANT_CRASH_MS = 520;
export const GIANT_BREAKUP_MS = GIANT_CRASH_MS;
export const GIANT_DEATH_MS = 2400;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const p = clamp(x); return p * p * (3 - 2 * p); };
export function giantReveal(ageMs: number) {
  const p = smooth(ageMs / GIANT_REVEAL_MS);
  return { opacity: .18 + .82 * p, haze: .78 * (1 - p), barVisible: p >= .72, color: p };
}
export function giantDeathPose(ageMs: number) {
  return { falling: smooth((ageMs - 90) / (GIANT_CRASH_MS - 90)),
    pale: clamp(ageMs / 120), bodyVisible: ageMs >= 0 && ageMs < GIANT_BREAKUP_MS,
    crash: ageMs >= GIANT_CRASH_MS, debrisVisible: ageMs >= GIANT_BREAKUP_MS && ageMs < GIANT_DEATH_MS,
    debrisOpacity: 1 - smooth((ageMs - 1550) / (GIANT_DEATH_MS - 1550)),
    ringOpacity: ageMs < GIANT_CRASH_MS ? 0 : .8 * (1 - clamp((ageMs - GIANT_CRASH_MS) / 600)) };
}
