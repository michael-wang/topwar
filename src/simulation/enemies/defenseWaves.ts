import { z } from 'zod';
import type { SimulationState } from '../SimulationState';
import { admitDefenseGroup } from './defenseGroup';
import { pressureGroupSize, pressureWaveSettings } from './latePressure';
import { postCapOrdinarySettings } from '../postCapSurvival';

export const DefenseWaveStateSchema = z.strictObject({ nextAtSeconds: z.number().finite().nonnegative() });
export type DefenseWaveState = z.infer<typeof DefenseWaveStateSchema>;

// The existing row cursor identifies seeded compositions only; time owns admission.
// Phase-owned and missed opportunities are consumed, never banked for handoff.
export function advanceDefenseWaves(previous: DefenseWaveState, frame: SimulationState,
  nowSeconds: number, seed: number, admit: boolean): DefenseWaveState {
  const { balance, trackHalfWidth } = frame.catharsis!;
  const cursor = frame.enemyStream!;
  if (nowSeconds + 1e-9 < previous.nextAtSeconds) return { ...previous };
  const survival = postCapOrdinarySettings(balance, frame.postCapSurvival, frame.progression!.level);
  const interval = survival ? balance.postCapSurvival.waveIntervalSeconds ?? balance.defenseWaves.intervalSeconds
    : balance.defenseWaves.intervalSeconds;
  const slots = Math.floor((nowSeconds - previous.nextAtSeconds + 1e-9) / interval) + 1;
  const row = (Math.ceil(cursor.nextRowIndex / balance.waveRows) + slots - 1) * balance.waveRows;
  const nextAtSeconds = previous.nextAtSeconds + slots * interval;
  if (!Number.isSafeInteger(row + 1) || !Number.isFinite(nextAtSeconds)) throw new Error('Defense wave schedule exceeds supported range');
  const cap = survival ? balance.postCapSurvival.maxActiveEnemies : undefined;
  // Keep complete deterministic mixed groups; consume a blocked slot and row.
  // No trimming existing enemies, RNG draws or catch-up admission after a clear.
  if (admit && (cap === undefined || frame.enemies.filter(e => e.hp > 0).length + survival!.groupSize <= cap))
    admitDefenseGroup(frame.enemies, cursor, row, seed,
    { ...balance, ...pressureWaveSettings(balance, frame.progression!),
      groupSize: pressureGroupSize(balance, frame.progression!.level),
      ...survival }, trackHalfWidth, balance.defenseSpawnAheadDistance);
  cursor.nextRowIndex = row + 1;
  return { nextAtSeconds };
}
