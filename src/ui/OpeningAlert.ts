/** Opening-only overlay; accepted Boss warning remains independently authored. */
export class OpeningAlert {
  readonly element = document.createElement('div');
  private readonly title = document.createElement('span');
  constructor(host: HTMLElement) {
    this.element.className = 'opening-alert'; this.element.setAttribute('aria-hidden', 'true');
    this.title.textContent = '敵軍來襲！'; this.element.append(this.title); host.append(this.element);
  }
  update(seconds: number, reduced: boolean): void {
    const strength = seconds < 1.2 ? (reduced ? .65 : .55 + .35 * Math.sin(Math.PI * seconds / 1.2))
      : reduced ? .58 : .52 + .12 * (1 + Math.sin(2 * Math.PI * (seconds - 1.2) / 2.6)) / 2;
    this.element.style.opacity = String(strength); this.title.hidden = seconds >= 1.2;
  }
  dispose(): void { this.element.remove(); }
}
