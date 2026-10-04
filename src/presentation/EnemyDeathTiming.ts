// Presentation only. Gameplay removal is independent of these clocks.
export const ENEMY_DEATH_TIMING = {
  grunt: { grayEndMs: 35, bloodStartMs: 25, bloodEndMs: 165, redStartMs: 110,
    redCompleteMs: 165, fadeStartMs: 185, totalMs: 300, bloodPulseCount: 2, bloodScale: 1, stainDiameter: .33 },
  heavy: { grayEndMs: 70, bloodStartMs: 45, bloodEndMs: 410, redStartMs: 300,
    redCompleteMs: 440, fadeStartMs: 490, totalMs: 850, bloodPulseCount: 3, bloodScale: 1.45, stainDiameter: .525 },
  giant: { grayEndMs: 160, bloodStartMs: 120, bloodEndMs: 1050, redStartMs: 850,
    redCompleteMs: 1150, fadeStartMs: 1250, totalMs: 2200, bloodPulseCount: 5, bloodScale: 2.2, stainDiameter: .825 },
} as const;
export type EnemyDeathRole = keyof typeof ENEMY_DEATH_TIMING;
export type EnemyDeathTiming = typeof ENEMY_DEATH_TIMING[EnemyDeathRole];
export const ENEMY_DEATH_GRAY = '#9ea5a3';
export const ENEMY_DEATH_RED = '#68252a';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
export function enemyDeathPose(ageMs: number, timing: EnemyDeathTiming) {
  const progress = clamp(ageMs / timing.totalMs);
  return { progress, bodyVisible: ageMs >= 0 && ageMs < timing.totalMs,
    gray: smooth(ageMs / timing.grayEndMs),
    red: smooth((ageMs - timing.redStartMs) / (timing.redCompleteMs - timing.redStartMs)),
    bodyOpacity: 1 - smooth((ageMs - timing.fadeStartMs) / (timing.totalMs - timing.fadeStartMs)) };
}

export function bloodSplatPose(ageMs: number, timing: EnemyDeathTiming) {
  const progress = clamp((ageMs - timing.bloodStartMs) / (timing.bloodEndMs - timing.bloodStartMs));
  const beat = (1 - Math.cos(progress * timing.bloodPulseCount * Math.PI * 2)) / 2;
  return { visible: ageMs >= timing.bloodStartMs && ageMs < timing.bloodEndMs,
    scale: (.86 + .44 * beat * (1 - .14 * progress)) * (.25 + .75 * smooth(progress / .09)),
    opacity: .84 * (1 - smooth((progress - .88) / .12)) };
}
