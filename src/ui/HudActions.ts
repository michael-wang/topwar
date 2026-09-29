export class HudActions {
  readonly element: HTMLDivElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly onPointerDown = (event: PointerEvent): void => { event.stopPropagation(); };
  private readonly onClick = (): void => { this.togglePaused(); };

  constructor(viewport: HTMLElement, private readonly togglePaused: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'hud-actions';
    this.pauseButton = document.createElement('button');
    this.pauseButton.type = 'button';
    this.pauseButton.className = 'pause-button';
    this.pauseButton.addEventListener('click', this.onClick);
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.append(this.pauseButton);
    viewport.append(this.element);
    this.setPaused(false);
  }

  setPaused(paused: boolean): void {
    this.pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    this.pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    this.pauseButton.title = paused ? 'Resume game' : 'Pause game';
  }

  dispose(): void {
    this.pauseButton.removeEventListener('click', this.onClick);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.remove();
  }
}
