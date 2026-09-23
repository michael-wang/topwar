import { describe, expect, it, vi } from 'vitest';
import { KeyboardSteeringInput } from '../src/input/KeyboardSteeringInput';

class FakeWindow {
  private readonly listeners = new Map<string, Set<(event: KeyboardEvent) => void>>();

  addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number { return this.listeners.get(type)?.size ?? 0; }

  emit(type: string, key = '', target: object = { tagName: 'DIV' }): { preventDefault: ReturnType<typeof vi.fn> } {
    const event = { key, target, preventDefault: vi.fn() };
    for (const listener of this.listeners.get(type) ?? []) listener(event as unknown as KeyboardEvent);
    return event;
  }
}

describe('KeyboardSteeringInput', () => {
  it('maps each desktop key independently to its horizontal direction', () => {
    const fakeWindow = new FakeWindow();
    const onAxisChange = vi.fn();
    const input = new KeyboardSteeringInput(fakeWindow as unknown as Window, { onAxisChange });
    input.start();
    for (const [key, axis] of [
      ['a', -1], ['ArrowLeft', -1], ['D', 1], ['ArrowRight', 1],
    ] as const) {
      fakeWindow.emit('keydown', key);
      expect(onAxisChange).toHaveBeenLastCalledWith(axis);
      fakeWindow.emit('keyup', key);
      expect(onAxisChange).toHaveBeenLastCalledWith(0);
    }
    input.dispose();
  });

  it('supports A/D and arrows, neutralizes opposing keys, and resumes the held side', () => {
    const fakeWindow = new FakeWindow();
    const onAxisChange = vi.fn();
    const input = new KeyboardSteeringInput(fakeWindow as unknown as Window, { onAxisChange });
    input.start();
    input.start();
    expect(fakeWindow.listenerCount('keydown')).toBe(1);

    fakeWindow.emit('keydown', 'A');
    expect(onAxisChange).toHaveBeenLastCalledWith(-1);
    fakeWindow.emit('keydown', 'ArrowLeft');
    expect(onAxisChange).toHaveBeenCalledTimes(1);
    fakeWindow.emit('keyup', 'A');
    expect(onAxisChange).toHaveBeenLastCalledWith(-1);
    fakeWindow.emit('keydown', 'd');
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    fakeWindow.emit('keyup', 'ArrowLeft');
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    fakeWindow.emit('keydown', 'ArrowRight');
    fakeWindow.emit('keyup', 'd');
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    fakeWindow.emit('keyup', 'ArrowRight');
    expect(onAxisChange).toHaveBeenLastCalledWith(0);

    fakeWindow.emit('keydown', 'ArrowLeft');
    const handled = fakeWindow.emit('keydown', 'ArrowRight');
    expect(handled.preventDefault).toHaveBeenCalledTimes(1);
    fakeWindow.emit('blur');
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    fakeWindow.emit('keydown', 'D');
    expect(onAxisChange).toHaveBeenLastCalledWith(1);
    input.stop();
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    expect(fakeWindow.listenerCount('keydown')).toBe(0);
    fakeWindow.emit('keydown', 'A');
    expect(onAxisChange).toHaveBeenLastCalledWith(0);
    input.dispose();
    input.dispose();
    expect(() => input.start()).toThrow(/disposed/);
  });

  it('ignores editable controls and only prevents arrow defaults during gameplay', () => {
    const fakeWindow = new FakeWindow();
    const onAxisChange = vi.fn();
    const input = new KeyboardSteeringInput(fakeWindow as unknown as Window, { onAxisChange });
    input.start();
    for (const target of [
      { tagName: 'INPUT' },
      { tagName: 'TEXTAREA' },
      { tagName: 'SELECT' },
      { tagName: 'DIV', isContentEditable: true },
    ]) {
      const event = fakeWindow.emit('keydown', 'ArrowRight', target);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(onAxisChange).not.toHaveBeenCalled();
    const other = fakeWindow.emit('keydown', 'Escape');
    expect(other.preventDefault).not.toHaveBeenCalled();
    const arrow = fakeWindow.emit('keydown', 'ArrowRight');
    expect(arrow.preventDefault).toHaveBeenCalledTimes(1);
    expect(onAxisChange).toHaveBeenCalledWith(1);
    fakeWindow.emit('keyup', 'ArrowRight');
    input.dispose();
  });
});
