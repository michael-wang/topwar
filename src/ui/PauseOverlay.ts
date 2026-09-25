export class PauseOverlay {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'pause-overlay';
    this.element.textContent = 'PAUSED';
    this.element.hidden = true;
    viewport.append(this.element);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  dispose(): void {
    this.element.remove();
  }
}
