import { z } from 'zod';

export const carnivalDefaults = { enabled: false, durationSeconds: 24, firstWaveSeconds: 2,
  waveIntervalSeconds: 1.5, groupSize: 36, activeEnemyLimit: 80,
  laneGroups: [[0, 1], [3, 4], [1, 2], [2, 3]] };

export const CarnivalConfigSchema = z.strictObject({
  enabled: z.boolean(),
  durationSeconds: z.number().finite().positive(),
  firstWaveSeconds: z.number().finite().positive(),
  waveIntervalSeconds: z.number().finite().positive(),
  groupSize: z.number().int().positive().max(100),
  activeEnemyLimit: z.number().int().positive().max(300),
  laneGroups: z.array(z.array(z.number().int().min(0).max(15)).min(1).max(16)
    .refine(lanes => new Set(lanes).size === lanes.length, 'Carnival lanes must be distinct')).min(2).max(16),
}).refine(c => c.firstWaveSeconds < c.durationSeconds && c.groupSize <= c.activeEnemyLimit,
  'Carnival waves must fit the phase and active limit');
