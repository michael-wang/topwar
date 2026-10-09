import { z } from 'zod';

// Structural bound shared by authored artillery sources and the visual pool.
export const ARTILLERY_CAPACITY = 8;
export const ArtilleryFlightSchema = z.strictObject({
  horizontalSpeed: z.number().finite().min(4).max(200),
  gravity: z.number().finite().min(1).max(100),
  minimumFlightSeconds: z.number().finite().min(.1).max(3),
});
export const artilleryDefaults = { horizontalSpeed: 24, gravity: 8, minimumFlightSeconds: .5,
  impactLaneFraction: .42, maxActive: ARTILLERY_CAPACITY } as const;
export const ArtilleryConfigSchema = ArtilleryFlightSchema.extend({
  // Radius below half a lane leaves a clearly safe adjacent lane. No body-radius inflation.
  impactLaneFraction: z.number().finite().min(.2).max(.49),
  maxActive: z.number().int().min(1).max(ARTILLERY_CAPACITY),
});
export type ArtilleryFlightParameters = z.infer<typeof ArtilleryFlightSchema>;
