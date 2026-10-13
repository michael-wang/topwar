import type { DevReviewFixture } from '../app/DevReviewFixtures';

export const PLAYTEST_ENTRIES = [
  { role: 'naval', label: '🚢 驅逐艦進場' },
  { role: 'boss-intro', label: '🚨 BOSS 進場' },
  { role: 'victory', label: '🏆 勝利結算' },
] as const;

// Created only in DEV; presets and these styles never enter the public bundle.
export class DevReviewControls {
  readonly element = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly stopPointer = (event: Event) => event.stopPropagation();
  constructor(host: HTMLElement, select: (role: DevReviewFixture | null) => void) {
    this.element.className = 'dev-review-controls';
    this.element.setAttribute('aria-label', '測試場景');
    this.element.style.cssText = 'display:grid;gap:10px;margin:0 0 8px';
    const style = document.createElement('style');
    style.textContent = `.dev-review-controls button[data-role]{min-height:52px;padding:12px;font:700 17px var(--font-utility,sans-serif);touch-action:manipulation;user-select:none;transition:transform .08s,filter .08s}
      .dev-review-controls button[data-role]:active{transform:translateY(2px);filter:brightness(1.4);box-shadow:inset 0 2px 5px #0008}
      .dev-review-controls button:focus-visible{outline:2px solid #ffdb78;outline-offset:2px}`;
    this.element.append(style);
    for (const { role, label } of PLAYTEST_ENTRIES) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label; button.dataset.role = role;
      button.addEventListener('click', () => { select(role); button.blur(); });
      this.buttons.push(button); this.element.append(button);
    }
    const back = document.createElement('button');
    back.type = 'button'; back.textContent = '返回一般遊戲'; back.dataset.action = 'normal';
    back.style.cssText = 'min-height:44px;background:transparent;border:0;font:13px var(--font-utility,sans-serif);touch-action:manipulation';
    back.addEventListener('click', () => { select(null); back.blur(); });
    this.element.append(back);
    this.element.addEventListener('pointerdown', this.stopPointer);
    host.append(this.element); this.setSelected();
  }
  setSelected(role?: DevReviewFixture): void {
    for (const button of this.buttons) {
      const selected = button.dataset.role === role;
      button.setAttribute('aria-pressed', String(selected));
      button.style.background = selected ? '#795627' : '#263444';
    }
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer); this.element.remove();
  }
}
