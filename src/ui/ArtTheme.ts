import { ART } from '../art/ArtDirection';
import { XP_FILL_GRADIENT } from './xpPalette';
export function applyArtTheme(viewport: HTMLElement): void {
  const values = { ink: ART.bar.ink, deep: ART.bar.deep, frame: ART.bar.frame,
    highlight: ART.bar.highlight, paper: ART.bar.paper, shadow: ART.bar.shadow,
    'xp-gradient': XP_FILL_GRADIENT, 'xp-glow': ART.xp[0].color };
  for (const [name, value] of Object.entries(values)) viewport.style.setProperty(`--art-${name}`, value);
}
