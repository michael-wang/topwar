export interface MouseSteeringCallbacks {
  onMove(normalizedDeltaX: number): void;
}

export class MouseSteeringInput {
  private static readonly idleDelayMs = 160;
  private previousClientX: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private disposed = false;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly callbacks: MouseSteeringCallbacks,
  ) {}

  start(): void {
    if (this.disposed) throw new Error('Cannot start disposed mouse input');
    if (this.listening) return;
    this.setDirection('neutral');
    this.viewport.addEventListener('pointerenter', this.onPointerEnter);
    this.viewport.addEventListener('pointermove', this.onPointerMove);
    this.viewport.addEventListener('pointerleave', this.onPointerLeave);
    this.listening = true;
  }

  stop(): void {
    this.clearIdleTimer();
    this.setDirection('neutral');
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
    if (event.pointerType === 'mouse') {
      this.previousClientX = event.clientX;
      this.clearIdleTimer();
      this.setDirection('neutral');
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const previousClientX = this.previousClientX;
    this.previousClientX = event.clientX;
    const width = this.viewport.clientWidth;
    if (previousClientX !== null && width > 0) {
      const deltaX = event.clientX - previousClientX;
      this.callbacks.onMove(deltaX / width);
      this.clearIdleTimer();
      this.setDirection(deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : 'neutral');
      if (deltaX !== 0) {
        this.idleTimer = setTimeout(() => {
          this.idleTimer = null;
          this.setDirection('neutral');
        }, MouseSteeringInput.idleDelayMs);
      }
    }
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      this.previousClientX = null;
      this.clearIdleTimer();
      this.setDirection('neutral');
    }
  };

  private setDirection(direction: 'left' | 'right' | 'neutral'): void {
    this.viewport.dataset.mouseDirection = direction;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
