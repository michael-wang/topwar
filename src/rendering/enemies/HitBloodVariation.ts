import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
// Authored on visible upper/lower torso, relative to helmet crown. No hit-point
// or collision changes. Adjacent sequences rotate through anchors and masks.
export const HIT_BLOOD_ANCHORS = {
  grunt: [[-.12,.58],[.12,.58],[0,.45]],
  heavy: [[-.20,.60],[.20,.57],[-.14,.43],[.14,.43]],
  giant: [[-.19,.61],[.19,.61],[0,.51],[-.18,.39],[.18,.39],[0,.68]],
} as const;
export function hitBloodVariation(id: number, sequence: number, role: EnemyDeathRole) {
  const seed = Math.imul(id + 1, 1597334677) >>> 0;
  const hash = (seed ^ Math.imul(sequence, 3812015801)) >>> 0;
  const anchors = HIT_BLOOD_ANCHORS[role];
  const anchor = (seed % anchors.length + sequence) % anchors.length;
  return { anchor, x: anchors[anchor][0], y: anchors[anchor][1],
    variant: (seed + sequence) % 4,
    angle: (hash % 6283) / 1000,
    aspect: .82 + ((hash >>> 8) % 1000) / 1000 * .38,
    size: .85 + ((hash >>> 16) % 1000) / 1000 * .30 };
}
