import { z } from 'zod';
import { ArtilleryFlightSchema, artilleryDefaults } from './artilleryConfig';

const positive = z.number().finite().positive();
const phase = z.strictObject({
  shells: z.number().int().min(1).max(3), cooldownSeconds: positive,
  speedUnitsPerSecond: positive, flankIntervalSeconds: positive,
  heaviesPerLane: z.number().int().positive(), gruntsPerLane: z.number().int().nonnegative(),
  giantIntervalSeconds: positive.nullable(),
  heavySpeedUnitsPerSecond: positive.optional(), giantSpeedUnitsPerSecond: positive.optional(),
});
export const DefenseTankConfigSchema = z.strictObject({
  flight: ArtilleryFlightSchema.default({ horizontalSpeed: artilleryDefaults.horizontalSpeed,
    gravity: artilleryDefaults.gravity, minimumFlightSeconds: 2.4 }),
  triggerLevel: z.literal(9), hp: positive, entrySeconds: positive,
  startZ: positive, battleZ: positive, halfWidth: positive, halfDepth: positive,
  flankSpawnAheadDistance: positive.optional(),
  phase2HpFraction: positive.lt(1), phase3HpFraction: positive.lt(1),
  streamSeed: z.number().int().min(0).max(0xffffffff),
  phases: z.tuple([phase, phase, phase]),
}).refine(c => c.phase3HpFraction < c.phase2HpFraction && c.startZ > c.battleZ && c.battleZ > c.halfDepth,
  'Invalid tank phase thresholds or entrance');
export type DefenseTankConfig = z.infer<typeof DefenseTankConfigSchema>;
export type DefenseTankSettings = Readonly<Omit<DefenseTankConfig, 'phases'>> & {
  readonly phases: readonly Readonly<DefenseTankConfig['phases'][number]>[];
};
