import { describe, expect, it, vi } from 'vitest';
import { MouseSteeringInput } from '../src/input/MouseSteeringInput';

class FakeViewport {
  clientWidth = 200;
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>();

  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: PointerEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number { return this.listeners.get(type)?.size ?? 0; }

  emit(type: string, clientX: number, pointerType = 'mouse', buttons = 0): void {
    const event = { clientX, pointerType, buttons } as PointerEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('MouseSteeringInput', () => {
  it('steers from relative button-free mouse movement without entry or re-entry jumps', () => {
    const viewport = new FakeViewport();
    const onMove = vi.fn();
    const input = new MouseSteeringInput(viewport as unknown as HTMLElement, { onMove });
    input.start();
    input.start();
    expect(viewport.listenerCount('pointermove')).toBe(1);

    viewport.emit('pointerenter', 100);
    expect(onMove).not.toHaveBeenCalled();
    viewport.emit('pointermove', 150, 'touch');
    expect(onMove).not.toHaveBeenCalled();
    viewport.emit('pointermove', 120);
    viewport.emit('pointermove', 80);
    expect(onMove.mock.calls).toEqual([[0.1], [-0.2]]);

    viewport.emit('pointerleave', 80);
    viewport.emit('pointerenter', 190);
    expect(onMove).toHaveBeenCalledTimes(2);
    viewport.emit('pointermove', 180);
    expect(onMove).toHaveBeenLastCalledWith(-0.05);

    input.stop();
    expect(viewport.listenerCount('pointermove')).toBe(0);
    viewport.emit('pointermove', 100);
    expect(onMove).toHaveBeenCalledTimes(3);
    input.start();
    viewport.emit('pointermove', 100);
    expect(onMove).toHaveBeenCalledTimes(3);
    viewport.emit('pointermove', 120);
    expect(onMove).toHaveBeenLastCalledWith(0.1);
    input.dispose();
    input.dispose();
    expect(viewport.listenerCount('pointermove')).toBe(0);
    expect(() => input.start()).toThrow(/disposed/);
  });
});
