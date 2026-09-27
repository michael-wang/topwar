export class ControlHint {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'control-hint';
    this.element.innerHTML = 'A / D or ← / → &nbsp; MOVE<br>P / SPACE &nbsp; PAUSE<br>ESC &nbsp; TUNE';
    viewport.append(this.element);
  }

  dispose(): void {
    this.element.remove();
  }
}
