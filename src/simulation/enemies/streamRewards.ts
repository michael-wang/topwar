import { SeededRng } from '../../core/Rng';
import type { EnemyStreamDefinition } from '../../level/LevelDefinition';

// The content seed and row index determine both rolls; prior rows and gameplay cannot affect them.
export function rewardSlotForRow(rowIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>): number | null {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward row and column count must be valid non-negative safe integers');
  }
  const rng = new SeededRng((rewards.seed ^ Math.imul(rowIndex + 1, 0x9e3779b1)) >>> 0);
  const appears = rng.nextFloat() < rewards.chancePerRow;
  const slot = rng.nextInt(columns);
  return appears ? slot : null;
}
