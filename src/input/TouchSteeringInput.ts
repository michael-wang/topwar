import type { HorizontalAxis } from './KeyboardSteeringInput';

export class TouchSteeringInput {
  private static readonly HINT_DURATION_MS = 1750;
  private readonly band: HTMLDivElement;
  private readonly zones: readonly HTMLDivElement[];
  // Map insertion order is press order; moves never promote an older pointer.
  private readonly heldPointers = new Map<number, { zone: HTMLDivElement; axis: HorizontalAxis }>();
  private axis: HorizontalAxis = 0;
  private hintUsed = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private disposed = false;

  constructor(viewport: HTMLElement, private readonly onAxisChange: (axis: HorizontalAxis) => void) {
    this.band = document.createElement('div');
    this.band.className = 'touch-steering-band';
    this.band.setAttribute('aria-hidden', 'true');
    const left = document.createElement('div');
    left.className = 'touch-steering-zone';
    const right = document.createElement('div');
    right.className = 'touch-steering-zone';
    for (const [zone, arrow] of [[left, '◀'], [right, '▶']] as const) {
      const hint = document.createElement('div');
      hint.className = 'touch-steering-hint';
      const direction = document.createElement('span');
      direction.className = 'touch-steering-arrow';
      direction.textContent = arrow;
      const label = document.createElement('span');
      label.textContent = 'HOLD TO MOVE';
      hint.append(direction, label);
      zone.append(hint);
    }
    this.zones = [left, right];
    this.band.append(left, right);
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      this.band.addEventListener(type, this.onNativeGesture);
    }
    for (const type of ['touchstart', 'touchmove']) {
      this.band.addEventListener(type, this.onTouchDefault, { passive: false });
    }
    viewport.append(this.band);
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start disposed touch input');
    if (this.listening) return;
    for (const zone of this.zones) {
      zone.addEventListener('pointerdown', this.onPointerDown);
      zone.addEventListener('pointermove', this.onPointerMove);
      zone.addEventListener('pointerup', this.onPointerEnd);
      zone.addEventListener('pointercancel', this.onPointerEnd);
      zone.addEventListener('lostpointercapture', this.onLostCapture);
    }
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    for (const zone of this.zones) {
      zone.removeEventListener('pointerdown', this.onPointerDown);
      zone.removeEventListener('pointermove', this.onPointerMove);
      zone.removeEventListener('pointerup', this.onPointerEnd);
      zone.removeEventListener('pointercancel', this.onPointerEnd);
      zone.removeEventListener('lostpointercapture', this.onLostCapture);
    }
    this.listening = false;
    this.endSteering();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      this.band.removeEventListener(type, this.onNativeGesture);
    }
    for (const type of ['touchstart', 'touchmove']) {
      this.band.removeEventListener(type, this.onTouchDefault);
    }
    this.band.remove();
    this.disposed = true;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.stopPropagation();
    event.preventDefault();
    if (this.heldPointers.has(event.pointerId)) return;
    const zone = event.currentTarget as HTMLDivElement;
    try {
      zone.setPointerCapture(event.pointerId);
    } catch {
      // A pointer canceled during dispatch cannot be captured; leave the next press free.
      return;
    }
    this.heldPointers.set(event.pointerId, { zone, axis: this.axisForX(event.clientX) });
    this.updateAxis();
    if (!this.hintUsed) {
      this.hintUsed = true;
      this.hintTimer = setTimeout(() => {
        this.band.classList.add('touch-steering-band--hint-hidden');
        this.hintTimer = null;
      }, TouchSteeringInput.HINT_DURATION_MS);
    }
  };

  private readonly onNativeGesture = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    // Suppressed browser defaults do not end the physical pointer stream.
  };

  private readonly onTouchDefault = (event: Event): void => {
    // Cancel touch defaults only; Pointer Events exclusively own steering and capture.
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pointer = this.heldPointers.get(event.pointerId);
    if (!pointer) return;
    event.stopPropagation();
    event.preventDefault();
    pointer.axis = this.axisForX(event.clientX);
    this.updateAxis();
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (!this.heldPointers.has(event.pointerId)) return;
    event.stopPropagation();
    event.preventDefault();
    this.removePointer(event.pointerId);
  };

  private readonly onLostCapture = (event: PointerEvent): void => {
    this.removePointer(event.pointerId);
  };

  private axisForX(clientX: number): HorizontalAxis {
    const bounds = this.band.getBoundingClientRect();
    return clientX < bounds.left + bounds.width / 2 ? -1 : 1;
  }

  private updateAxis(): void {
    let axis: HorizontalAxis = 0;
    for (const pointer of this.heldPointers.values()) axis = pointer.axis;
    this.setAxis(axis);
  }

  private setAxis(axis: HorizontalAxis): void {
    if (this.axis === axis) return;
    this.axis = axis;
    this.zones[0].classList.toggle('touch-steering-zone--pressed', axis === -1);
    this.zones[1].classList.toggle('touch-steering-zone--pressed', axis === 1);
    this.onAxisChange(axis);
  }

  private endSteering(): void {
    const pointers = [...this.heldPointers];
    this.heldPointers.clear();
    this.setAxis(0);
    for (const [pointerId, pointer] of pointers) this.releaseCapture(pointerId, pointer.zone);
  }

  private removePointer(pointerId: number): void {
    const pointer = this.heldPointers.get(pointerId);
    if (!pointer) return;
    this.heldPointers.delete(pointerId);
    this.updateAxis();
    this.releaseCapture(pointerId, pointer.zone);
  }

  private releaseCapture(pointerId: number, zone: HTMLDivElement): void {
    if (zone.hasPointerCapture(pointerId)) {
      try {
        zone.releasePointerCapture(pointerId);
      } catch {
        // Cancellation may retire the pointer before capture is released.
      }
    }
  }
}
