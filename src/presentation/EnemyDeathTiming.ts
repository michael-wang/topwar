// Presentation only. Gameplay removal is independent of these clocks.
export const ENEMY_DEATH_TIMING = {
  grunt: { grayEndMs: 390, breakupStartMs: 130, breakupDistance: .10, fadeStartMs: 300, totalMs: 520, stainDiameter: .34 },
  heavy: { grayEndMs: 825, breakupStartMs: 260, breakupDistance: .15, fadeStartMs: 650, totalMs: 1100, stainDiameter: .64 },
  giant: { grayEndMs: 1950, breakupStartMs: 650, breakupDistance: .24, fadeStartMs: 1550, totalMs: 2600, stainDiameter: .95 },
} as const;
export type EnemyDeathRole = keyof typeof ENEMY_DEATH_TIMING;
export type EnemyDeathTiming = typeof ENEMY_DEATH_TIMING[EnemyDeathRole];
export const ENEMY_DEATH_GRAY = '#b9beba';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
export function enemyDeathPose(ageMs: number, timing: EnemyDeathTiming) {
  const progress = clamp(ageMs / timing.totalMs);
  return { progress, bodyVisible: ageMs >= 0 && ageMs < timing.totalMs,
    gray: smooth((ageMs - timing.breakupStartMs) / (timing.grayEndMs - timing.breakupStartMs)),
    breakup: timing.breakupDistance * smooth((ageMs - timing.breakupStartMs) / (timing.grayEndMs - timing.breakupStartMs)),
    bodyOpacity: 1 - smooth((ageMs - timing.fadeStartMs) / (timing.totalMs - timing.fadeStartMs)) };
}

export interface BloodSplatTiming { readonly bloodStartMs: number; readonly bloodEndMs: number; readonly bloodPulseCount: number; readonly bloodScale: number; readonly bloodPulseEndMs?: number; readonly fadeStartMs?: number }
export function bloodSplatPose(ageMs: number, timing: BloodSplatTiming, pulseOffset = 0) {
  const pulseEnd = timing.bloodPulseEndMs ?? timing.bloodEndMs;
  const progress = clamp((ageMs - timing.bloodStartMs) / (pulseEnd - timing.bloodStartMs));
  const opacity = timing.fadeStartMs === undefined
    ? .84 * (1 - smooth((progress - .88) / .12))
    : (.84 - .26 * smooth((ageMs - pulseEnd) / (timing.fadeStartMs - pulseEnd)))
      * (1 - smooth((ageMs - timing.fadeStartMs) / (timing.bloodEndMs - timing.fadeStartMs)));
  const beat = (1 - Math.cos((progress * timing.bloodPulseCount + pulseOffset * smooth(progress / .15)) * Math.PI * 2)) / 2;
  return { visible: ageMs >= timing.bloodStartMs && ageMs < timing.bloodEndMs,
    scale: (.86 + .44 * beat * (1 - .14 * progress)) * (.25 + .75 * smooth(progress / .09)),
    opacity };
}

// Freeze first, then two deliberately simple authored sink/hands-up silhouettes.
export const ENEMY_REACTION_TIMING = {
  grunt: { startMs: 35, endMs: 130 },
  heavy: { startMs: 70, endMs: 260 },
  giant: { startMs: 180, endMs: 650 },
} as const;
export function enemyReactionStage(ageMs: number, role: EnemyDeathRole): 0 | 1 | 2 {
  const timing = ENEMY_REACTION_TIMING[role];
  return ageMs < timing.startMs ? 0 : ageMs < timing.endMs ? 1 : 2;
}
