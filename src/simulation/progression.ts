import type { CatharsisConfig } from '../config/catharsisConfig';
export interface ProgressionState { level: number; xp: number }
export type ProgressionBalance = Readonly<Omit<CatharsisConfig['progression'], 'xpRequirements' | 'levelPlan' | 'fireRateMultipliers'>>
  & { readonly xpRequirements: readonly number[];
    readonly levelPlan: readonly Readonly<{ weaponFamily: 'rifle' | 'machineGun'; fireRateStage: number; squadStage: number }>[];
    readonly fireRateMultipliers: readonly number[] };
export function maxProgressionLevel(balance: ProgressionBalance): number { return balance.levelPlan.length; }
export function progressionStage(level: number, balance: ProgressionBalance): ProgressionBalance['levelPlan'][number] {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error('Invalid progression level');
  // Debug fixtures retain their level but cannot exceed the designed power stages.
  return balance.levelPlan[Math.min(level, maxProgressionLevel(balance)) - 1];
}
export function requiredXp(level: number, balance: ProgressionBalance): number {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error('Invalid progression level');
  return level >= maxProgressionLevel(balance) ? Infinity : balance.xpRequirements[level - 1];
}
export function grantXp(state: ProgressionState, amount: number, balance: ProgressionBalance): ProgressionState {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid XP grant');
  progressionStage(state.level, balance);
  if (state.level >= maxProgressionLevel(balance)) return { level: state.level, xp: 0 };
  let { level, xp } = state;
  xp += amount;
  if (!Number.isSafeInteger(xp)) throw new Error('Progression exceeds the supported range');
  while (level < maxProgressionLevel(balance) && xp >= requiredXp(level, balance)) {
    xp -= requiredXp(level, balance);
    level++;
  }
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(xp)) throw new Error('Progression exceeds the supported range');
  return { level, xp: level === maxProgressionLevel(balance) ? 0 : xp };
}
export function effectiveRifleFireRate(base: number, level: number, balance: ProgressionBalance): number {
  const primary = progressionStage(level, balance);
  if (primary.weaponFamily === 'rifle') return base * balance.fireRateMultipliers[primary.fireRateStage - 1];
  const stages = balance.levelPlan.slice(0, Math.min(level, maxProgressionLevel(balance)));
  const stage = stages.filter(s => s.weaponFamily === 'rifle').at(-1)!;
  return base * balance.fireRateMultipliers[stage.fireRateStage - 1];
}
export function effectivePrimaryFireRate(base: number, level: number, balance: Readonly<CatharsisConfig>): number {
  return progressionStage(level, balance.progression).weaponFamily === 'machineGun'
    ? balance.machineGun.fireRate : effectiveRifleFireRate(base, level, balance.progression);
}
