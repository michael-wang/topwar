/** One finite presentation preparation step per idle turn; never gates gameplay. */
export class IdlePreparation {
  private handle: number | null = null;
  private cancelled = false;
  constructor(private readonly steps: Generator<unknown>) { this.schedule(); }
  private schedule(): void {
    if (this.cancelled) return;
    if (typeof requestIdleCallback === 'function') {
      this.handle = requestIdleCallback(() => {
        this.handle = null;
        this.step();
      }, { timeout: 100 });
    } else this.handle = setTimeout(() => { this.handle = null; this.step(); }, 32);
  }
  private step(): void {
    if (this.cancelled) return;
    try {
      const step = this.steps.next();
      if (!step.done) void Promise.resolve(step.value).then(() => this.schedule(), error => this.fail(error));
    } catch (error) { this.fail(error); }
  }
  private fail(error: unknown): void {
    if (!this.cancelled) console.warn('Optional presentation preparation failed', error);
    this.dispose();
  }
  dispose(): void {
    this.cancelled = true;
    if (this.handle !== null) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.handle);
      else clearTimeout(this.handle);
    }
    this.handle = null; this.steps.return(undefined);
  }
}
