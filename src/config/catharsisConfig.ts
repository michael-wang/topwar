import { z } from 'zod';

// Temporary lane experiment, separate from the retained tier/Boss balance.
export const CatharsisConfigSchema = z.strictObject({
  progression: z.strictObject({
    xpRequirements: z.array(z.number().int().positive()).min(1).default([28, 60, 110, 180, 280, 420]),
    xpFallbackMultiplier: z.number().finite().gt(1).default(1.45),
    gruntKillXp: z.number().int().nonnegative().default(1),
    heavyKillXp: z.number().int().nonnegative().default(10),
    fireRatePerLevel: z.number().finite().nonnegative().default(1),
  }).default({ xpRequirements: [28, 60, 110, 180, 280, 420], xpFallbackMultiplier: 1.45, gruntKillXp: 1, heavyKillXp: 10, fireRatePerLevel: 1 }),
  heavyFrontClearance: z.number().finite().nonnegative().default(2.5),
  defenseMode: z.boolean().default(false),
  defenseSpawnAheadDistance: z.number().finite().positive().default(53),
  crowdDepthSpan: z.number().finite().positive().default(5),
  laneSwitchSeconds: z.number().finite().positive().default(.15),
  lateralSpreadFraction: z.number().finite().min(0).max(.45).default(.26),
  memberDepthSpacing: z.number().finite().positive().default(.85),
  depthJitter: z.number().finite().nonnegative().default(.35),
  laneCount: z.number().int().min(3).max(16),
  edgeInset: z.number().finite().positive(),
  waveRows: z.number().int().min(2),
  priorityWaves: z.number().int().min(1).max(10),
  // Absent in older snapshots: retain their one/two-front composition path.
  pressureLaneCount: z.number().int().min(1).max(16).optional(),
  groupSize: z.number().int().min(1).max(100),
  groupRowStride: z.number().int().positive(),
  secondLaneChance: z.number().min(0).max(1),
  heavyChance: z.number().min(0).max(1),
  gruntSpeed: z.number().finite().nonnegative(),
  heavySpeed: z.number().finite().nonnegative(),
  heavyHp: z.number().finite().gt(1),
  enemyVisualScale: z.number().finite().positive(),
  heavyVisualScale: z.number().finite().gt(1),
  heavyWidthMultiplier: z.number().finite().positive().max(2).default(1),
  heavyHeightMultiplier: z.number().finite().positive().max(2).default(1),
  heavyDepthMultiplier: z.number().finite().positive().max(2).default(1),
  rewardAimRadius: z.number().finite().positive(),
}).refine((value) => value.defenseMode || (value.groupSize - 1) * value.groupRowStride < value.waveRows,
  { message: 'Group must fit inside one wave' })
  .refine(value => value.pressureLaneCount === undefined || value.pressureLaneCount <= value.laneCount,
    { message: 'Pressure lane count must fit inside the battlefield' });

export type CatharsisConfig = z.infer<typeof CatharsisConfigSchema>;
