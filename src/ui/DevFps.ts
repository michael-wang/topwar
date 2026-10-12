// DEV only; actual RAF timestamps, no simulation-clock or renderer queries.
export class DevFps {
  readonly element = document.createElement('span');
  private previous: number | null = null;
  private elapsed = 0;
  private intervals = 0;
  constructor(host: HTMLElement) {
    this.element.className = 'dev-fps';
    const anchor = 'z-index:17;top:var(--hud-safe-top);left:calc(var(--hud-safe-left) + 50px)';
    this.element.style.cssText = `position:absolute;${anchor};height:44px;display:flex;align-items:center;color:#fff3dc;font:700 14px/1 var(--font-utility,sans-serif);text-shadow:0 1px 2px #14212b60;font-variant-numeric:tabular-nums;pointer-events:none`;
    this.reset(); host.append(this.element);
  }
  reset(label = '—'): void {
    this.previous = null; this.elapsed = 0; this.intervals = 0;
    const text = label === 'PAUSED' ? label : `FPS ${label}`;
    if (this.element.textContent !== text) this.element.textContent = text;
  }
  frame(timestamp: number, meaningful: boolean): void {
    if (!meaningful) { if (this.previous !== null) this.reset('PAUSED'); return; }
    if (this.previous !== null) {
      const dt = timestamp - this.previous;
      if (dt <= 0 || dt > 1000) { this.reset(); this.previous = timestamp; return; }
      this.elapsed += dt; this.intervals++;
      if (this.elapsed >= 333) {
        const text = `FPS ${Math.round(this.intervals * 1000 / this.elapsed)}`;
        if (this.element.textContent !== text) this.element.textContent = text;
        this.elapsed = 0; this.intervals = 0;
      }
    }
    this.previous = timestamp;
  }
  dispose(): void { this.element.remove(); }
}
