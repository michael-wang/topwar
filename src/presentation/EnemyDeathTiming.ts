// Presentation only. Gameplay removal is independent of these clocks.
export const ENEMY_DEATH_TIMING = {
  grunt: { totalMs: 280, grayMs: 45, bloodMs: 35, shatterMs: 110, spread: .24 },
  heavy: { totalMs: 450, grayMs: 65, bloodMs: 45, shatterMs: 160, spread: .32 },
  giant: { totalMs: 850, grayMs: 100, bloodMs: 65, shatterMs: 250, spread: .45 },
} as const;
export type EnemyDeathRole = keyof typeof ENEMY_DEATH_TIMING;
export type EnemyDeathTiming = typeof ENEMY_DEATH_TIMING[EnemyDeathRole];
export const ENEMY_DEATH_GRAY = '#9ea5a3';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
export function enemyFragmentOpacity(progress: number): number { return 1 - smooth(progress); }
export function enemyDeathPose(ageMs: number, timing: EnemyDeathTiming) {
  const progress = clamp(ageMs / timing.totalMs);
  const bodyVisible = ageMs >= 0 && ageMs < timing.shatterMs;
  const fragmentProgress = clamp((ageMs - timing.shatterMs) / (timing.totalMs - timing.shatterMs));
  return { progress, bodyVisible, gray: smooth(ageMs / timing.grayMs), bodyOpacity: bodyVisible ? 1 : 0,
    shattered: ageMs >= timing.shatterMs && ageMs < timing.totalMs,
    fragmentProgress, fragmentOpacity: enemyFragmentOpacity(fragmentProgress) };
}
