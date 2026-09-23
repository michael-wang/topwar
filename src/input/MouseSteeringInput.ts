export interface MouseSteeringCallbacks {
  onMove(normalizedDeltaX: number): void;
}

export class MouseSteeringInput {
  private previousClientX: number | null = null;
  private listening = false;
  private disposed = false;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly callbacks: MouseSteeringCallbacks,
  ) {}

  start(): void {
    if (this.disposed) throw new Error('Cannot start disposed mouse input');
    if (this.listening) return;
    this.viewport.addEventListener('pointerenter', this.onPointerEnter);
    this.viewport.addEventListener('pointermove', this.onPointerMove);
    this.viewport.addEventListener('pointerleave', this.onPointerLeave);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    this.viewport.removeEventListener('pointerenter', this.onPointerEnter);
    this.viewport.removeEventListener('pointermove', this.onPointerMove);
    this.viewport.removeEventListener('pointerleave', this.onPointerLeave);
    this.previousClientX = null;
    this.listening = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private readonly onPointerEnter = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.previousClientX = event.clientX;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const previousClientX = this.previousClientX;
    this.previousClientX = event.clientX;
    const width = this.viewport.clientWidth;
    if (previousClientX !== null && width > 0) {
      this.callbacks.onMove((event.clientX - previousClientX) / width);
    }
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.previousClientX = null;
  };
}
