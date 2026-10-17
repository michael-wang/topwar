// Optional presentation mode only. Never retries automatically after a system exit.
export class MobileFullscreen {
  private pending = false;
  private disposed = false;
  private button: HTMLButtonElement | null = null;
  private beforeRequest: (() => void) | null = null;
  constructor(private readonly viewport: HTMLElement) {
    document.addEventListener?.('fullscreenchange', this.refresh);
    window.addEventListener?.('resize', this.refresh);
  }

  get eligible(): boolean {
    return typeof this.viewport.requestFullscreen === 'function' && document.fullscreenEnabled !== false
      && (globalThis.navigator?.maxTouchPoints > 0 || globalThis.matchMedia?.('(pointer: coarse)').matches === true)
      && window.innerHeight > window.innerWidth;
  }

  request(): void {
    if (this.disposed || this.pending || !this.eligible || document.fullscreenElement) return;
    this.pending = true; this.refresh();
    try {
      // Native call stays in the real Start/Resume/menu click, before any await.
      void this.viewport.requestFullscreen({ navigationUI: 'hide' }).then(this.settled, this.settled);
    } catch { this.settled(); }
  }

  mount(host: HTMLElement, beforeRequest: () => void): void {
    if (typeof this.viewport.requestFullscreen !== 'function') return;
    this.beforeRequest = beforeRequest;
    this.button = document.createElement('button');
    this.button.type = 'button'; this.button.className = 'mobile-fullscreen';
    this.button.textContent = '全螢幕';
    this.button.addEventListener('click', this.enter);
    host.append(this.button); this.refresh();
  }

  private readonly enter = (): void => {
    if (this.disposed || this.pending || !this.eligible || document.fullscreenElement) return;
    this.beforeRequest?.(); this.request();
  };
  private readonly settled = (): void => { this.pending = false; this.refresh(); };
  private readonly refresh = (): void => {
    if (this.disposed || !this.button) return;
    this.button.hidden = !this.eligible || !!document.fullscreenElement;
    this.button.disabled = this.pending;
  };
  dispose(): void {
    this.disposed = true;
    document.removeEventListener?.('fullscreenchange', this.refresh);
    window.removeEventListener?.('resize', this.refresh);
    this.button?.removeEventListener('click', this.enter); this.button?.remove();
    this.button = null; this.beforeRequest = null;
  }
}
