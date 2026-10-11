import { z } from 'zod';
import { ARTILLERY_CAPACITY } from './artilleryConfig';
export const NavalBarrageConfigSchema = z.strictObject({
  version: z.literal(1), enabled: z.boolean(), streamSeed: z.number().int().min(0).max(0xffffffff),
  minimumShells: z.number().int().min(1).max(ARTILLERY_CAPACITY), maximumShells: z.number().int().min(1).max(ARTILLERY_CAPACITY),
  minimumIntervalSeconds: z.number().finite().min(.1).max(60), maximumIntervalSeconds: z.number().finite().min(.1).max(60),
  targetLanes: z.array(z.number().int().min(0).max(15)).min(1).max(16),
}).refine(c => c.minimumShells <= c.maximumShells && c.minimumIntervalSeconds <= c.maximumIntervalSeconds
  && c.maximumShells <= c.targetLanes.length && new Set(c.targetLanes).size === c.targetLanes.length,
  'Barrage bounds must be ordered and permit distinct lanes within each salvo');
export type NavalBarrageConfig = z.infer<typeof NavalBarrageConfigSchema>;
