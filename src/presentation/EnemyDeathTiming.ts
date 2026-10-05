import { GRUNT_DEATH_BODY } from './GruntDeathBody';
// Presentation only. Gameplay removal is independent of these clocks.
// Grunt has no body breakup clocks; its lift uses GruntDeathBody.
export const ENEMY_DEATH_TIMING = {
  grunt: { fadeStartMs: GRUNT_DEATH_BODY.fadeStartMs, totalMs: GRUNT_DEATH_BODY.totalMs, stainDiameter: .34 },
  heavy: { breakupEndMs: 825, breakupStartMs: 260, breakupDistance: .15, fadeStartMs: 650, totalMs: 1100, stainDiameter: .64 },
  giant: { breakupEndMs: 1950, breakupStartMs: 650, breakupDistance: .24, fadeStartMs: 1550, totalMs: 2600, stainDiameter: .95 },
} as const;
export type EnemyDeathRole = keyof typeof ENEMY_DEATH_TIMING;
export type EnemyDeathTiming = typeof ENEMY_DEATH_TIMING['heavy' | 'giant'];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
export function enemyDeathPose(ageMs: number, timing: EnemyDeathTiming) {
  const progress = clamp(ageMs / timing.totalMs);
  return { progress, bodyVisible: ageMs >= 0 && ageMs < timing.totalMs,
    breakup: timing.breakupDistance * smooth((ageMs - timing.breakupStartMs) / (timing.breakupEndMs - timing.breakupStartMs)),
    bodyOpacity: 1 - smooth((ageMs - timing.fadeStartMs) / (timing.totalMs - timing.fadeStartMs)) };
}

// Open a narrow seam during the existing transition pose, then let the accepted
// breakup curve take over. The maximum separation and fade clocks do not change.
export const ENEMY_SHELL_OPENING = { heavy: { startMs: 150, readyMs: 230 }, giant: { startMs: 400, readyMs: 600 } } as const;
export function enemyBodyOpening(ageMs: number, role: 'heavy' | 'giant', breakup: number): number {
  const opening = ENEMY_SHELL_OPENING[role];
  return Math.max(breakup, ENEMY_DEATH_TIMING[role].breakupDistance * .28 * smooth((ageMs - opening.startMs) / (opening.readyMs - opening.startMs)));
}

// Cards remain only for small bullet contacts (surviving or lethal Grunt) and Player casualties.
export interface BloodSplatTiming { readonly bloodStartMs: number; readonly bloodEndMs: number; readonly bloodPulseCount: number; readonly bloodScale: number }
export function bloodSplatPose(ageMs: number, timing: BloodSplatTiming) {
  const progress = clamp((ageMs - timing.bloodStartMs) / (timing.bloodEndMs - timing.bloodStartMs));
  const opacity = .84 * (1 - smooth((progress - .88) / .12));
  const beat = (1 - Math.cos(progress * timing.bloodPulseCount * Math.PI * 2)) / 2;
  return { visible: ageMs >= timing.bloodStartMs && ageMs < timing.bloodEndMs,
    scale: (.86 + .44 * beat * (1 - .14 * progress)) * (.25 + .75 * smooth(progress / .09)),
    opacity };
}

// Freeze first, then two deliberately simple authored sink/hands-up silhouettes.
export const ENEMY_REACTION_TIMING = {
  heavy: { startMs: 70, endMs: 260 },
  giant: { startMs: 180, endMs: 650 },
} as const;
export function enemyReactionStage(ageMs: number, role: 'heavy' | 'giant'): 0 | 1 | 2 {
  const timing = ENEMY_REACTION_TIMING[role];
  return ageMs < timing.startMs ? 0 : ageMs < timing.endMs ? 1 : 2;
}
