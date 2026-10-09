// Shared presentation palette; the HUD keeps its accepted icon and layout.
export const GOLDEN_GRENADE = { gold: '#efb52f', amber: '#df8520', orange: '#ff751c',
  dark: '#263441', bronze: '#70441f', reflection: '#fff1bb' } as const;

export const goldenGrenadeIcon = `<svg viewBox="0 0 96 96" aria-hidden="true" stroke="${GOLDEN_GRENADE.dark}" stroke-width="4" stroke-linejoin="round">
  <path d="M38 24V13h23v16" fill="${GOLDEN_GRENADE.bronze}"/>
  <path d="M34 26Q20 31 18 54Q15 76 29 88Q46 96 65 87Q79 76 76 53Q73 32 61 26Z" fill="${GOLDEN_GRENADE.gold}"/>
  <path d="M60 29Q75 47 71 70Q67 88 47 89Q63 73 60 29Z" fill="${GOLDEN_GRENADE.orange}" stroke="none"/>
  <path d="M20 49Q48 57 75 48M19 68Q47 77 74 66M40 28Q32 60 40 90M57 28Q65 60 57 90" fill="none" stroke="${GOLDEN_GRENADE.bronze}" stroke-width="3"/>
  <path d="M31 33Q23 40 24 47M26 56v6" fill="none" stroke="${GOLDEN_GRENADE.reflection}" stroke-width="5" stroke-linecap="round"/>
  <path d="M43 13h23l15 30-9 5-14-26H43Z" fill="${GOLDEN_GRENADE.reflection}"/>
  <ellipse cx="33" cy="12" rx="9" ry="7" fill="none" stroke="${GOLDEN_GRENADE.bronze}"/>
</svg>`;
