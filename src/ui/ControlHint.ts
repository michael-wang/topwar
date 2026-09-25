export class ControlHint {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'control-hint';
    this.element.innerHTML = 'A / D or ← / → &nbsp; MOVE<br>P / ESC &nbsp; PAUSE';
    viewport.append(this.element);
  }

  dispose(): void {
    this.element.remove();
  }
}
