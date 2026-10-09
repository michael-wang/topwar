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
  const slots = Math.floor((nowSeconds - previous.nextAtSeconds + 1e-9) / balance.defenseWaves.intervalSeconds) + 1;
  const row = (Math.ceil(cursor.nextRowIndex / balance.waveRows) + slots - 1) * balance.waveRows;
  const nextAtSeconds = previous.nextAtSeconds + slots * balance.defenseWaves.intervalSeconds;
  if (!Number.isSafeInteger(row + 1) || !Number.isFinite(nextAtSeconds)) throw new Error('Defense wave schedule exceeds supported range');
  if (admit) admitDefenseGroup(frame.enemies, cursor, row, seed,
    { ...balance, ...pressureWaveSettings(balance, frame.progression!),
      groupSize: pressureGroupSize(balance, frame.progression!.level),
      ...postCapOrdinarySettings(balance, frame.postCapSurvival) }, trackHalfWidth, balance.defenseSpawnAheadDistance);
  cursor.nextRowIndex = row + 1;
  return { nextAtSeconds };
}
