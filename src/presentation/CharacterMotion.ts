// Presentation clocks never control simulation input, cooldowns or hitboxes.
export const LANE_LOCOMOTION_MS = 220;
export const RECOIL_SETTLE_MS = 150;
export function recoilEnvelope(ageMs: number): number {
  if (ageMs < 0 || ageMs >= RECOIL_SETTLE_MS) return 0;
  return Math.exp(-ageMs / 38) * Math.cos(ageMs / 37);
}
export function laneLocomotion(ageMs: number, direction: number, member: number, previousLean = 0) {
  if (ageMs < 0 || ageMs >= LANE_LOCOMOTION_MS) return { stride: 0, lean: 0, bob: 0, lag: 0 };
  const p = Math.max(0, Math.min(1, ageMs / LANE_LOCOMOTION_MS));
  const weight = Math.sin(Math.PI * p);
  const stride = Math.sin(p * Math.PI * 4 + member * .65) * weight;
  return { stride, lean: previousLean * Math.exp(-ageMs / 35) + direction * (.16 * weight - .035 * Math.sin(p * Math.PI * 2) - (p < .10 ? .045 * Math.sin(p * Math.PI / .10) : 0)),
    bob: Math.abs(stride) * .025, lag: direction * .035 * Math.sin(p * Math.PI) };
}
export function stepWeightPose(id: number, nowMs: number, cycleMs: number) {
  // Same phase as the four baked A/B/C/D frames: A/C support, B/D landing.
  const phase = (nowMs / (cycleMs / 4) + id * 1.52788745) * Math.PI / 2;
  return { phase, support: Math.cos(phase), landing: Math.pow(Math.abs(Math.sin(phase)), 8) };
}
export function giantWeightPose(id: number, nowMs: number, cycleMs: number) {
  const { phase, support, landing } = stepWeightPose(id, nowMs, cycleMs);
  return { phase, shift: support * .052, sway: support * .036, compression: landing * .018,
    bob: (1 - landing) * .009, arm: Math.cos(phase - .3) * .15,
    weapon: Math.cos(phase - .85) * .14, shoulder: Math.cos(phase - .2) * .025 };
}
