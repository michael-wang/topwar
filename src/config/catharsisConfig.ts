import { z } from 'zod';

// Temporary lane experiment, separate from the retained tier/Boss balance.
export const CatharsisConfigSchema = z.strictObject({
  laneCount: z.number().int().min(3).max(16),
  edgeInset: z.number().finite().positive(),
  waveRows: z.number().int().min(2),
  priorityWaves: z.number().int().min(1).max(10),
  groupSize: z.number().int().min(1).max(10),
  groupRowStride: z.number().int().positive(),
  secondLaneChance: z.number().min(0).max(1),
  heavyChance: z.number().min(0).max(1),
  gruntSpeed: z.number().finite().nonnegative(),
  heavySpeed: z.number().finite().nonnegative(),
  heavyHp: z.number().finite().gt(1),
  enemyVisualScale: z.number().finite().positive(),
  heavyVisualScale: z.number().finite().gt(1),
  rewardAimRadius: z.number().finite().positive(),
}).refine((value) => (value.groupSize - 1) * value.groupRowStride < value.waveRows,
  { message: 'Group must fit inside one wave' });

export type CatharsisConfig = z.infer<typeof CatharsisConfigSchema>;
