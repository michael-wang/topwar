// Authored chunky silhouettes. Weapon identity is visual; no external icon assets.
const paths = {
  rifle: '<path d="M1 9h8l4-4h15V3h4v2h11v4H29v5h-9l-3 5h-5l2-6H9v4H1Z"/>',
  machineGun: '<path d="M1 8h7l3-4h19v3h13v5H29v3H17l-3 5h-5l2-7H1Z"/><path d="M18 14h10v6H18ZM31 5h3v9h-3ZM37 5h3v9h-3Z"/>',
  cartridge: '<path d="M6 22V8l6-6 6 6v14Z"/>',
  soldier: '<circle cx="12" cy="6" r="4"/><path d="M5 22v-7c0-3 2-5 7-5s7 2 7 5v7Z"/>',
} as const;
export type GameIcon = keyof typeof paths;
export function iconMarkup(kind: GameIcon, filled = true): string {
  return `<svg viewBox="${kind === 'rifle' || kind === 'machineGun' ? '0 0 44 20' : '0 0 24 24'}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${filled ? 0 : 1.6}" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
export function gameIcon(kind: GameIcon): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'game-icon'; icon.ariaHidden = 'true'; icon.innerHTML = iconMarkup(kind);
  return icon;
}
