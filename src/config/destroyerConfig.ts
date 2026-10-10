import { z } from 'zod';

export const destroyerDefaults = { startPolicy: 'afterCarnival' as const, enabled: false, durationSeconds: 27, entrySeconds: 3.2,
  exitAtSeconds: 23, radioAtSeconds: 1.3, radioDurationSeconds: 7.2,
  shotTimes: [8.8, 12, 16, 17.3, 21], startX: -28, stationX: -4, exitX: 30, z: 56 };
export const DestroyerConfigSchema = z.strictObject({
  // Missing policy belongs to historical sequential snapshots/configs. Keep
  // their clock instead of retroactively replaying an Lv6 entrance.
  startPolicy: z.enum(['afterCarnival', 'withCarnival']).default('afterCarnival'),
  enabled: z.boolean(), durationSeconds: z.number().finite().min(10).max(60),
  entrySeconds: z.number().finite().positive(), exitAtSeconds: z.number().finite().positive(),
  radioAtSeconds: z.number().finite().nonnegative(), radioDurationSeconds: z.number().finite().positive(),
  shotTimes: z.array(z.number().finite().positive()).min(1).max(16),
  startX: z.number().finite().min(-100).max(100), stationX: z.number().finite().min(-20).max(20),
  exitX: z.number().finite().min(-100).max(100), z: z.number().finite().min(48).max(100),
}).refine(c => c.entrySeconds < c.shotTimes[0] && c.radioAtSeconds + c.radioDurationSeconds < c.shotTimes[0]
  && c.shotTimes.every((t, i) => t < c.exitAtSeconds && (!i || t > c.shotTimes[i - 1]))
  && c.exitAtSeconds < c.durationSeconds && c.startX < c.stationX && c.stationX < c.exitX,
  'Destroyer entry, radio, shots and exit must be ordered');
export type DestroyerConfig = z.infer<typeof DestroyerConfigSchema>;
export type DestroyerSettings = Omit<Readonly<DestroyerConfig>, 'shotTimes'> & { readonly shotTimes: readonly number[] };
