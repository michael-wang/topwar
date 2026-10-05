// One accessible gesture surface owns startup; removed after activation, including
// the failure path. Audio and simulation remain owned by GameApp.
export class GameStartOverlay {
  private button: HTMLButtonElement | null = null;
  private removalTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly viewport: HTMLElement) {}

  show(): void {
    this.dispose();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-start-overlay';
    button.setAttribute('aria-label', 'Start game with audio');
    const text = document.createElement('span');
    text.textContent = 'TAP TO START';
    button.append(text);
    this.viewport.append(button);
    this.button = button;
  }

  setActivating(): void {
    this.button?.classList.add('is-activating');
    this.button?.setAttribute('aria-busy', 'true');
  }

  finish(): void {
    if (!this.button) return;
    this.button.classList.add('is-leaving');
    this.button.disabled = true;
    this.removalTimer = setTimeout(() => this.dispose(), 160);
  }

  dispose(): void {
    if (this.removalTimer !== null) clearTimeout(this.removalTimer);
    this.removalTimer = null;
    this.button?.remove();
    this.button = null;
  }
}
