// Presentation only: gameplay removes enemies independently of these clocks.
export const CROWD_DEATH_STYLES = {
  grunt: { mode: 'gray-rise-fade', tint: '#bfc5c1', paleMs: 80, intactMs: 80, totalMs: 320 },
  heavy: { mode: 'shatter', tint: '#d8d9d1', paleMs: 80, intactMs: 100, fragmentMs: 600, fadeMs: 160, totalMs: 700 },
} as const;
export type CrowdDeathStyle = typeof CROWD_DEATH_STYLES[keyof typeof CROWD_DEATH_STYLES];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function enemyDeathPose(ageMs: number, style: CrowdDeathStyle) {
  const progress = clamp((ageMs - style.intactMs) / (style.totalMs - style.intactMs));
  const drift = progress * progress * (3 - 2 * progress);
  const fade = style.mode === 'gray-rise-fade';
  return { pale: clamp(ageMs / style.paleMs),
    bodyVisible: ageMs >= 0 && ageMs < (fade ? style.totalMs : style.intactMs),
    opacity: fade ? 1 - drift : 1,
    rise: fade ? .18 * drift : 0,
    scale: 1,
    squash: fade ? 0 : .035 * Math.sin(Math.PI * clamp(ageMs / style.intactMs)) };
}
