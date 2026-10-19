import type { TracerTrial } from '../rendering/projectiles/TracerTrial';
/** Ephemeral rendering choice. Never enters tuning, checkpoints or simulation input. */
export class DevTracerControls {
  readonly element = document.createElement('div');
  constructor(host: HTMLElement, select: (style: TracerTrial) => void, headerOffset = 74) {
    this.element.className = 'dev-tracer-controls';
    this.element.style.cssText = `position:absolute;z-index:9;top:calc(var(--hud-inset-top,0px) + ${headerOffset}px);left:50%;transform:translateX(-50%);display:flex;gap:4px`;
    const buttons: HTMLButtonElement[] = [];
    for (const style of ['A', 'B', 'C'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `子彈 ${style}`;
      button.dataset.tracer = style;
      button.style.cssText = 'min-width:64px;min-height:44px;padding:4px;border:1px solid #ffe0a0;border-radius:6px;color:#fff5dd;background:#223745e8;font:700 13px sans-serif;touch-action:manipulation';
      button.setAttribute('aria-pressed', String(style === 'A'));
      button.addEventListener('click', event => {
        event.stopPropagation(); select(style);
        buttons.forEach(b => { const active = b === button; b.setAttribute('aria-pressed', String(active)); b.style.background = active ? '#78551e' : '#223745e8'; });
        button.blur();
      });
      buttons.push(button); this.element.append(button);
    }
    buttons[0].style.background = '#78551e';
    this.element.addEventListener('pointerdown', event => event.stopPropagation());
    this.setVisible(false); host.append(this.element); select('A');
  }
  setVisible(visible: boolean): void { this.element.hidden = !visible; this.element.style.display = visible ? 'flex' : 'none'; }
  dispose(): void { this.element.remove(); }
}
