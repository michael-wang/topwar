import { z } from 'zod';

// Opt-in temporary closed-playtest layer. Missing config preserves older capped runs.
export const postCapSurvivalDefaults = {
  enabled: false, startLevel: 6, ordinaryGroupSize: 3, pressureLaneCount: 3, heavyCount: 3,
  giantIntervalSeconds: 24, maxSimultaneousGiants: 1 as const,
  grenadeSupplyIntervalSeconds: 30, grenadeSupplyAmount: 1 as const,
};
export const PostCapSurvivalConfigSchema = z.strictObject({
  enabled: z.boolean(), startLevel: z.number().int().positive(),
  ordinaryGroupSize: z.number().int().min(1).max(16),
  pressureLaneCount: z.number().int().min(1).max(16), heavyCount: z.number().int().min(1).max(16),
  giantIntervalSeconds: z.number().finite().positive(), maxSimultaneousGiants: z.literal(1),
  grenadeSupplyIntervalSeconds: z.number().finite().positive(), grenadeSupplyAmount: z.literal(1),
}).refine(c => c.ordinaryGroupSize === c.heavyCount && c.heavyCount === c.pressureLaneCount,
  { message: 'Temporary post-cap groups require exactly one Heavy per pressure lane' });
