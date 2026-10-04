import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

// Fuller lethal bursts start in a connected upper-body region. Reaction matrices
// carry these points with the defeated body; there is no separate VFX trajectory.
export const LETHAL_BLOOD_ANCHORS = {
  grunt: [[0,.57,.23],[-.07,.47,.18],[.08,.50,.17]],
  heavy: [[0,.60,.27],[-.10,.49,.26],[.10,.46,.26],[-.06,.47,.26]],
  giant: [[0,.96,.20],[-.12,.76,.25],[.12,.70,.24],[0,.54,.28],[-.10,.87,.19]],
} as const;

export function lethalBloodVariation(id: number, role: EnemyDeathRole) {
  const roleSeed = role === 'giant' ? 307 : role === 'heavy' ? 173 : 41;
  const hash = Math.imul(id + roleSeed, 1597334677) >>> 0;
  const anchor = hash % LETHAL_BLOOD_ANCHORS[role].length;
  return { anchor, localAnchor: LETHAL_BLOOD_ANCHORS[role][anchor], variant: (hash >>> 4) % 4,
    angle: (hash % 6283) / 1000, aspect: .9 + ((hash >>> 8) % 1000) / 4000,
    size: .9 + ((hash >>> 16) % 1000) / 5000,
    bias: (hash & 1 ? -1 : 1) * (.3 + ((hash >>> 2) % 1000) / 3333),
    pulseOffset: ((hash >>> 12) % 1000) / 10000 - .05 };
}
