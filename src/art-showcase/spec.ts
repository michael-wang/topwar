export type ShowcaseView = 'comparison' | 'player' | 'player-side' | 'enemy' | 'running' | 'boss' | 'projectile' | 'death';

export const SHOWCASE_WIDTH = 720;
export const SHOWCASE_HEIGHT = 1280;
export const DEATH_DURATION_SECONDS = 0.43;
export const DEATH_GRAY_SECONDS = 0.1;
export const DEATH_RISE_UNITS = 1.8;

export const VIEWS: readonly { id: ShowcaseView; label: string }[] = [
  { id: 'comparison', label: 'COMPARISON' },
  { id: 'player', label: 'PLAYER ¾' },
  { id: 'player-side', label: 'PLAYER FIRING' },
  { id: 'enemy', label: 'ENEMY IDLE' },
  { id: 'running', label: 'ENEMY RUN' },
  { id: 'boss', label: 'BOSS' },
  { id: 'projectile', label: 'PROJECTILE' },
  { id: 'death', label: 'DEATH' },
];

export function deathPose(seconds: number): { gray: number; rise: number; opacity: number } {
  const t = Math.max(0, Math.min(DEATH_DURATION_SECONDS, seconds));
  return {
    gray: Math.min(1, t / DEATH_GRAY_SECONDS),
    rise: DEATH_RISE_UNITS * (t / DEATH_DURATION_SECONDS),
    opacity: t < DEATH_GRAY_SECONDS ? 1 : Math.max(0, 1 - (t - DEATH_GRAY_SECONDS) / (DEATH_DURATION_SECONDS - DEATH_GRAY_SECONDS)),
  };
}
