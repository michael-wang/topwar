export const ENEMY_PALETTE = [
  { body: '#9b6863', head: '#bd8580' },
  { body: '#cf4037', head: '#ef6658' },
  { body: '#d72f82', head: '#ff69b3' },
  { body: '#7a45c7', head: '#aa7aee' },
  { body: '#df6b2f', head: '#ff9a62' },
  { body: '#7f8b3b', head: '#a8b85c' },
] as const;

export const PLAYER_PALETTE = [
  { body: '#1769ee', head: '#4b91ff' },
  { body: '#10429b', head: '#3579d6' },
  { body: '#2938c7', head: '#6677ff' },
  { body: '#087f8c', head: '#42bfd0' },
  { body: '#4e3d9f', head: '#8575e0' },
] as const;

export const REWARD_PALETTE = ['#1ac1ed', '#edc242', '#69d36f', '#a783ff'] as const;

export function paletteIndex(tier: number, length: number): number {
  if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('Palette tier must be positive');
  return (tier - 1) % length;
}
