import { z } from 'zod';
import { ARTILLERY_CAPACITY } from './artilleryConfig';
export const NavalBarrageConfigSchema = z.strictObject({
  version: z.literal(1), enabled: z.boolean(), streamSeed: z.number().int().min(0).max(0xffffffff),
  minimumShells: z.number().int().min(1).max(ARTILLERY_CAPACITY), maximumShells: z.number().int().min(1).max(ARTILLERY_CAPACITY),
  minimumIntervalSeconds: z.number().finite().min(.1).max(60), maximumIntervalSeconds: z.number().finite().min(.1).max(60),
  targetLanes: z.array(z.number().int().min(0).max(15)).min(1).max(16),
  // Missing in historical snapshots: their salvos may overlap.
  overlapPolicy: z.literal('waitForImpact').optional(),
  postImpactCooldown: z.strictObject({
    initialDelaySeconds: z.number().finite().min(0).max(60),
    gapsSeconds: z.array(z.number().finite().min(0).max(60)).min(1).max(16),
  }).optional(),
}).refine(c => c.minimumShells <= c.maximumShells && c.minimumIntervalSeconds <= c.maximumIntervalSeconds
  && c.maximumShells <= c.targetLanes.length && new Set(c.targetLanes).size === c.targetLanes.length,
  'Barrage bounds must be ordered and permit distinct lanes within each salvo')
  .refine(c => !c.postImpactCooldown || c.overlapPolicy === 'waitForImpact'
    && new Set(c.postImpactCooldown.gapsSeconds).size === c.postImpactCooldown.gapsSeconds.length,
  'Post-impact cooldown requires non-overlap and distinct equally weighted gaps');
export type NavalBarrageConfig = z.infer<typeof NavalBarrageConfigSchema>;
