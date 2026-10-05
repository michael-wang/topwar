import type { EnemyVfxLabRole } from '../app/EnemyVfxLab';

// Constructed only behind import.meta.env.DEV. Inline styling stays out of the
// shipping CSS, along with the controls and fixture factory in production JS.
export class EnemyVfxLabControls {
  readonly element = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly stopPointer = (event: Event) => event.stopPropagation();
  constructor(viewport: HTMLElement, select: (role: EnemyVfxLabRole) => void) {
    this.element.className = 'enemy-vfx-lab';
    this.element.setAttribute('aria-label', 'Enemy VFX Lab');
    this.element.style.cssText = 'position:absolute;z-index:4;right:var(--hud-safe-right);top:calc(var(--hud-safe-top) + 52px);display:flex;flex-direction:column;gap:5px';
    for (const role of ['grunt', 'heavy', 'giant'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = role.toUpperCase();
      button.dataset.role = role; button.setAttribute('aria-pressed', 'false');
      button.title = `Restart ${role} combat fixture`;
      button.style.cssText = 'min-height:36px;width:60px;border:1px solid #d9e6de;border-radius:6px;background:#e7eee5e6;color:#294956;font:600 10px sans-serif;cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => select(role));
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', this.stopPointer);
    viewport.append(this.element);
  }
  setSelected(role: EnemyVfxLabRole): void {
    for (const button of this.buttons) {
      const selected = button.dataset.role === role;
      button.setAttribute('aria-pressed', String(selected));
      button.style.background = selected ? '#b8d8d6' : '#e7eee5e6';
    }
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
