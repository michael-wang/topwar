import type { DevReviewFixture } from '../app/DevReviewFixtures';

// Constructed only behind import.meta.env.DEV. Inline styling stays out of the
// shipping CSS, along with the controls and fixture factory in production JS.
export class DevReviewControls {
  readonly element = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly stopPointer = (event: Event) => event.stopPropagation();
  constructor(viewport: HTMLElement, select: (role: DevReviewFixture) => void) {
    this.element.className = 'dev-review-controls';
    this.element.setAttribute('aria-label', 'DEV Review');
    this.element.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 16px';
    for (const role of ['late', 'crate3', 'crate8', 'naval'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = role.toUpperCase();
      button.dataset.role = role; button.setAttribute('aria-pressed', 'false');
      if (role === 'late') button.title = 'Restart Lv8 with three Machine Guns and Survival pressure';
      if (role === 'crate3') button.title = 'Restart Lv3 Rifle teaching Supply destruction and three Grenade transfers';
      if (role === 'crate8') button.title = 'Restart Lv8 three-MG recurring Supply destruction and one Grenade transfer';
      if (role === 'naval') button.title = 'Restart Lv8 Destroyer assault and Field Observer communication';
      button.style.cssText = 'min-height:44px;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 11px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => {
        select(role);
        // Return focus to the battlefield for Q and lane keys.
        button.blur();
      });
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', this.stopPointer);
    viewport.append(this.element);
  }
  setSelected(role: DevReviewFixture): void {
    for (const button of this.buttons) {
      const selected = button.dataset.role === role;
      button.setAttribute('aria-pressed', String(selected));
      button.style.background = selected ? '#7a3b1d' : '#263444';
    }
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
