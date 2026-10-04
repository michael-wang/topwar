import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
// Actual model-local surface points (+Z is the face), not crown-height fractions.
// Open face, shoulders and jacket/harness each have a distinct emission site.
export const HIT_BLOOD_ANCHORS = {
  grunt: [[0,.715,.235],[-.12,.365,.16],[.12,.365,.16]],
  heavy: [[0,.655,.267],[-.20,.45,.22],[.20,.43,.22],[-.12,.29,.245]],
  giant: [[0,1.05,.202],[0,.825,.19],[-.23,.64,.235],[.23,.64,.235],[.12,.43,.275],[-.27,.765,.17]],
} as const;
export function hitBloodVariation(id: number, sequence: number, role: EnemyDeathRole) {
  const seed = Math.imul(id + 1, 1597334677) >>> 0;
  const hash = (seed ^ Math.imul(sequence, 3812015801)) >>> 0;
  const anchors = HIT_BLOOD_ANCHORS[role];
  const anchor = (seed % anchors.length + sequence) % anchors.length;
  return { anchor, localAnchor: anchors[anchor],
    variant: (seed + sequence) % 4,
    // A mostly lateral splash, sometimes flipped; not an upward fountain.
    angle: (hash & 1 ? Math.PI : 0) + ((hash % 1000) / 1000 - .5) * .9,
    bias: (hash & 2 ? -1 : 1) * (.45 + ((hash >>> 4) % 1000) / 2000),
    satelliteCount: 2 + (((seed + sequence) % 4 + 1) % 3),
    aspect: .82 + ((hash >>> 8) % 1000) / 1000 * .38,
    size: .85 + ((hash >>> 16) % 1000) / 1000 * .30 };
}
