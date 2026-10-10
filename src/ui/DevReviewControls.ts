import type { DevReviewFixture } from '../app/DevReviewFixtures';

// Constructed only behind import.meta.env.DEV. Inline styling stays out of the
// shipping CSS, along with the controls and fixture factory in production JS.
export class DevReviewControls {
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
  constructor(viewport: HTMLElement, private readonly select: (role: DevReviewFixture) => void,
    private readonly canUseShortcuts: () => boolean = () => true) {
    this.element.className = 'dev-review-controls';
    this.element.setAttribute('aria-label', 'DEV Review');
    this.element.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 16px';
    for (const role of ['rifle', 'grenade', 'curve', 'evolve', 'machineGun', 'late', 'mg7', 'mg8', 'carnival', 'crate3', 'crate8', 'shell', 'naval'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = role === 'rifle' ? 'LV1 RIFLE' : role === 'machineGun' ? 'MG' : role.toUpperCase();
      button.dataset.role = role; button.setAttribute('aria-pressed', 'false');
      button.title = `Restart ${role} combat fixture${role === 'curve' ? ' (4)' : role === 'evolve' ? ' (5)' : role === 'machineGun' ? ' (6)' : ''}`;
      if (role === 'rifle') button.title = 'Restart ordinary Lv1 Rifle with normal spawning and progression';
      if (role === 'late' || role === 'mg7' || role === 'mg8')
        button.title = `Restart playable Lv${role === 'late' ? 6 : role === 'mg7' ? 7 : 8} with normal spawning and progression`;
      if (role === 'carnival') button.title = 'Restart Lv6 before the Machine Gun release and full Carnival';
      if (role === 'crate3') button.title = 'Restart Lv3 Rifle teaching Supply destruction and three Grenade transfers';
      if (role === 'crate8') button.title = 'Restart Lv8 three-MG recurring Supply destruction and one Grenade transfer';
      if (role === 'shell') button.title = 'Restart Lv8 artillery dodge test: single shots, then overlapping shells';
      if (role === 'naval') button.title = 'Restart Lv8 Destroyer assault and Field Observer communication';
      button.style.cssText = 'min-height:44px;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 11px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => {
        select(role);
        // Return focus to the battlefield for Q, lane keys and fixture shortcuts.
        button.blur();
      });
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', this.stopPointer);
    window.addEventListener('keydown', this.keyDown);
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
    window.removeEventListener('keydown', this.keyDown);
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
