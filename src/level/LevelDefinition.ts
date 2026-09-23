import { z } from 'zod';

const nonEmptyId = z.string().refine((value) => value.trim().length > 0, 'Must be a non-empty string');
const positiveSafeInteger = z.number().finite().int().positive()
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

const UpgradeGateSchema = z.strictObject({
  id: nonEmptyId,
  choiceGroup: nonEmptyId,
  x: z.number().finite(),
  z: z.number().finite().nonnegative(),
  width: z.number().finite().positive(),
  hp: z.number().finite().positive(),
  reward: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('rifle'), amount: positiveSafeInteger }),
    z.strictObject({ kind: z.literal('rocket'), amount: positiveSafeInteger }),
  ]),
});

export const LevelDefinitionSchema = z.strictObject({
  id: nonEmptyId,
  length: z.number().finite().positive(),
  enemyGroups: z.array(EnemyGroupSchema),
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
    if (gate.z >= level.length) {
      context.addIssue({ code: 'custom', path: ['upgradeGates', index, 'z'], message: 'Upgrade-gate Z must be less than level length' });
    }
  });
});

export type LevelDefinition = z.infer<typeof LevelDefinitionSchema>;
