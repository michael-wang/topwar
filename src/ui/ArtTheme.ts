import { ART } from '../art/ArtDirection';
export function applyArtTheme(viewport: HTMLElement): void {
  for(const [name,value] of Object.entries({ink:ART.bar.ink,deep:ART.bar.deep,frame:ART.bar.frame,
    highlight:ART.bar.highlight,paper:ART.bar.paper,shadow:ART.bar.shadow,'xp-red':ART.bar.xpRed,
    'xp-orange':ART.bar.xpOrange,'xp-gold':ART.bar.xpGold})) viewport.style.setProperty(`--art-${name}`,value);
}
