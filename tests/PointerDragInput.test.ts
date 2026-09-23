import { describe, expect, it, vi } from 'vitest';
import { PointerDragInput } from '../src/input/PointerDragInput';

class FakeViewport {
  clientWidth = 200;
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>();
  private readonly captured = new Set<number>();

  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: PointerEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  setPointerCapture(id: number): void { this.captured.add(id); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); }
  listenerCount(type: string): number { return this.listeners.get(type)?.size ?? 0; }

  emit(type: string, pointerId: number, clientX: number): void {
    const event = { pointerId, clientX, preventDefault: vi.fn() } as unknown as PointerEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('PointerDragInput', () => {
  it('tracks one pointer, reports normalized relative drag, and preserves lifecycle', () => {
    const viewport = new FakeViewport();
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const input = new PointerDragInput(viewport as unknown as HTMLElement, { onDragStart, onDrag });
    input.start();
    input.start();
    expect(viewport.listenerCount('pointerdown')).toBe(1);

    viewport.emit('pointerdown', 1, 50);
    viewport.emit('pointerdown', 2, 100);
    viewport.emit('pointermove', 2, 150);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDrag).not.toHaveBeenCalled();
    viewport.emit('pointermove', 1, 100);
    viewport.emit('pointermove', 1, 0);
    expect(onDrag.mock.calls).toEqual([[0.25], [-0.25]]);

    viewport.emit('pointercancel', 1, 0);
    viewport.emit('pointermove', 1, 150);
    expect(onDrag).toHaveBeenCalledTimes(2);
    viewport.emit('pointerdown', 2, 100);
    expect(onDragStart).toHaveBeenCalledTimes(2);
    viewport.emit('pointerup', 2, 100);
    viewport.emit('pointerdown', 3, 100);
    expect(onDragStart).toHaveBeenCalledTimes(3);
    viewport.emit('lostpointercapture', 3, 100);
    viewport.emit('pointerdown', 4, 100);
    expect(onDragStart).toHaveBeenCalledTimes(4);
    input.stop();
    expect(viewport.listenerCount('pointerdown')).toBe(0);
    viewport.emit('pointermove', 4, 150);
    expect(onDrag).toHaveBeenCalledTimes(2);
    input.start();
    expect(viewport.listenerCount('pointerdown')).toBe(1);
    input.dispose();
    input.dispose();
    expect(viewport.listenerCount('pointerdown')).toBe(0);
    expect(() => input.start()).toThrow(/disposed/);
  });
});
