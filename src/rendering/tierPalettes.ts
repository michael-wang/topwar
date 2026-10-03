import { ART } from '../art/ArtDirection';
export const ENEMY_PALETTE = [
  { body: ART.faction.grunt, head: ART.faction.gruntLight },
  { body: '#7d8966', head: '#a0ac8c' },
  { body: '#626f50', head: '#899673' },
  { body: '#838975', head: '#a7ad97' },
  { body: '#596b61', head: '#83978d' },
  { body: '#8b8969', head: '#b3af89' },
] as const;

export const PLAYER_PALETTE = [
  { body: ART.faction.player, head: ART.faction.playerLight },
  { body: '#10429b', head: '#3579d6' },
  { body: '#2938c7', head: '#6677ff' },
  { body: '#1b8fd6', head: '#42bfd0' },
  { body: '#5d5ee8', head: '#8575e0' },
] as const;

export function paletteIndex(tier: number, length: number): number {
  if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('Palette tier must be positive');
  return (tier - 1) % length;
}
