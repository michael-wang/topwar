import { emergencyPulse } from '../presentation/ArtilleryEmergency';

export class ArtilleryEmergencyHud {
  readonly element = document.createElement('div');
  private readonly glyph = document.createElement('span');
  private readonly reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  constructor(private readonly host: HTMLElement, private readonly project: (x: number) => { x: number; y: number }) {
    this.element.className = 'artillery-emergency'; this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.glyph.textContent = '!'; this.element.append(this.glyph); host.append(this.element);
  }

  update(remaining: number | null, playerX: number): void {
    this.element.hidden = remaining === null;
    if (remaining === null) return;
    const reduced = this.reducedMotion?.matches ?? false, pulse = emergencyPulse(remaining);
    const urgency = 1 - Math.max(0, Math.min(.5, remaining)) / .5;
    const point = this.project(playerX);
    // Screen fitting affects only this personal cue, never the camera or impact coordinates.
    this.glyph.style.left = `${Math.max(38, Math.min(this.host.clientWidth - 38, point.x))}px`;
    this.glyph.style.top = `${Math.max(140, Math.min(this.host.clientHeight - 180, point.y))}px`;
    this.glyph.style.transform = `translate(-50%, -100%) scale(${reduced ? 1 : 1 + pulse * (.12 + .16 * urgency)})`;
    this.element.style.setProperty('--emergency-glow', String(reduced ? .09 : .035 + pulse * (.07 + .05 * urgency)));
  }

  reset(): void { this.element.hidden = true; }
  dispose(): void { this.element.remove(); }
}
