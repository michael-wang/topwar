import { ART } from '../art/ArtDirection';
import { UI_ART } from '../art/UiArt';
import { XP_FILL_GRADIENT, xpEdgeColor } from './xpPalette';
export function applyArtTheme(viewport: HTMLElement): void {
  const values = { ink: ART.bar.ink, deep: ART.bar.deep, frame: ART.bar.frame,
    highlight: ART.bar.highlight, paper: ART.bar.paper, shadow: ART.bar.shadow,
    'xp-gradient': XP_FILL_GRADIENT, 'xp-glow': xpEdgeColor(0) };
  for (const [name, value] of Object.entries(values)) viewport.style.setProperty(`--art-${name}`, value);
  for (const [name, value] of Object.entries(ART.coastalUi)) viewport.style.setProperty(`--coast-${name}`, value);
  for (const [name, value] of Object.entries(UI_ART)) viewport.style.setProperty(`--ui-${name}`, value);
}
