export const ENEMY_PALETTE = [
  { body: '#ef5b52', head: '#ff8b7d' },
  { body: '#f47a3c', head: '#ffab65' },
  { body: '#e6b83f', head: '#ffe07a' },
  { body: '#a66be8', head: '#c597ff' },
  { body: '#e94f8a', head: '#ff82b0' },
  { body: '#9fbe45', head: '#c8df70' },
] as const;

export const PLAYER_PALETTE = [
  { body: '#1769ee', head: '#4b91ff' },
  { body: '#10429b', head: '#3579d6' },
  { body: '#2938c7', head: '#6677ff' },
  { body: '#1b8fd6', head: '#42bfd0' },
  { body: '#5d5ee8', head: '#8575e0' },
] as const;

export const REWARD_PALETTE = ['#1ac1ed', '#edc242', '#69d36f', '#a783ff'] as const;

export function paletteIndex(tier: number, length: number): number {
  if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('Palette tier must be positive');
  return (tier - 1) % length;
}
