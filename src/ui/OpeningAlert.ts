import { openingAlertOpacity } from '../presentation/OpeningAlertPulse';
/** Opening-only overlay; accepted Boss warning remains independently authored. */
export class OpeningAlert {
  readonly element = document.createElement('div');
  private readonly title = document.createElement('span');
  constructor(host: HTMLElement) {
    this.element.className = 'opening-alert'; this.element.setAttribute('aria-hidden', 'true');
    this.title.textContent = '敵軍來襲！'; this.element.append(this.title); host.append(this.element);
  }
  update(seconds: number, reduced: boolean): void {
    this.element.style.opacity = String(openingAlertOpacity(seconds, reduced)); this.title.hidden = seconds >= 1.2;
  }
  dispose(): void { this.element.remove(); }
}
