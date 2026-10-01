export class LaneHud {
  private readonly element: HTMLDivElement;
  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'lane-hud';
    viewport.append(this.element);
  }
  update(lane: number, count: number): void { this.element.textContent = `DEFEND ${lane + 1} / ${count}`; }
  dispose(): void { this.element.remove(); }
}
