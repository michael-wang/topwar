export type WakeStatus = 'active' | 'released' | 'requesting' | 'releasing' | 'insecure' | 'unsupported' | 'error';
type Sentinel = Pick<WakeLockSentinel, 'released' | 'release' | 'addEventListener' | 'removeEventListener'>;
type Platform = { secure: boolean; request?: () => Promise<Sentinel> };

/** Event-driven, single owned sentinel/request. No frame polling or automatic denial retry. */
export class ScreenWakeLock {
  private wanted = false;
  private disposed = false;
  private epoch = 0;
  private sentinel: Sentinel | null = null;
  private operation: Promise<void> | null = null;
  private listener: ((status: WakeStatus) => void) | null = null;
  private current: WakeStatus;
  constructor(private readonly platform: Platform = {
    secure: globalThis.isSecureContext === true,
    request: globalThis.navigator?.wakeLock ? () => navigator.wakeLock.request('screen') : undefined,
  }) { this.current = !platform.secure ? 'insecure' : !platform.request ? 'unsupported' : 'released'; }
  get status(): WakeStatus { return this.current; }
  observe(listener: ((status: WakeStatus) => void) | null): void { this.listener = listener; listener?.(this.current); }
  private publish(status: WakeStatus): void {
    if (status !== this.current) { this.current = status; this.listener?.(status); }
  }
  setActive(active: boolean): void {
    if (this.disposed) return;
    if (this.wanted !== active) { this.wanted = active; this.epoch++; }
    this.reconcile();
  }
  private readonly released = (): void => {
    this.sentinel?.removeEventListener('release', this.released);
    this.sentinel = null; this.publish('released');
    // System/battery release is respected. A later Start/Resume/review gesture can retry.
  };
  private async releaseOwned(): Promise<void> {
    const owned = this.sentinel;
    if (!owned) return;
    this.publish('releasing');
    try {
      await owned.release();
      if (owned.released && this.sentinel === owned) this.released();
    } catch { this.publish('error'); }
  }
  private reconcile(): void {
    if (this.operation || !this.platform.secure || !this.platform.request) return;
    if (this.sentinel && this.wanted && !this.disposed) return;
    if (!this.sentinel && (!this.wanted || this.disposed)) return;
    const epoch = this.epoch;
    const work = async () => {
      if (this.sentinel) { await this.releaseOwned(); return; }
      this.publish('requesting');
      try {
        const sentinel = await this.platform.request!();
        this.sentinel = sentinel;
        sentinel.addEventListener('release', this.released);
        if (sentinel.released) this.released();
        else if (!this.wanted || this.disposed || epoch !== this.epoch) await this.releaseOwned();
        else this.publish('active');
      } catch { this.publish(this.wanted && !this.disposed ? 'error' : 'released'); }
    };
    this.operation = work().finally(() => {
      this.operation = null;
      // Resume while an old request/release was pending must wait for its cleanup.
      if (epoch !== this.epoch && this.wanted && !this.disposed && !this.sentinel) this.reconcile();
    });
  }
  dispose(): void {
    this.wanted = false; this.disposed = true; this.epoch++; this.listener = null; this.reconcile();
  }
}
