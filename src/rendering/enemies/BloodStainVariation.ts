import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const STAIN_COLORS = ['#602327', '#6d2528', '#792a30'] as const;
const OFFSET = { grunt: .035, heavy: .055, giant: .08 } as const;

// Independent deterministic channels keep the footprint near the casualty while
// avoiding a repeated stamp. Aspect changes preserve area and role size identity.
export function bloodStainVariation(id: number, role: EnemyDeathRole) {
  let hash = (Math.imul(id + 1, 1597334677) ^ { grunt: 41, heavy: 173, giant: 307 }[role]) >>> 0;
  const sample = () => { hash = (Math.imul(hash ^ (hash >>> 16), 2246822507) + 3266489909) >>> 0; return hash / 4294967296; };
  return { variant: Math.floor(sample() * 4), angle: sample() * Math.PI * 2,
    scale: .88 + sample() * .24, aspect: .85 + sample() * .35,
    opacity: .50 + sample() * .16, color: Math.floor(sample() * STAIN_COLORS.length),
    offsetX: (sample() * 2 - 1) * OFFSET[role], offsetZ: (sample() * 2 - 1) * OFFSET[role] };
}
