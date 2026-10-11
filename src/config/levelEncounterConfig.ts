import { z } from 'zod';

export const EncounterActionSchema = z.enum(['ordinaryOn', 'ordinaryOff', 'startSurvival',
  'destroyerIntro', 'destroyerEnter', 'destroyerRetreat', 'barrageOn', 'barrageOff']);
export type EncounterAction = z.infer<typeof EncounterActionSchema>;
export const LevelEncounterConfigSchema = z.strictObject({
  version: z.literal(1), initialOrdinaryEnabled: z.boolean(),
  triggers: z.array(z.strictObject({
    id: z.string().min(1).max(80),
    when: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('time'), seconds: z.number().finite().nonnegative() }),
      z.strictObject({ kind: z.literal('level'), level: z.number().int().positive(), delaySeconds: z.number().finite().nonnegative() }),
      z.strictObject({ kind: z.literal('machineGunRelease'), delaySeconds: z.number().finite().nonnegative() }),
    ]),
    actions: z.array(EncounterActionSchema).min(1).max(8),
  })).max(32),
}).refine(c => new Set(c.triggers.map(t => t.id)).size === c.triggers.length, 'Encounter trigger IDs must be unique');
export type LevelEncounterConfig = z.infer<typeof LevelEncounterConfigSchema>;
