import { ENEMY_PALETTE, paletteIndex } from '../rendering/tierPalettes';

export class TierHud {
  private readonly element: HTMLDivElement;
  private tier = 0;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'tier-hud';
    viewport.append(this.element);
    this.setTier(1);
  }

  setTier(tier: number): void {
    if (!Number.isSafeInteger(tier) || tier < 1) throw new Error('HUD tier must be positive');
    if (tier === this.tier) return;
    this.tier = tier;
    this.element.textContent = `ENEMY LV ${tier}`;
    this.element.style.borderColor = ENEMY_PALETTE[paletteIndex(tier, ENEMY_PALETTE.length)].head;
  }

  dispose(): void {
    this.element.remove();
  }
}
