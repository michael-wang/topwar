import { ART } from './ArtDirection';
import { GOLDEN_GRENADE } from './GoldenGrenade';

// Painted navy equipment, ivory enamel, warm action accents. Shared by Defense UI;
// scene/legacy palettes retain their own ownership. Cuts belong to artwork, not hit areas.
export const UI_ART = {
  ink: ART.bar.shadow,
  deep: ART.bar.deep,
  paper: ART.bar.paper,
  gold: GOLDEN_GRENADE.gold,
  orange: GOLDEN_GRENADE.orange,
  danger: ART.enemyHealth.heavy,
  steel: '#405b70',
  edge: '#b9beaf',
  notch: '6px',
  offset: '2px',
  plaque: 'polygon(0 0, calc(100% - var(--ui-notch)) 0, 100% var(--ui-notch), 100% 100%, 5px 100%, 0 calc(100% - 5px))',
} as const;
