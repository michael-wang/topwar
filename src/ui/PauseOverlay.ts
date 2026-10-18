export class PauseOverlay {
  private readonly element: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly blocked = new Map<HTMLElement, boolean>();
  private readonly stopPointer = (event: Event): void => { event.stopPropagation(); };
  private readonly onClick = (event: Event): void => {
    event.stopPropagation();
    if (!this.element.hidden && !this.button.hidden) this.resume();
  };

  constructor(private readonly viewport: HTMLElement, private readonly resume: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'pause-overlay';
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = '暫停';
    this.button.setAttribute('aria-label', '繼續遊戲');
    this.button.addEventListener('click', this.onClick);
    this.element.addEventListener('pointerdown', this.stopPointer);
    this.element.append(this.button);
    this.element.hidden = true;
    viewport.append(this.element);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
    if (visible) {
      for (const child of Array.from(this.viewport.children) as HTMLElement[]) {
        if (child === this.element || child.classList.contains('hud-actions')
          || child.classList.contains('tuning-panel') || this.blocked.has(child)) continue;
        this.blocked.set(child, child.inert); child.inert = true;
      }
    } else {
      for (const [child, inert] of this.blocked) child.inert = inert;
      this.blocked.clear();
      this.button.blur(); // A hidden button must not swallow the next keyboard shortcut.
    }
  }

  setMenuOpen(open: boolean): void {
    this.button.hidden = open;
    if (open) this.button.blur();
  }

  dispose(): void {
    this.setVisible(false);
    this.button.removeEventListener('click', this.onClick);
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
