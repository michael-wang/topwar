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
  }),
});

export const LevelDefinitionSchema = z.strictObject({
  id: nonEmptyId,
  length: z.number().finite().positive(),
  startGraceSeconds: z.number().finite().nonnegative(),
  enemyGroups: z.array(EnemyGroupSchema),
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
});

export type LevelDefinition = z.infer<typeof LevelDefinitionSchema>;
