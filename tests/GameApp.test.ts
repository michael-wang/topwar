import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigStore, ConfigListener } from '../src/config/ConfigStore';
import type { GameConfig } from '../src/config/configSchema';
import type { PointerDragCallbacks } from '../src/input/PointerDragInput';

const mock = vi.hoisted(() => ({
  constructedWith: vi.fn(),
  step: vi.fn(),
  getState: vi.fn(() => ({ player: { x: 2, z: 3 }, squad: { count: 3 } })),
  render: vi.fn(),
  startResizeHandling: vi.fn(),
  stopResizeHandling: vi.fn(),
  dispose: vi.fn(),
  inputConstructedWith: vi.fn(),
  inputStart: vi.fn(),
  inputStop: vi.fn(),
  inputDispose: vi.fn(),
}));

vi.mock('../src/simulation/Simulation', () => ({
  Simulation: class {
    constructor(options: unknown) { mock.constructedWith(options); }
    step = mock.step;
    getState = mock.getState;
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

vi.mock('../src/input/PointerDragInput', () => ({
  PointerDragInput: class {
    constructor(_viewport: HTMLElement, callbacks: PointerDragCallbacks) {
      mock.inputConstructedWith(callbacks);
    }
    start = mock.inputStart;
    stop = mock.inputStop;
    dispose = mock.inputDispose;
  },
}));

import { GameApp } from '../src/app/GameApp';

function createConfigStore(startSquad = 3, formationSpacing = 0.45) {
  let config = {
    player: { startSquad, formationSpacing, moveSpeed: 5, forwardSpeed: 3 },
    track: { halfWidth: 2.5 },
  } as GameConfig;
  const listeners = new Set<ConfigListener>();
  return {
    store: {
      getConfig: () => config,
      subscribe: (listener: ConfigListener) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    } as ConfigStore,
    changePlayer: (changes: Partial<GameConfig['player']>) => {
      config = { ...config, player: { ...config.player, ...changes } };
      for (const listener of listeners) listener(config);
    },
    changeTrack: (changes: Partial<GameConfig['track']>) => {
      config = { ...config, track: { ...config.track, ...changes } };
      for (const listener of listeners) listener(config);
    },
    listenerCount: () => listeners.size,
  };
}

function createRaf() {
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
  return {
    pending,
    cancel,
    frame: (timestampMs: number) => {
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback(timestampMs);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const method of Object.values(mock)) method.mockClear();
});

describe('GameApp config and frame lifecycle', () => {
  it('starts the simulation from config and sends plain live state to the renderer', () => {
    const raf = createRaf();
    const config = createConfigStore(5, 0.8);
    const app = new GameApp({} as HTMLElement, config.store);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, levelId: 'prototype', startSquad: 5 });
    expect(config.listenerCount()).toBe(1);

    app.start();
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, formationSpacing: 0.8 },
      track: { halfWidth: 2.5 },
    });

    config.changePlayer({ startSquad: 9, formationSpacing: 1.2 });
    raf.frame(110);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, formationSpacing: 1.2 },
      track: { halfWidth: 2.5 },
    });
    expect(mock.constructedWith).toHaveBeenCalledTimes(1);
    app.dispose();
    expect(config.listenerCount()).toBe(0);
  });

  it('uses one RAF loop and keeps its config listener across stop/start without catch-up', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store);
    app.start();
    app.start();
    expect(raf.pending.size).toBe(1);
    expect(mock.startResizeHandling).toHaveBeenCalledTimes(1);
    expect(mock.inputStart).toHaveBeenCalledTimes(1);

    raf.frame(100);
    expect(mock.step).not.toHaveBeenCalled();
    expect(mock.render).toHaveBeenCalledTimes(1);
    expect(raf.pending.size).toBe(1);

    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledExactlyOnceWith(
      1 / 60,
      { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5 },
    );
    expect(mock.render).toHaveBeenCalledTimes(2);
    app.stop();
    expect(raf.pending.size).toBe(0);
    expect(raf.cancel).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(1);
    expect(mock.inputStop).toHaveBeenCalledTimes(1);

    config.changePlayer({ formationSpacing: 0.9 });
    app.start();
    raf.frame(300_000);
    expect(mock.step).toHaveBeenCalledTimes(1);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, formationSpacing: 0.9 },
      track: { halfWidth: 2.5 },
    });
    raf.frame(300_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(2);

    app.dispose();
    expect(raf.pending.size).toBe(0);
    expect(mock.stopResizeHandling).toHaveBeenCalledTimes(2);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(mock.inputStart).toHaveBeenCalledTimes(2);
    expect(mock.inputStop).toHaveBeenCalledTimes(2);
    expect(mock.inputDispose).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(0);
    expect(() => app.start()).toThrow(/disposed/);
  });

  it('maps relative drag from current player X and uses live movement tuning per tick', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store);
    const callbacks = mock.inputConstructedWith.mock.calls[0][0] as PointerDragCallbacks;
    app.start();
    raf.frame(100);

    callbacks.onDragStart();
    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5 },
    );

    callbacks.onDrag(0.25);
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 3.25 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5 },
    );

    config.changePlayer({ moveSpeed: 8, forwardSpeed: 1.5 });
    config.changeTrack({ halfWidth: 3.5 });
    raf.frame(100 + 3 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 3.25 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5 },
    );

    callbacks.onDrag(0.5);
    raf.frame(100 + 4 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 5.5 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5 },
    );
    raf.frame(100 + 5 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 5.5 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5 },
    );
    app.dispose();
  });
});
