import { ART } from '../art/ArtDirection';
// Combat HUD palette is deliberately independent of world/environment art.
const stops = ART.xp;

// Anchored to the whole track; the HUD reveals it rather than resizing it.
export const XP_FILL_GRADIENT = `linear-gradient(90deg, ${stops.map(stop =>
  `${stop.color} ${stop.at * 100}%`).join(', ')})`;

// The crest follows the revealed warm track; the underlying gradient never resizes.
export function xpEdgeColor(progress: number): string {
  const fraction = Math.max(0, Math.min(1, progress));
  if (fraction >= .9) return stops.at(-1)!.color;
  const right = stops.findIndex(stop => stop.at >= fraction);
  if (right <= 0) return stops[0].color;
  const a = stops[right - 1], b = stops[right];
  const t = (fraction - a.at) / (b.at - a.at);
  const channels = [1, 3, 5].map(offset => {
    const start = Number.parseInt(a.color.slice(offset, offset + 2), 16);
    const end = Number.parseInt(b.color.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * t).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
