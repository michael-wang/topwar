import { SeededRng } from '../../core/Rng';
import type { EnemyStreamDefinition } from '../../level/LevelDefinition';

export interface RewardPlacement { side: -1 | 1; zSlot: number }
export interface RewardBlockPlacement extends RewardPlacement { rowIndex: number }

// One deterministic row and placement per authored block, independent of gameplay RNG.
export function rewardPlacementForBlock(blockIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>): RewardBlockPlacement {
  if (!Number.isSafeInteger(blockIndex) || blockIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward block and column count must be valid non-negative safe integers');
  }
  const rng = new SeededRng((rewards.seed ^ Math.imul(blockIndex + 1, 0x9e3779b1)) >>> 0);
  const rowIndex = blockIndex * rewards.rowsPerReward + rng.nextInt(rewards.rowsPerReward);
  if (!Number.isSafeInteger(rowIndex)) throw new Error('Reward row exceeds the supported range');
  const zSlot = rng.nextInt(columns);
  const side = rng.nextInt(2) === 0 ? -1 : 1;
  return { rowIndex, side, zSlot };
}

export function rewardPlacementForRow(rowIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>): RewardPlacement | null {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward row and column count must be valid non-negative safe integers');
  }
  const blockIndex = Math.floor(rowIndex / rewards.rowsPerReward);
  const placement = rewardPlacementForBlock(blockIndex, columns, rewards);
  return placement.rowIndex === rowIndex ? { side: placement.side, zSlot: placement.zSlot } : null;
}
