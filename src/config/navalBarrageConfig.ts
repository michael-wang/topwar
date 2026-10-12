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
    // Historical discrete distributions remain serialized exactly as authored.
    gapsSeconds: z.array(z.number().finite().min(0).max(60)).min(1).max(16).optional(),
    minimumGapSeconds: z.number().finite().min(0).max(60).optional(),
    maximumGapSeconds: z.number().finite().min(0).max(60).optional(),
  }).refine(c => c.gapsSeconds !== undefined
    ? c.minimumGapSeconds === undefined && c.maximumGapSeconds === undefined
      && new Set(c.gapsSeconds).size === c.gapsSeconds.length
    : c.minimumGapSeconds !== undefined && c.maximumGapSeconds !== undefined
      && c.minimumGapSeconds <= c.maximumGapSeconds,
    'Choose distinct discrete gaps or an ordered continuous range').optional(),
}).refine(c => c.minimumShells <= c.maximumShells && c.minimumIntervalSeconds <= c.maximumIntervalSeconds
  && c.maximumShells <= c.targetLanes.length && new Set(c.targetLanes).size === c.targetLanes.length,
  'Barrage bounds must be ordered and permit distinct lanes within each salvo')
  .refine(c => !c.postImpactCooldown || c.overlapPolicy === 'waitForImpact',
  'Post-impact cooldown requires non-overlap');
export type NavalBarrageConfig = z.infer<typeof NavalBarrageConfigSchema>;
