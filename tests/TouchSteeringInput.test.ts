import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchSteeringInput } from '../src/input/TouchSteeringInput';
import { PointerDragInput } from '../src/input/PointerDragInput';

class FakeElement {
  className = '';
  readonly classList = {
    add: (name: string) => { this.setClass(name, true); },
    toggle: (name: string, force: boolean) => { this.setClass(name, force); },
    contains: (name: string) => this.className.split(' ').includes(name),
  };
  textContent = '';
  clientWidth = 200;
  failCapture = false;
  failRelease = false;
  removed = false;
  readonly children: FakeElement[] = [];
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>();
  private readonly captures = new Set<number>();
  private parent: FakeElement | null = null;

  private setClass(name: string, enabled: boolean): void {
    const names = new Set(this.className.split(' ').filter(Boolean));
    if (enabled) names.add(name);
    else names.delete(name);
    this.className = [...names].join(' ');
  }

  append(...children: FakeElement[]): void {
    for (const child of children) { child.parent = this; this.children.push(child); }
  }
  setAttribute(): void {}
  remove(): void { this.removed = true; }
  getBoundingClientRect(): DOMRect { return { left: 0, width: 200 } as DOMRect; }
  setPointerCapture(id: number): void {
    if (this.failCapture) { this.failCapture = false; throw new Error('pointer retired'); }
    this.captures.add(id);
  }
  hasPointerCapture(id: number): boolean { return this.captures.has(id); }
  releasePointerCapture(id: number): void {
    this.captures.delete(id);
    if (this.failRelease) { this.failRelease = false; throw new Error('pointer retired'); }
  }
  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: PointerEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, pointerId: number, clientX: number, pointerType = 'touch'): PointerEvent {
    let stopped = false;
    const event = { pointerId, clientX, pointerType, preventDefault: vi.fn(),
      stopPropagation: vi.fn(() => { stopped = true; }), currentTarget: this } as unknown as PointerEvent;
    for (let node: FakeElement | null = this; node && !stopped; node = node.parent) {
      Object.defineProperty(event, 'currentTarget', { value: node, configurable: true });
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    return event;
  }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('TouchSteeringInput', () => {
  function setup() {
    vi.stubGlobal('document', { createElement: () => new FakeElement() });
    const viewport = new FakeElement();
    const onAxisChange = vi.fn();
    const touch = new TouchSteeringInput(viewport as unknown as HTMLElement, onAxisChange);
    const band = viewport.children[0];
    const [left, right] = band.children;
    return { viewport, band, left, right, touch, onAxisChange };
  }

  it('holds left or right, crosses halves, and clears on release, cancel, or lost capture', () => {
    const { left, right, touch, onAxisChange } = setup();
    touch.start();
    left.emit('pointerdown', 1, 20);
    expect(onAxisChange).toHaveBeenLastCalledWith(-1);
    expect(left.classList.contains('touch-steering-zone--pressed')).toBe(true);
    expect(left.hasPointerCapture(1)).toBe(true);
    left.emit('pointermove', 1, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    expect(right.classList.contains('touch-steering-zone--pressed')).toBe(true);
    expect(left.classList.contains('touch-steering-zone--pressed')).toBe(false);
    left.emit('pointerup', 1, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    expect(right.classList.contains('touch-steering-zone--pressed')).toBe(false);
    expect(left.hasPointerCapture(1)).toBe(false);
    right.emit('pointerdown', 2, 180, 'pen');
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    right.emit('pointercancel', 2, 180, 'pen');
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    right.emit('pointerdown', 3, 180);
    right.emit('lostpointercapture', 3, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    touch.dispose();
  });

  it('accepts only one steering pointer and clears it on stop and disposal', () => {
    const { band, left, right, touch, onAxisChange } = setup();
    touch.start();
    left.emit('pointerdown', 1, 20);
    right.emit('pointerdown', 2, 180);
    right.emit('pointermove', 2, 180);
    expect(onAxisChange.mock.calls).toEqual([[-1]]);
    touch.stop();
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    expect(left.hasPointerCapture(1)).toBe(false);
    touch.start();
    left.emit('pointermove', 1, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    right.emit('pointerdown', 3, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    touch.dispose();
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    expect(band.removed).toBe(true);
    expect(() => touch.start()).toThrow(/disposed/);
  });

  it('shows the first-use hint, then hides it once across stop/start and Retry lifecycle', () => {
    vi.useFakeTimers();
    const { band, left, right, touch } = setup();
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(false);
    expect(left.children[0].children.map((child) => child.textContent))
      .toEqual(['◀', 'HOLD TO MOVE']);
    touch.start();
    left.emit('pointerdown', 1, 20, 'mouse');
    vi.advanceTimersByTime(2000);
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(false);
    left.emit('pointerdown', 2, 20);
    touch.stop();
    touch.start();
    vi.advanceTimersByTime(1749);
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(true);
    right.emit('pointerdown', 3, 180);
    touch.stop();
    touch.start();
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(true);
    touch.dispose();
  });

  it('suppresses native long-press gestures, clears capture, and accepts the opposite side immediately', () => {
    const { viewport, band, left, right, touch, onAxisChange } = setup();
    touch.start();
    for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
      const reachedViewport = vi.fn();
      viewport.addEventListener(type, reachedViewport);
      left.emit('pointerdown', 1, 20);
      expect(onAxisChange).toHaveBeenLastCalledWith(-1);
      const event = left.children[0].emit(type, 1, 20);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
      expect(reachedViewport).not.toHaveBeenCalled();
      expect(left.hasPointerCapture(1)).toBe(false);
      expect(onAxisChange).toHaveBeenLastCalledWith(0);
      right.emit('pointerdown', 2, 180);
      expect(onAxisChange).toHaveBeenLastCalledWith(1);
      left.emit('lostpointercapture', 1, 20);
      expect(onAxisChange).toHaveBeenLastCalledWith(1);
      right.emit('pointerup', 2, 180);
      expect(onAxisChange).toHaveBeenLastCalledWith(0);
      viewport.removeEventListener(type, reachedViewport);
    }
    expect(band.classList.contains('touch-steering-band--hint-hidden')).toBe(false);
    touch.dispose();
  });

  it('continues steering through a long hold and switches sides with one new press', () => {
    vi.useFakeTimers();
    const { left, right, touch, onAxisChange } = setup();
    touch.start();
    left.emit('pointerdown', 1, 20);
    vi.advanceTimersByTime(5000);
    expect(onAxisChange.mock.calls).toEqual([[-1]]);
    left.emit('pointerup', 1, 20);
    right.emit('pointerdown', 2, 180);
    expect(onAxisChange.mock.calls).toEqual([[-1], [0], [1]]);
    touch.dispose();
  });

  it('recovers immediately if the browser retires a pointer during capture or release', () => {
    const { left, right, touch, onAxisChange } = setup();
    touch.start();
    left.failCapture = true;
    left.emit('pointerdown', 1, 20);
    expect(onAxisChange).not.toHaveBeenCalled();
    right.emit('pointerdown', 2, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    right.failRelease = true;
    right.emit('pointercancel', 2, 180);
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    left.emit('pointerdown', 3, 20);
    expect(onAxisChange).toHaveBeenLastCalledWith(-1);
    touch.dispose();
  });

  it('claims touch-zone gestures while viewport drag remains available outside the band', () => {
    const { viewport, left, right, touch, onAxisChange } = setup();
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const drag = new PointerDragInput(viewport as unknown as HTMLElement, { onDragStart, onDrag });
    drag.start();
    touch.start();
    left.emit('pointerdown', 1, 20);
    left.emit('pointermove', 1, 40);
    left.emit('pointerup', 1, 40);
    expect(onAxisChange.mock.calls).toEqual([[-1], [0]]);
    expect(onDragStart).not.toHaveBeenCalled();
    right.emit('pointerdown', 2, 180);
    right.emit('pointercancel', 2, 180);
    expect(onDragStart).not.toHaveBeenCalled();
    viewport.emit('pointerdown', 3, 40);
    viewport.emit('pointermove', 3, 90);
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDrag).toHaveBeenLastCalledWith(0.25);
    viewport.emit('pointerup', 3, 90);
    touch.dispose();
    drag.dispose();
  });
});
