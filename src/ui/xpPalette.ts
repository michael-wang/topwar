import { ART } from '../art/ArtDirection';

// Anchored to the whole track; the HUD reveals it rather than resizing it.
export const XP_FILL_GRADIENT = `linear-gradient(90deg, ${ART.xp.map(stop =>
  `${stop.color} ${stop.at * 100}%`).join(', ')})`;

// The leading edge follows the same sea/aqua/foam stops as the full track.
export function xpEdgeColor(progress: number): string {
  const fraction = Math.max(0, Math.min(1, progress));
  const right = ART.xp.findIndex(stop => stop.at >= fraction);
  if (right <= 0) return ART.xp[0].color;
  const a = ART.xp[right - 1], b = ART.xp[right];
  const t = (fraction - a.at) / (b.at - a.at);
  const channels = [1, 3, 5].map(offset => {
    const start = Number.parseInt(a.color.slice(offset, offset + 2), 16);
    const end = Number.parseInt(b.color.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * t).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
