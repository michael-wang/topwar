export class ControlHint {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement, defenseMode = false) {
    this.element = document.createElement('div');
    this.element.className = 'control-hint';
    this.element.innerHTML = `A / D or ← / → &nbsp; ${defenseMode ? 'STEP LANE' : 'MOVE'}<br>P / SPACE &nbsp; PAUSE<br>ESC &nbsp; TUNE`;
    viewport.append(this.element);
  }

  dispose(): void {
    this.element.remove();
  }
}
