import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  step: vi.fn(),
  render: vi.fn(),
  startResizeHandling: vi.fn(),
  stopResizeHandling: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../src/simulation/Simulation', () => ({
  Simulation: class {
    step = mock.step;
  },
}));

vi.mock('../src/rendering/GameRenderer', () => ({
  GameRenderer: class {
    render = mock.render;
    startResizeHandling = mock.startResizeHandling;
    stopResizeHandling = mock.stopResizeHandling;
    dispose = mock.dispose;
  },
}));

import { GameApp } from '../src/app/GameApp';

afterEach(() => {
  vi.unstubAllGlobals();
  for (const method of Object.values(mock)) method.mockClear();
});

describe('GameApp frame lifecycle', () => {
  it('uses one RAF loop, renders each frame, and resumes without stopped-time catch-up', () => {
    const pending = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    const request = vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    });
    const cancel = vi.fn((id: number) => { pending.delete(id); });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const frame = (timestampMs: number) => {
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback(timestampMs);
    };
    const app = new GameApp({} as HTMLElement);
    app.start();
    app.start();
    expect(pending.size).toBe(1);
    expect(mock.startResizeHandling).toHaveBeenCalledTimes(1);

    frame(100);
    expect(mock.step).not.toHaveBeenCalled();
    expect(mock.render).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);

    frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledExactlyOnceWith(1 / 60);
    expect(mock.render).toHaveBeenCalledTimes(2);
    app.stop();
    expect(pending.size).toBe(0);
    expect(cancel).toHaveBeenCalledTimes(1);

    app.start();
    frame(300_000);
    expect(mock.step).toHaveBeenCalledTimes(1);
    expect(mock.render).toHaveBeenCalledTimes(3);
    frame(300_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(2);

    app.dispose();
    expect(pending.size).toBe(0);
    expect(mock.stopResizeHandling).toHaveBeenCalledTimes(2);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(() => app.start()).toThrow(/disposed/);
  });
});
