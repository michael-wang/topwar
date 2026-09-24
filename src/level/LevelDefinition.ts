import { z } from 'zod';

const nonEmptyId = z.string().refine((value) => value.trim().length > 0, 'Must be a non-empty string');
const positiveSafeInteger = z.number().finite().int().positive()
  .refine(Number.isSafeInteger, 'Must be a safe integer');
const nonnegativeSafeInteger = z.number().finite().int().nonnegative()
  .refine(Number.isSafeInteger, 'Must be a safe integer');

const EnemyGroupSchema = z.strictObject({
  id: nonEmptyId,
  z: z.number().finite().nonnegative(),
  enemy: z.literal('grunt'),
  count: positiveSafeInteger,
  formation: z.strictObject({
    columns: positiveSafeInteger,
    spacing: z.number().finite().positive(),
    jitter: z.number().finite().nonnegative(),
    seed: z.number().int().min(0).max(0xffffffff),
  }).refine((formation) => formation.jitter < formation.spacing / 2,
    { path: ['jitter'], message: 'Jitter must be less than half of spacing' }),
});

const EnemyStreamSchema = z.strictObject({
  enemy: z.literal('grunt'),
  startZ: z.number().finite().nonnegative(),
  spawnAheadDistance: z.number().finite().positive(),
  columns: positiveSafeInteger,
  spacing: z.number().finite().positive(),
  jitter: z.number().finite().nonnegative(),
  seed: z.number().int().min(0).max(0xffffffff),
  bruteRamp: z.strictObject({
    startRow: nonnegativeSafeInteger,
    fullRow: nonnegativeSafeInteger,
    curvePower: z.number().finite().positive(),
  }).refine((ramp) => ramp.fullRow > ramp.startRow,
    { path: ['fullRow'], message: 'Full Tier-2 row must follow start row' }),
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
  if (stream.jitter >= stream.spacing / 2) {
    context.addIssue({ code: 'custom', path: ['jitter'], message: 'Jitter must be less than half of spacing' });
  }
  if (stream.rewards && stream.rewards.spawnAheadDistance > stream.spawnAheadDistance) {
    context.addIssue({ code: 'custom', path: ['rewards', 'spawnAheadDistance'],
      message: 'Reward lookahead must not exceed enemy lookahead' });
  }
});

export const UpgradeRewardSchema = z.strictObject({
  mode: z.literal('hitPickup'),
  kind: z.enum(['rifle', 'tier2Rifle']),
  amount: positiveSafeInteger,
  hitsRequired: positiveSafeInteger,
  dropSpeed: z.number().finite().positive(),
});

const UpgradeGateSchema = z.strictObject({
  id: nonEmptyId,
  x: z.number().finite(),
  zOffset: z.number().finite().positive(),
  width: z.number().finite().positive(),
  reward: UpgradeRewardSchema,
});

export const LevelDefinitionSchema = z.strictObject({
  id: nonEmptyId,
  length: z.number().finite().positive(),
  enemyGroups: z.array(EnemyGroupSchema),
  enemyStream: EnemyStreamSchema.optional(),
  upgradeGates: z.array(UpgradeGateSchema),
}).superRefine((level, context) => {
  const ids = new Set<string>();
  let previousZ = -Infinity;
  level.enemyGroups.forEach((group, index) => {
    if (ids.has(group.id)) {
      context.addIssue({ code: 'custom', path: ['enemyGroups', index, 'id'], message: `Duplicate enemy-group id: ${group.id}` });
    }
    ids.add(group.id);
    if (group.z <= previousZ) {
      context.addIssue({ code: 'custom', path: ['enemyGroups', index, 'z'], message: 'Enemy groups must be in strictly increasing Z order' });
    }
    previousZ = group.z;
    if (group.z >= level.length) {
      context.addIssue({ code: 'custom', path: ['enemyGroups', index, 'z'], message: 'Enemy-group Z must be less than level length' });
    }
    if (group.formation.columns > group.count) {
      context.addIssue({ code: 'custom', path: ['enemyGroups', index, 'formation', 'columns'], message: 'Formation columns cannot exceed group count' });
    }
  });
  const gateIds = new Set<string>();
  level.upgradeGates.forEach((gate, index) => {
    if (gateIds.has(gate.id)) {
      context.addIssue({ code: 'custom', path: ['upgradeGates', index, 'id'], message: `Duplicate upgrade-gate id: ${gate.id}` });
    }
    gateIds.add(gate.id);
  });
});

export type LevelDefinition = z.infer<typeof LevelDefinitionSchema>;
export type EnemyStreamDefinition = z.infer<typeof EnemyStreamSchema>;
export type UpgradeReward = z.infer<typeof UpgradeRewardSchema>;
