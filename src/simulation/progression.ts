import type { CatharsisConfig } from '../config/catharsisConfig';
export interface ProgressionState { level: number; xp: number }
export type ProgressionBalance = CatharsisConfig['progression'];
export function requiredXp(level: number, balance: ProgressionBalance): number {
  return balance.firstLevelXp + balance.xpRequirementStep * (level - 1);
}
export function grantXp(state: ProgressionState, amount: number, balance: ProgressionBalance): ProgressionState {
  let { level, xp } = state;
  xp += amount;
  while (xp >= requiredXp(level, balance)) {
    xp -= requiredXp(level, balance);
    level++;
  }
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(xp)) throw new Error('Progression exceeds the supported range');
  return { level, xp };
}
export function effectiveRifleFireRate(base: number, level: number, balance: ProgressionBalance): number {
  return base + (level - 1) * balance.fireRatePerLevel;
}
