export class DevLifecycle {
  readonly initial;
  readonly events: { name: string; at: number; detail?: unknown }[] = [];
  constructor(saved: string, paused?: boolean, hidden?: boolean) {
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    this.initial = { navigation: nav?.type ?? 'unknown',
      wasDiscarded: (document as Document & { wasDiscarded?: boolean }).wasDiscarded ?? 'unsupported',
      checkpoint: saved, previousPaused: paused ?? null, previousHidden: hidden ?? null,
      hmr: !!import.meta.hot };
    console.info('[TopWar lifecycle]', this.initial); // One startup record for remote phone debugging.
    import.meta.hot?.on('vite:beforeFullReload', this.beforeReload);
  }
  private readonly beforeReload = () => this.record('vite:beforeFullReload');
  record(name: string, detail?: unknown): void {
    if (this.events.length === 32) this.events.shift();
    this.events.push({ name, at: performance.now(), detail });
  }
  dispose(): void { import.meta.hot?.off('vite:beforeFullReload', this.beforeReload); }
}
