import { SeededRng } from '../../core/Rng';
import type { EnemyStreamDefinition } from '../../level/LevelDefinition';

export interface RewardPlacement { side: -1 | 1; zSlot: number }

export function rewardTierForRow(rowIndex: number, fullTier2Row: number): 1 | 2 {
  return rowIndex >= fullTier2Row ? 2 : 1;
}

// One deterministic row and placement per authored block, independent of gameplay RNG.
export function rewardPlacementForRow(rowIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>): RewardPlacement | null {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward row and column count must be valid non-negative safe integers');
  }
  const blockIndex = Math.floor(rowIndex / rewards.rowsPerReward);
  const rng = new SeededRng((rewards.seed ^ Math.imul(blockIndex + 1, 0x9e3779b1)) >>> 0);
  const rewardRowOffset = rng.nextInt(rewards.rowsPerReward);
  const zSlot = rng.nextInt(columns);
  const side = rng.nextInt(2) === 0 ? -1 : 1;
  return rowIndex % rewards.rowsPerReward === rewardRowOffset ? { side, zSlot } : null;
}
