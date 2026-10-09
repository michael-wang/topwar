import { z } from 'zod';

export const progressionDefaults = {
  xpRequirements: [28, 60, 110, 180, 220, 200, 300],
  levelPlan: [
    { weaponFamily: 'rifle' as const, fireRateStage: 1, squadStage: 1 },
    { weaponFamily: 'rifle' as const, fireRateStage: 2, squadStage: 1 },
    { weaponFamily: 'rifle' as const, fireRateStage: 3, squadStage: 1 },
    { weaponFamily: 'rifle' as const, fireRateStage: 3, squadStage: 2 },
    { weaponFamily: 'rifle' as const, fireRateStage: 3, squadStage: 3 },
    { weaponFamily: 'machineGun' as const, fireRateStage: 1, squadStage: 1 },
    { weaponFamily: 'machineGun' as const, fireRateStage: 1, squadStage: 2 },
    { weaponFamily: 'machineGun' as const, fireRateStage: 1, squadStage: 3 },
  ],
  fireRateMultipliers: [1, 1.25, 1.5], gruntKillXp: 1, heavyKillXp: 10,
  reinforcementLevel: 7, reinforcementArrivalSeconds: 1.1, reinforcementSpacing: .72, reinforcementStagger: .18,
};

export const ProgressionConfigSchema = z.strictObject({
  xpRequirements: z.array(z.number().int().positive()).min(1).default(progressionDefaults.xpRequirements),
  levelPlan: z.array(z.strictObject({
    // Older Rifle-only snapshot plans remain valid with their original cap.
    weaponFamily: z.enum(['rifle', 'machineGun']).default('rifle'),
    fireRateStage: z.number().int().min(1).max(3), squadStage: z.number().int().min(1).max(3),
  })).min(2).default(progressionDefaults.levelPlan),
  fireRateMultipliers: z.array(z.number().finite().positive()).length(3).default(progressionDefaults.fireRateMultipliers),
  gruntKillXp: z.number().int().nonnegative().default(1), heavyKillXp: z.number().int().nonnegative().default(10),
  reinforcementLevel: z.number().int().min(6).default(7),
  reinforcementArrivalSeconds: z.number().finite().positive().default(1.1),
  reinforcementSpacing: z.number().finite().positive().default(.72),
  reinforcementStagger: z.number().finite().nonnegative().default(.18),
}).refine(v => v.xpRequirements.length === v.levelPlan.length - 1,
  { message: 'Each non-cap level requires exactly one XP threshold' })
  .refine(v => v.levelPlan[0].weaponFamily === 'rifle' && v.levelPlan[0].fireRateStage === 1
    && v.levelPlan[0].squadStage === 1 && v.levelPlan.every((s, i) => {
      if (s.weaponFamily === 'machineGun' && s.fireRateStage !== 1) return false;
      if (!i) return true;
      const previous = v.levelPlan[i - 1];
      return s.weaponFamily === previous.weaponFamily
        ? s.fireRateStage >= previous.fireRateStage && s.squadStage >= previous.squadStage
        : previous.weaponFamily === 'rifle' && s.weaponFamily === 'machineGun' && s.squadStage === 1;
    }), { message: 'Stages must not regress within a weapon family; MG evolves once at stage one' })
  .refine(v => v.fireRateMultipliers.every((rate, i) => !i || rate >= v.fireRateMultipliers[i - 1]),
    { message: 'Rifle rate stages must not decrease' });
