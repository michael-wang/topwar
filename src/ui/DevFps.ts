// DEV only; actual RAF timestamps, no simulation-clock or renderer queries.
export class DevFps {
  readonly element = document.createElement('span');
  private previous: number | null = null;
  private elapsed = 0;
  private intervals = 0;
  constructor(host: HTMLElement, defense: boolean) {
    this.element.className = 'dev-fps';
    const anchor = defense ? 'z-index:17;top:var(--hud-safe-top);left:calc(var(--hud-safe-left) + 78px)'
      : 'z-index:2;top:calc(max(.5rem,env(safe-area-inset-top)) + 44px);right:max(.5rem,env(safe-area-inset-right))';
    this.element.style.cssText = `position:absolute;${anchor};height:44px;box-sizing:border-box;display:flex;align-items:center;padding:0 9px;border:1px solid #566578;border-radius:8px;background:#14212bef;color:#fff3dc;font:800 19px/1 var(--font-utility,sans-serif);font-variant-numeric:tabular-nums;pointer-events:none`;
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
