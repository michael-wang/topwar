import { z } from 'zod';

// Compatibility constant for accepted runner-coordinate Defense snapshots only.
// New gameplay never adds this value to movement or uses it as a scheduling clock.
export const LEGACY_DEFENSE_FORWARD_SPEED = 0.6;
export const defenseWaveDefaults = { intervalSeconds: 6, firstWaveDelaySeconds: 5 / 3 };
export const DefenseWaveConfigSchema = z.strictObject({
  intervalSeconds: z.number().finite().positive(),
  firstWaveDelaySeconds: z.number().finite().nonnegative(),
});
