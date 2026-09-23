export interface PointerDragCallbacks {
  onDragStart(): void;
  onDrag(normalizedDeltaX: number): void;
}

export class PointerDragInput {
  private activePointerId: number | null = null;
  private startClientX = 0;
  private listening = false;
  private disposed = false;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly callbacks: PointerDragCallbacks,
  ) {}

  start(): void {
    if (this.disposed) throw new Error('Cannot start disposed pointer input');
    if (this.listening) return;
    this.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.viewport.addEventListener('pointermove', this.onPointerMove);
    this.viewport.addEventListener('pointerup', this.onPointerEnd);
    this.viewport.addEventListener('pointercancel', this.onPointerEnd);
    this.viewport.addEventListener('lostpointercapture', this.onLostCapture);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    this.viewport.removeEventListener('pointerdown', this.onPointerDown);
    this.viewport.removeEventListener('pointermove', this.onPointerMove);
    this.viewport.removeEventListener('pointerup', this.onPointerEnd);
    this.viewport.removeEventListener('pointercancel', this.onPointerEnd);
    this.viewport.removeEventListener('lostpointercapture', this.onLostCapture);
    this.listening = false;
    this.endDrag();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.startClientX = event.clientX;
    this.viewport.setPointerCapture?.(event.pointerId);
    this.callbacks.onDragStart();
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const width = this.viewport.clientWidth;
    if (width > 0) this.callbacks.onDrag((event.clientX - this.startClientX) / width);
    event.preventDefault();
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.endDrag();
    event.preventDefault();
  };

  private readonly onLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) this.endDrag();
  };

  private endDrag(): void {
    const pointerId = this.activePointerId;
    this.activePointerId = null;
    if (pointerId !== null && this.viewport.hasPointerCapture?.(pointerId)) {
      this.viewport.releasePointerCapture(pointerId);
    }
  }
}
