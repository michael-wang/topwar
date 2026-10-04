// Disposable kill presentation, independent of collision and gameplay time.
export const ENEMY_SHATTER_MS = 110;
export const ENEMY_FRAGMENT_MS = 900;
export const ENEMY_DEATH_MS = ENEMY_SHATTER_MS + ENEMY_FRAGMENT_MS;

export function enemyDeathPose(ageMs: number) {
  const progress = Math.max(0, Math.min(1, ageMs / ENEMY_DEATH_MS));
  const pale = Math.max(0, Math.min(1, ageMs / 80));
  return { progress, pale, bodyVisible: ageMs >= 0 && ageMs < ENEMY_SHATTER_MS,
    // A restrained planted compression replaces the old rising/fading corpse.
    squash: .035 * Math.sin(Math.PI * Math.min(1, Math.max(0, ageMs / ENEMY_SHATTER_MS))) };
}
