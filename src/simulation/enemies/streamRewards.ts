import { SeededRng } from '../../core/Rng';
import type { EnemyStreamDefinition } from '../../level/LevelDefinition';
import { TIER2_EXCHANGE_VALUE } from '../tierExchange';

export interface RewardPlacement { side: -1 | 1; zSlot: number }

export function rewardChanceForTier2Probability(
  rewards: NonNullable<EnemyStreamDefinition['rewards']>, tier2Probability: number,
): number {
  if (!Number.isFinite(tier2Probability)) throw new Error('Tier-2 probability must be finite');
  const pressure = Math.min(1, Math.max(0, tier2Probability));
  return rewards.baseChancePerRow
    + (rewards.fullTierChancePerRow - rewards.baseChancePerRow) * pressure;
}

export function tier2RewardProbabilityForEnemyPressure(tier2Probability: number): number {
  if (!Number.isFinite(tier2Probability)) throw new Error('Tier-2 probability must be finite');
  const pressure = Math.min(1, Math.max(0, tier2Probability));
  return TIER2_EXCHANGE_VALUE * pressure
    / (1 + (TIER2_EXCHANGE_VALUE - 1) * pressure);
}

// A separate salt keeps tier choice independent from reward appearance and placement.
export function rewardTierForRow(seed: number, rowIndex: number, tier2Probability: number): 1 | 2 {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0) throw new Error('Reward row must be a non-negative safe integer');
  const chance = tier2RewardProbabilityForEnemyPressure(tier2Probability);
  const roll = new SeededRng((seed ^ Math.imul(rowIndex + 1, 0x85ebca6b)) >>> 0).nextFloat();
  return roll < chance ? 2 : 1;
}

// The content seed and row index determine appearance, side, and Z jitter independently of gameplay.
export function rewardPlacementForRow(rowIndex: number, columns: number,
  rewards: NonNullable<EnemyStreamDefinition['rewards']>, tier2Probability: number): RewardPlacement | null {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || !Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Reward row and column count must be valid non-negative safe integers');
  }
  const rng = new SeededRng((rewards.seed ^ Math.imul(rowIndex + 1, 0x9e3779b1)) >>> 0);
  const appears = rng.nextFloat() < rewardChanceForTier2Probability(rewards, tier2Probability);
  const zSlot = rng.nextInt(columns);
  const side = rng.nextInt(2) === 0 ? -1 : 1;
  return appears ? { side, zSlot } : null;
}
