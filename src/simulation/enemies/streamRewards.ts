import { SeededRng } from '../../core/Rng';
import type { EnemyStreamDefinition } from '../../level/LevelDefinition';

export interface RewardPlacement { side: -1 | 1; zSlot: number }

// The content seed and row index determine appearance, side, and Z jitter independently of gameplay.
export function rewardPlacementForRow(rowIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>): RewardPlacement | null {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward row and column count must be valid non-negative safe integers');
  }
  const rng = new SeededRng((rewards.seed ^ Math.imul(rowIndex + 1, 0x9e3779b1)) >>> 0);
  const appears = rng.nextFloat() < rewards.chancePerRow;
  const zSlot = rng.nextInt(columns);
  const side = rng.nextInt(2) === 0 ? -1 : 1;
  return appears ? { side, zSlot } : null;
}
