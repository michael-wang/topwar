export class ControlHint {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement, defenseMode = false) {
    this.element = document.createElement('div');
    this.element.className = 'control-hint';
    this.element.innerHTML = `<span class="hint-key">A / D or ← / →</span> <span>${defenseMode ? 'STEP LANE' : 'MOVE'}</span><br><span class="hint-key">P / SPACE</span> <span>PAUSE</span><br><span class="hint-key">ESC</span> <span>TUNE</span>${defenseMode ? '<br><span class="hint-touch">TAP LEFT / RIGHT · ONE LANE</span>' : ''}`;
    viewport.append(this.element);
  }

  dispose(): void {
    this.element.remove();
  }
}
