import { z } from 'zod';

export const grenadeDefaults = {
  teachingGrantAmount: 3, damageEnemyHp: 9, blastRadius: 4, flightSeconds: .65,
  emptyFieldDepth: 14,
  // This window scores teaching-supply lanes only; throws have no distance cap.
  supplyPressureDepth: 24, supplyDelaySeconds: 8, supplyHitsRequired: 10,
  supplyDestruction: { mode: 'staged' as const, recoverySeconds: .7 },
  supplyDepth: 14, supplyMinDepth: 6, supplyFrontClearance: 1.25,
  supplyLaneDistancePenalty: 3,
};
// Damage is in defense enemy HP (one Tier-1 Rifle hit), not legacy tier power.
export const GrenadeConfigSchema = z.strictObject({
  teachingGrantAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  // Compatibility alias for the teaching reward, never an inventory maximum.
  capacity: z.number().int().min(1).max(3).optional(), damageEnemyHp: z.number().finite().positive(),
  blastRadius: z.number().finite().positive(), flightSeconds: z.number().finite().positive(),
  emptyFieldDepth: z.number().finite().positive().default(grenadeDefaults.emptyFieldDepth),
  supplyPressureDepth: z.number().finite().positive(), supplyDelaySeconds: z.number().finite().nonnegative(),
  supplyHitsRequired: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), supplyDepth: z.number().finite().positive(),
  supplyDestruction: z.strictObject({ mode: z.literal('staged'), recoverySeconds: z.number().finite().positive() }).optional(),
  supplyMinDepth: z.number().finite().positive(), supplyFrontClearance: z.number().finite().positive(),
  supplyLaneDistancePenalty: z.number().finite().nonnegative(),
}).refine(c => (c.teachingGrantAmount !== undefined || c.capacity !== undefined)
  && (c.teachingGrantAmount === undefined || c.capacity === undefined || c.teachingGrantAmount === c.capacity),
  { message: 'Specify an unambiguous teaching Grenade reward' })
  .refine(c => c.supplyDepth >= c.supplyMinDepth && c.supplyMinDepth > c.supplyFrontClearance,
  { message: 'Grenade supply depth must leave readable front clearance' });
export type GrenadeConfig = z.infer<typeof GrenadeConfigSchema>;
export const teachingGrenadeGrant = (c: GrenadeConfig): number => c.teachingGrantAmount ?? c.capacity!;
