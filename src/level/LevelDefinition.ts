import { z } from 'zod';

const nonEmptyId = z.string().refine((value) => value.trim().length > 0, 'Must be a non-empty string');
const positiveSafeInteger = z.number().finite().int().positive()
  .refine(Number.isSafeInteger, 'Must be a safe integer');
const nonnegativeSafeInteger = z.number().finite().int().nonnegative()
  .refine(Number.isSafeInteger, 'Must be a safe integer');

const EnemyStreamSchema = z.strictObject({
  enemy: z.literal('grunt'),
  startZ: z.number().finite().nonnegative(),
  spawnAheadDistance: z.number().finite().positive(),
  columns: positiveSafeInteger,
  spacing: z.number().finite().positive(),
  columnSpacing: z.number().finite().positive().optional(),
  jitter: z.number().finite().nonnegative(),
  seed: z.number().int().min(0).max(0xffffffff),
  tierProgression: z.strictObject({
    firstTransitionStartRow: nonnegativeSafeInteger,
    transitionRows: positiveSafeInteger,
    stableRows: positiveSafeInteger,
    curvePower: z.number().finite().positive(),
    bossLeadRows: positiveSafeInteger,
    firstBossHpMultiplier: z.number().finite().positive(),
    laterBossHpMultiplier: z.number().finite().positive(),
  }).refine((rule) => rule.bossLeadRows < rule.transitionRows,
    { path: ['bossLeadRows'], message: 'Boss lead rows must be shorter than transition' }).optional(),
  rewards: z.strictObject({
    rowsPerReward: positiveSafeInteger,
    spawnAheadDistance: z.number().finite().positive(),
    hitsRequired: positiveSafeInteger,
    seed: z.number().int().min(0).max(0xffffffff),
    sideX: z.number().finite().positive(),
  }).optional(),
}).superRefine((stream, context) => {
  if (stream.spawnAheadDistance <= stream.startZ) {
    context.addIssue({ code: 'custom', path: ['spawnAheadDistance'],
      message: 'Spawn-ahead distance must exceed stream start Z' });
  }
  if (stream.jitter >= (stream.columnSpacing ?? stream.spacing) / 2) {
    context.addIssue({ code: 'custom', path: ['jitter'], message: 'Jitter must be less than half of column spacing' });
  }
  if (stream.rewards && stream.rewards.spawnAheadDistance > stream.spawnAheadDistance) {
    context.addIssue({ code: 'custom', path: ['rewards', 'spawnAheadDistance'],
      message: 'Reward lookahead must not exceed enemy lookahead' });
  }
});

export const LevelDefinitionSchema = z.strictObject({
  id: nonEmptyId,
  length: z.number().finite().positive(),
  enemyGroups: z.array(z.never()),
  enemyStream: EnemyStreamSchema.optional(),
  upgradeGates: z.array(z.never()),
});

export type LevelDefinition = z.infer<typeof LevelDefinitionSchema>;
export type EnemyStreamDefinition = z.infer<typeof EnemyStreamSchema>;
