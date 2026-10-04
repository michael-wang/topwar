// Presentation only: gameplay removes enemies independently of these clocks.
export const CROWD_DEATH_STYLES = {
  grunt: { mode: 'vaporize', paleMs: 80, intactMs: 80, totalMs: 300 },
  heavy: { mode: 'shatter', paleMs: 80, intactMs: 100, fragmentMs: 600, fadeMs: 160, totalMs: 700 },
} as const;
export type CrowdDeathStyle = typeof CROWD_DEATH_STYLES[keyof typeof CROWD_DEATH_STYLES];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function enemyDeathPose(ageMs: number, style: CrowdDeathStyle) {
  const dissolve = clamp((ageMs - style.intactMs) / (style.totalMs - style.intactMs));
  const vapor = style.mode === 'vaporize';
  return { pale: clamp(ageMs / style.paleMs),
    bodyVisible: ageMs >= 0 && ageMs < (vapor ? style.totalMs : style.intactMs),
    opacity: vapor ? 1 - dissolve : 1,
    rise: vapor ? .14 * dissolve : 0,
    scale: vapor ? 1 - .28 * dissolve : 1,
    squash: .035 * Math.sin(Math.PI * clamp(ageMs / style.intactMs)) };
}
