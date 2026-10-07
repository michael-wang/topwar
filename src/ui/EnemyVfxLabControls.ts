import type { EnemyVfxLabRole } from '../app/EnemyVfxLab';

// Constructed only behind import.meta.env.DEV. Inline styling stays out of the
// shipping CSS, along with the controls and fixture factory in production JS.
export class EnemyVfxLabControls {
  readonly element = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly stopPointer = (event: Event) => event.stopPropagation();
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !this.canUseShortcuts()) return;
    const role = event.code === 'Digit4' ? 'curve' : event.code === 'Digit5' ? 'evolve' : event.code === 'Digit6' ? 'machineGun' : null;
    if (!role) return;
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'SUMMARY', 'OPTION'].includes(target?.tagName ?? '')
      || target?.closest?.('button,input,select,textarea,summary,a[href],[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],.tuning-panel')) return;
    event.preventDefault();
    this.select(role);
  };
  constructor(viewport: HTMLElement, private readonly select: (role: EnemyVfxLabRole) => void,
    private readonly canUseShortcuts: () => boolean = () => true) {
    this.element.className = 'enemy-vfx-lab';
    this.element.setAttribute('aria-label', 'Enemy VFX Lab');
    this.element.style.cssText = 'position:absolute;z-index:4;right:var(--hud-safe-right);top:calc(var(--hud-safe-top) + 52px);display:flex;flex-direction:column;gap:5px';
    for (const role of ['grunt', 'heavy', 'giant', 'grenade', 'curve', 'evolve', 'machineGun'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = role === 'machineGun' ? 'MG' : role.toUpperCase();
      button.dataset.role = role; button.setAttribute('aria-pressed', 'false');
      button.title = `Restart ${role} combat fixture${role === 'curve' ? ' (4)' : role === 'evolve' ? ' (5)' : role === 'machineGun' ? ' (6)' : ''}`;
      button.style.cssText = 'min-height:36px;width:60px;border:1px solid #d9e6de;border-radius:6px;background:#e7eee5e6;color:#294956;font:600 10px sans-serif;cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => {
        select(role);
        // Return focus to the battlefield for Q, lane keys and fixture shortcuts.
        if (role === 'grenade' || role === 'curve' || role === 'evolve' || role === 'machineGun') button.blur();
      });
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', this.stopPointer);
    window.addEventListener('keydown', this.keyDown);
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
    window.removeEventListener('keydown', this.keyDown);
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
