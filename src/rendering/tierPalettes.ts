import { ART } from '../art/ArtDirection';
export const ENEMY_PALETTE = [
  { body: ART.faction.grunt, head: ART.faction.gruntLight },
  { body: '#657236', head: '#87944a' },
  { body: '#62437c', head: '#815b9d' },
  { body: '#a64e2d', head: '#c66a42' },
  { body: '#46525a', head: '#68767f' },
  { body: '#896b29', head: '#ad8939' },
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
