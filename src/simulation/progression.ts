import type { CatharsisConfig } from '../config/catharsisConfig';
export interface ProgressionState { level: number; xp: number }
export type ProgressionBalance = Readonly<Omit<CatharsisConfig['progression'], 'xpRequirements'>>
  & { readonly xpRequirements: readonly number[] };
export function requiredXp(level: number, balance: ProgressionBalance): number {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error('Invalid progression level');
  const table = balance.xpRequirements;
  if (level <= table.length) return table[level - 1];
  let requirement = table[table.length - 1];
  for (let index = table.length; index < level; index++) {
    requirement = Math.ceil(requirement * balance.xpFallbackMultiplier);
    if (!Number.isSafeInteger(requirement)) throw new Error('XP requirement exceeds the supported range');
  }
  return requirement;
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
  const earlyGains = Math.min(level - 1, balance.fireRateTaperStartLevel - 2);
  const taperedGains = Math.max(0, level - balance.fireRateTaperStartLevel + 1);
  const lateBonus = balance.fireRateTaperFirstGain
    * (1 - Math.pow(balance.fireRateTaperDecay, taperedGains)) / (1 - balance.fireRateTaperDecay);
  return base + earlyGains * balance.fireRatePerLevel + lateBonus;
}
