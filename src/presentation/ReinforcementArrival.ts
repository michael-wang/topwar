// Presentation-only entrance follows the serialized simulation arrival clock.
export function reinforcementArrivalPose(progress: number): { backOffset: number; sideOffset: number; bob: number; lean: number; weaponLower: number } {
  const p = Math.min(1, Math.max(0, progress));
  const run = Math.min(1, p / .82), remaining = (1 - run) ** 2;
  return { backOffset: -6 * remaining, sideOffset: .75 * remaining,
    bob: Math.abs(Math.sin(p * Math.PI * 10)) * .065 * (1 - run),
    lean: .16 * (1 - run), weaponLower: .7 * (1 - smoothReady(p)) };
}

function smoothReady(p: number): number {
  const t = Math.min(1, Math.max(0, (p - .75) / .25));
  return t * t * (3 - 2 * t);
}
