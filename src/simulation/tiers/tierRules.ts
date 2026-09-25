export interface TierProgression {
  firstTransitionStartRow: number;
  transitionRows: number;
  stableRows: number;
  curvePower: number;
  bossLeadRows: number;
  firstBossHpMultiplier: number;
  laterBossHpMultiplier: number;
}

export interface TierPower {
  mergeCount: number;
  tier1Power: number;
  tier2Power: number;
  enemyHigherTierPowerMultiplier: number;
  rifleHigherTierPowerMultiplier: number;
  normalEnemyRadius: number;
}

export function validTier(tier: number): boolean {
  return Number.isSafeInteger(tier) && tier >= 1;
}

function safeRow(row: number): number {
  if (!Number.isSafeInteger(row) || row < 0) throw new Error('Tier row exceeds the supported range');
  return row;
}

export function transitionStartRow(tier: number, rule: TierProgression): number {
  if (!validTier(tier) || tier < 2) throw new Error('Target tier must be at least 2');
  return safeRow(rule.firstTransitionStartRow + (tier - 2) * (rule.transitionRows + rule.stableRows));
}

export function fullSaturationRow(tier: number, rule: TierProgression): number {
  return safeRow(transitionStartRow(tier, rule) + rule.transitionRows);
}

export function bossRowForTier(tier: number, rule: TierProgression): number {
  if (!validTier(tier)) throw new Error('Boss tier must be a positive safe integer');
  return safeRow(fullSaturationRow(tier + 1, rule) - rule.bossLeadRows);
}

export function tierProbabilityForRow(row: number, tier: number, rule: TierProgression): number {
  const start = transitionStartRow(tier, rule);
  if (row <= start) return 0;
  if (row >= start + rule.transitionRows) return 1;
  return ((row - start) / rule.transitionRows) ** rule.curvePower;
}

export function establishedTierForRow(row: number, rule: TierProgression): number {
  safeRow(row);
  if (row < fullSaturationRow(2, rule)) return 1;
  const cycle = rule.transitionRows + rule.stableRows;
  const tier = 2 + Math.floor((row - fullSaturationRow(2, rule)) / cycle);
  return validTier(tier) ? tier : (() => { throw new Error('Tier exceeds the supported range'); })();
}

export function highestIntroducedTierForRow(row: number, rule: TierProgression): number {
  const established = establishedTierForRow(row, rule);
  const nextTier = established + 1;
  if (!validTier(nextTier)) throw new Error('Tier exceeds the supported range');
  return row >= transitionStartRow(nextTier, rule) ? nextTier : established;
}

export function enemyTierForRow(row: number, column: number, centerColumn: number,
  seed: number, rule: TierProgression): number {
  const established = establishedTierForRow(row, rule);
  const target = established + 1;
  const start = transitionStartRow(target, rule);
  if (row < start) return established;
  if (row === start) return column === centerColumn ? target : established;
  return tierRollForSlot(seed, target, row, column) < tierProbabilityForRow(row, target, rule)
    ? target : established;
}

export function rewardTierForRow(row: number, rule: TierProgression): number {
  return establishedTierForRow(row, rule);
}

function powerForTierWithGrowth(tier: number, rule: TierPower, growth: number): number {
  if (!validTier(tier)) throw new Error('Tier must be a positive safe integer');
  const power = tier === 1 ? rule.tier1Power
    : rule.tier2Power * growth ** (tier - 2);
  if (!Number.isFinite(power) || power <= 0) throw new Error('Tier power exceeds the supported range');
  return power;
}

export function enemyPowerForTier(tier: number, rule: TierPower): number {
  return powerForTierWithGrowth(tier, rule, rule.enemyHigherTierPowerMultiplier);
}

export function riflePowerForTier(tier: number, rule: TierPower): number {
  return powerForTierWithGrowth(tier, rule, rule.rifleHigherTierPowerMultiplier);
}

export function exchangeValueForTier(tier: number, mergeCount: number): number {
  if (!validTier(tier)) throw new Error('Tier must be a positive safe integer');
  const value = mergeCount ** (tier - 1);
  if (!Number.isSafeInteger(value)) throw new Error('Tier exchange value exceeds the supported range');
  return value;
}

export function bossMaxHpForTier(tier: number, progression: TierProgression, power: TierPower): number {
  const multiplier = tier === 1 ? progression.firstBossHpMultiplier : progression.laterBossHpMultiplier;
  const hp = enemyPowerForTier(tier, power) * multiplier;
  if (!Number.isFinite(hp) || hp <= 0) throw new Error('Boss HP exceeds the supported range');
  return hp;
}

// Preserve the existing Tier-2 and Tier-3 layouts. Higher tiers use distinct salts.
export function tierRollForSlot(seed: number, targetTier: number, row: number, column: number): number {
  if (!validTier(targetTier) || targetTier < 2) throw new Error('Target tier must be at least 2');
  const salt = targetTier === 2 ? 0 : targetTier === 3 ? 0x6a09e667
    : Math.imul(targetTier, 0x9e3779b1);
  let bits = (seed ^ salt ^ Math.imul(row + 1, 0x9e3779b1)
    ^ Math.imul(column + 1, 0x85ebca6b)) >>> 0;
  bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
  bits = Math.imul(bits ^ (bits >>> 15), 0x846ca68b);
  return ((bits ^ (bits >>> 16)) >>> 0) / 0x100000000;
}
