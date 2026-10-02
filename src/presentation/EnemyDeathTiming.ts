// Disposable kill presentation, independent of collision and gameplay time.
export const ENEMY_DEATH_MS = 600;
export const ENEMY_DEATH_POP = .25;
export const ENEMY_DEATH_RISE = 1.65;

export function enemyDeathPose(ageMs: number): { rise: number; opacity: number; progress: number } {
  const progress = Math.max(0, Math.min(1, ageMs / ENEMY_DEATH_MS));
  return { progress, rise: ENEMY_DEATH_POP + ENEMY_DEATH_RISE * (1 - (1 - progress) ** 2),
    opacity: Math.max(0, Math.min(1, (1 - progress) / .7)) };
}
