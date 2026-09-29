import type { HorizontalAxis } from './KeyboardSteeringInput';

export class TouchSteeringInput {
  private readonly band: HTMLDivElement;
  private readonly zones: readonly HTMLDivElement[];
  private activePointerId: number | null = null;
  private activeZone: HTMLDivElement | null = null;
  private axis: HorizontalAxis = 0;
  private listening = false;
  private disposed = false;

  constructor(viewport: HTMLElement, private readonly onAxisChange: (axis: HorizontalAxis) => void) {
    this.band = document.createElement('div');
    this.band.className = 'touch-steering-band';
    this.band.setAttribute('aria-hidden', 'true');
    const left = document.createElement('div');
    left.className = 'touch-steering-zone';
    left.textContent = '◀';
    const right = document.createElement('div');
    right.className = 'touch-steering-zone';
    right.textContent = '▶';
    this.zones = [left, right];
    this.band.append(left, right);
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
    this.band.remove();
    this.disposed = true;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.stopPropagation();
    event.preventDefault();
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.activeZone = event.currentTarget as HTMLDivElement;
    this.activeZone.setPointerCapture(event.pointerId);
    this.updateAxis(event.clientX);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.stopPropagation();
    event.preventDefault();
    this.updateAxis(event.clientX);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.stopPropagation();
    event.preventDefault();
    this.endSteering();
  };

  private readonly onLostCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) this.endSteering();
  };

  private updateAxis(clientX: number): void {
    const bounds = this.band.getBoundingClientRect();
    this.setAxis(clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  }

  private setAxis(axis: HorizontalAxis): void {
    if (this.axis === axis) return;
    this.axis = axis;
    this.onAxisChange(axis);
  }

  private endSteering(): void {
    const zone = this.activeZone;
    const pointerId = this.activePointerId;
    this.activeZone = null;
    this.activePointerId = null;
    if (zone && pointerId !== null && zone.hasPointerCapture(pointerId)) {
      zone.releasePointerCapture(pointerId);
    }
    this.setAxis(0);
  }
}
