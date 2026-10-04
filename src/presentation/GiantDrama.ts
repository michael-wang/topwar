// Presentation clocks only: no hit-stop, invulnerability or gameplay delay.
export const GIANT_REVEAL_MS = 1500;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const p = clamp(x); return p * p * (3 - 2 * p); };
export function giantReveal(ageMs: number) {
  const p = smooth(ageMs / GIANT_REVEAL_MS);
  return { opacity: .18 + .82 * p, haze: .78 * (1 - p), barVisible: p >= .72, color: p };
}
