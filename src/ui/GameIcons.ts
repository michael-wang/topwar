// Authored chunky silhouettes. Weapon identity is visual; no external icon assets.
const paths = {
  rifle: '<path d="M2 13h5l3-4h10V6h3v3h7v3h-9v3h-6l-2 5h-4l1-5H7v3H2Z"/><path d="M14 7h6v2h-6Z"/>',
  fireRate: '<path d="M10 3h4v11h-4ZM17 6h4v11h-4ZM3 6h4v11H3Z"/><path d="M10 16h4v5h-4ZM3 19h4v3H3ZM17 19h4v3h-4Z"/>',
  squad: '<circle cx="8" cy="7" r="4"/><circle cx="20" cy="7" r="4"/><path d="M2 22v-8l3-3h6l3 3v8ZM16 22v-8l2-3h5l3 3v8Z"/>',
} as const;
export type GameIcon = keyof typeof paths;
export function iconMarkup(kind: GameIcon): string {
  return `<svg viewBox="0 0 ${kind === 'rifle' ? 32 : 28} 24" fill="currentColor" aria-hidden="true">${paths[kind]}</svg>`;
}
export function gameIcon(kind: GameIcon): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'game-icon'; icon.ariaHidden = 'true'; icon.innerHTML = iconMarkup(kind);
  return icon;
}
