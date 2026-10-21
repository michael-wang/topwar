import { CreditsOverlay } from './CreditsOverlay';

// One accessible gesture surface owns startup; removed after activation, including
// the failure path. Audio and simulation remain owned by GameApp.
export class GameStartOverlay {
  private button: HTMLButtonElement | null = null;
  private removalTimer: ReturnType<typeof setTimeout> | null = null;
  private credits: CreditsOverlay | null = null;

  constructor(private readonly viewport: HTMLElement,
    private readonly start: (presentation: 'desktop' | 'touch') => void = () => {},
    private readonly requestFullscreen: () => void = () => {}) {}

  show(review = false): void {
    this.dispose();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `game-start-overlay${review ? ' is-review' : ''}`;
    button.setAttribute('aria-label', review ? 'Start game with audio' : '開始遊戲');
    const text = document.createElement('span');
    text.textContent = review ? 'TAP TO START' : '開始遊戲';
    let presentation: 'desktop' | 'touch' = 'touch';
    button.addEventListener('pointerdown', event => { presentation = event.pointerType === 'mouse' ? 'desktop' : 'touch'; });
    button.addEventListener('keydown', () => { presentation = 'desktop'; });
    button.addEventListener('click', () => { if (!button.disabled) this.start(presentation); });
    button.append(text);
    this.viewport.append(button);
    this.button = button;
    if (!review) this.credits = new CreditsOverlay(this.viewport, this.requestFullscreen);
    button.focus({ preventScroll: true });
  }

  setActivating(): void {
    this.credits?.dispose(); this.credits = null;
    this.button?.classList.add('is-activating');
    this.button?.setAttribute('aria-busy', 'true');
    if (this.button) this.button.disabled = true;
  }

  finish(): void {
    if (!this.button) return;
    this.button.classList.add('is-leaving');
    this.button.disabled = true;
    this.removalTimer = setTimeout(() => this.dispose(), 160);
  }

  dispose(): void {
    this.credits?.dispose(); this.credits = null;
    if (this.removalTimer !== null) clearTimeout(this.removalTimer);
    this.removalTimer = null;
    this.button?.remove();
    this.button = null;
  }
}
