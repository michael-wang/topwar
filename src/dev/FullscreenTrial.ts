// Optional DEV probe only. Fullscreen never owns gameplay or audio activation.
export class FullscreenTrial {
  private readonly root = document.createElement('div');
  private readonly button = document.createElement('button');
  private readonly status = document.createElement('p');
  private pending = false;
  private disposed = false;
  constructor(host: HTMLElement, private readonly viewport: HTMLElement) {
    this.root.className = 'dev-fullscreen-trial';
    this.button.type = 'button';
    this.button.style.cssText = 'min-height:44px;width:100%;padding:8px;touch-action:manipulation';
    this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.root.append(this.button, this.status); host.append(this.root);
    this.button.addEventListener('click', this.toggle);
    document.addEventListener('fullscreenchange', this.changed);
    document.addEventListener('fullscreenerror', this.rejected);
    this.refresh();
  }
  private get supported(): boolean { return typeof this.viewport.requestFullscreen === 'function' && document.fullscreenEnabled !== false; }
  private readonly toggle = (): void => {
    if (this.disposed || this.pending || !this.supported) return;
    this.pending = true; this.refresh();
    try {
      // Must run synchronously inside the actual click, before any awaited work.
      const result = document.fullscreenElement === this.viewport
        ? document.exitFullscreen() : this.viewport.requestFullscreen({ navigationUI: 'hide' });
      void result.then(() => { if (!this.disposed) { this.pending = false; this.refresh(); } }, this.rejected);
    } catch { this.rejected(); }
  };
  private readonly changed = (): void => { if (!this.disposed) { this.pending = false; this.refresh(); } };
  private readonly rejected = (): void => {
    if (this.disposed) return;
    this.pending = false; this.refresh('請求未成功；可在一般視窗繼續遊戲，或再次測試。');
  };
  private refresh(message = ''): void {
    const active = document.fullscreenElement === this.viewport;
    this.button.textContent = this.pending ? '正在切換全螢幕…' : active ? '離開全螢幕（DEV）' : '進入全螢幕（DEV）';
    this.button.disabled = !this.supported || this.pending;
    this.status.textContent = `Fullscreen: ${active ? 'ON' : 'OFF'} · ${globalThis.isSecureContext ? 'SECURE CONTEXT' : 'INSECURE CONTEXT'}。${this.supported ? message : '此環境不支援全螢幕；一般視窗可繼續遊戲。'}`;
  }
  dispose(): void {
    this.disposed = true;
    this.button.removeEventListener('click', this.toggle);
    document.removeEventListener('fullscreenchange', this.changed);
    document.removeEventListener('fullscreenerror', this.rejected);
    this.root.remove();
  }
}
