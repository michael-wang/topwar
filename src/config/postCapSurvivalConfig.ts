import { z } from 'zod';
const ordinaryProfile = z.strictObject({
  startLevel: z.number().int().positive(), ordinaryGroupSize: z.number().int().min(1).max(180),
  pressureLaneCount: z.number().int().min(1).max(16), heavyCount: z.number().int().min(1).max(180),
  ordinarySpeedMultiplier: z.number().finite().positive().max(4).optional(),
  waveIntervalSeconds: z.number().finite().positive().optional(),
});

// Opt-in temporary closed-playtest layer. Missing config preserves older capped runs.
export const postCapSurvivalDefaults = {
  enabled: false, startLevel: 6, ordinaryGroupSize: 3, pressureLaneCount: 3, heavyCount: 3,
  giantIntervalSeconds: 24, maxSimultaneousGiants: 1 as const,
  grenadeSupplyIntervalSeconds: 30, grenadeSupplyAmount: 1 as const,
};
export const PostCapSurvivalConfigSchema = z.strictObject({
  enabled: z.boolean(), startLevel: z.number().int().positive(),
  ordinaryGroupSize: z.number().int().min(1).max(180),
  pressureLaneCount: z.number().int().min(1).max(16), heavyCount: z.number().int().min(1).max(16),
  giantIntervalSeconds: z.number().finite().positive(), maxSimultaneousGiants: z.literal(1),
  grenadeSupplyIntervalSeconds: z.number().finite().positive(), grenadeSupplyAmount: z.literal(1),
  // Absent options retain serialized historical groups and their wave clock.
  advancedProfile: ordinaryProfile.optional(),
  capProfile: ordinaryProfile.optional(),
  waveIntervalSeconds: z.number().finite().positive().optional(),
  firstWaveDelaySeconds: z.number().finite().positive().optional(),
  maxActiveEnemies: z.number().int().min(1).max(180).optional(),
}).refine(c => c.heavyCount <= c.ordinaryGroupSize && c.pressureLaneCount <= c.ordinaryGroupSize
  && (!c.advancedProfile || c.advancedProfile.heavyCount <= c.advancedProfile.ordinaryGroupSize
    && c.advancedProfile.pressureLaneCount <= c.advancedProfile.ordinaryGroupSize
    && c.advancedProfile.startLevel > c.startLevel)
  && (!c.capProfile || c.capProfile.heavyCount <= c.capProfile.ordinaryGroupSize
    && c.capProfile.pressureLaneCount <= c.capProfile.ordinaryGroupSize
    && c.capProfile.startLevel > (c.advancedProfile?.startLevel ?? c.startLevel))
  && (c.maxActiveEnemies === undefined || c.ordinaryGroupSize <= c.maxActiveEnemies
    && (!c.advancedProfile || c.advancedProfile.ordinaryGroupSize <= c.maxActiveEnemies)
    && (!c.capProfile || c.capProfile.ordinaryGroupSize <= c.maxActiveEnemies)),
  { message: 'Survival profiles must fit their group, level boundary and optional population cap' });
