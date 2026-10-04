// Presentation only. Gameplay removal is independent of these clocks.
export const ENEMY_DEATH_DURATION_MS = { grunt: 425, heavy: 750, giant: 1450 } as const;
export const ENEMY_DEATH_GRAY = '#aeb5b3';
export const ENEMY_DEATH_FALL_RADIANS = 80 * Math.PI / 180;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
export function enemyDeathPose(ageMs: number, totalMs: number) {
  if (!(totalMs > 0) || !Number.isFinite(totalMs)) throw new Error('Death duration must be finite and positive');
  const progress = clamp(ageMs / totalMs);
  return { progress, bodyVisible: ageMs >= 0 && ageMs < totalMs,
    fall: smooth(progress / .45), gray: smooth((progress - .38) / .27),
    opacity: 1 - smooth((progress - .65) / .35) };
}
