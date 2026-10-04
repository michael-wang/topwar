// Rendering-only analytic contact. No collision or physics state enters gameplay.
export function fragmentLandingSeconds(originY: number, velocityY: number, floorY: number, gravity: number): number {
  return (velocityY + Math.sqrt(velocityY * velocityY + 2 * gravity * Math.max(0, originY - floorY))) / gravity;
}
