export class GameOverOverlay {
  private readonly element: HTMLDivElement;
  private readonly retryButton: HTMLButtonElement;

  constructor(viewport: HTMLElement, onRetry: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'game-over-overlay';
    this.element.hidden = true;
    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    this.retryButton = document.createElement('button');
    this.retryButton.type = 'button';
    this.retryButton.textContent = 'Retry';
    this.retryButton.addEventListener('click', onRetry);
    this.retryButton.addEventListener('pointerdown', this.stopPointerPropagation);
    this.element.append(title, this.retryButton);
    viewport.append(this.element);
    this.onRetry = onRetry;
  }

  private readonly onRetry: () => void;
  private readonly stopPointerPropagation = (event: PointerEvent): void => { event.stopPropagation(); };

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  dispose(): void {
    this.retryButton.removeEventListener('click', this.onRetry);
    this.retryButton.removeEventListener('pointerdown', this.stopPointerPropagation);
    this.element.remove();
  }
}
