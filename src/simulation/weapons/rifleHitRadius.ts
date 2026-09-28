export function rifleHitRadiusBonusForTier(tier: number, step: number, cap: number): number {
  if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('Rifle tier must be positive');
  if (!Number.isFinite(step) || step < 0 || !Number.isFinite(cap) || cap < 0) {
    throw new Error('Rifle hit radius step and cap must be finite and non-negative');
  }
  return Math.min(cap, (tier - 1) * step);
}
