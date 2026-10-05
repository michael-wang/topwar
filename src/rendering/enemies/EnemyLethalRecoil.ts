import * as THREE from 'three';
import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

// Presentation only. Rotation is about a low world-space foot pivot, with no
// ground collision, arc, scale animation or recovery toward the living pose.
export const LETHAL_RECOIL = {
  grunt: { distance: .19, angleDegrees: 32, peakMs: 160 },
  heavy: { distance: .15, angleDegrees: 26, peakMs: 280 },
  giant: { distance: .10, angleDegrees: 16, peakMs: 550 },
} as const;
export const LETHAL_FOOT_PIVOT_Y = .04;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
export function lethalRecoilPose(ageMs: number, role: EnemyDeathRole) {
  const style = LETHAL_RECOIL[role], p = clamp(ageMs / style.peakMs);
  const kick = clamp(ageMs / (style.peakMs * .45));
  return { distance: style.distance * (1 - (1 - kick) ** 3),
    angle: style.angleDegrees * Math.PI / 180 * (1 - (1 - p) ** 2) };
}
export function writeLethalDirection(target: THREE.Vector2, captured: THREE.Matrix4,
  attackerX?: number, attackerZ?: number): void {
  if (attackerX === undefined || attackerZ === undefined) { target.set(0, 1); return; }
  const dx = captured.elements[12] - attackerX, dz = captured.elements[14] - attackerZ;
  const length = Math.hypot(dx, dz);
  target.set(length > .001 ? dx / length : 0, length > .001 ? dz / length : 1);
}
// Writes C(age) * captured directly into a reusable matrix. The caller owns the
// immutable capture; body and blood use this exact same transform policy.
export function writeLethalRecoil(target: THREE.Matrix4, captured: THREE.Matrix4,
  ageMs: number, role: EnemyDeathRole, directionX = 0, directionZ = 1): void {
  if (ageMs <= 0) { target.copy(captured); return; }
  const pose = lethalRecoilPose(ageMs, role), c = Math.cos(pose.angle), s = Math.sin(pose.angle);
  const x = directionX, z = directionZ, k = 1 - c;
  // Axis (z,0,-x) rotates the standing +Y mass toward the away direction (x,0,z).
  const r00 = z*z + x*x*c, r01 = x*s, r02 = -x*z*k;
  const r10 = -x*s, r11 = c, r12 = -z*s;
  const r20 = -x*z*k, r21 = z*s, r22 = x*x + z*z*c;
  const m = captured.elements, px = m[12], py = m[13] + LETHAL_FOOT_PIVOT_Y, pz = m[14];
  target.set(r00,r01,r02,px + x*pose.distance - r00*px - r01*py - r02*pz,
    r10,r11,r12,py - r10*px - r11*py - r12*pz,
    r20,r21,r22,pz + z*pose.distance - r20*px - r21*py - r22*pz, 0,0,0,1).multiply(captured);
}
