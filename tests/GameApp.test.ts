import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigStore, ConfigListener } from '../src/config/ConfigStore';
import type { GameConfig } from '../src/config/configSchema';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import type { PointerDragCallbacks } from '../src/input/PointerDragInput';
import type { MouseSteeringCallbacks } from '../src/input/MouseSteeringInput';
import type { KeyboardSteeringCallbacks } from '../src/input/KeyboardSteeringInput';
import type { UpgradeGateSimulationState } from '../src/simulation/SimulationState';

const mock = vi.hoisted(() => ({
  constructedWith: vi.fn(),
  step: vi.fn(),
  getState: vi.fn(() => ({
    player: { x: 2, z: 3 },
    squad: { count: 3, rocketCount: 0, tier2RifleCount: 0 },
    enemies: [{ id: 1, type: 'grunt' as 'grunt' | 'brute' | 'tier3', x: -0.4, z: 12, hp: 10 }],
    streamRewards: [] as { id: number; tier: 1 | 2; x: number; z: number;
      hitProgress: number; hitsRequired: number }[],
    gates: [] as UpgradeGateSimulationState[],
    pickups: [] as { id: number; x: number; zOffset: number; rewardAmount: number;
      rewardKind: 'rifle' | 'tier2Rifle' }[],
    projectiles: [{ id: 1, kind: 'rifle' as 'rifle' | 'heavyRifle' | 'rocket', x: 2, z: 5 }],
  })),
  render: vi.fn(),
  resetFeedback: vi.fn(),
  startResizeHandling: vi.fn(),
  stopResizeHandling: vi.fn(),
  dispose: vi.fn(),
  overlayConstructedWith: vi.fn(),
  overlayVisible: vi.fn(),
  overlayDispose: vi.fn(),
  damageFlash: vi.fn(),
  damageReset: vi.fn(),
  damageDispose: vi.fn(),
  inputConstructedWith: vi.fn(),
  inputStart: vi.fn(),
  inputStop: vi.fn(),
  inputDispose: vi.fn(),
  mouseConstructedWith: vi.fn(),
  mouseStart: vi.fn(),
  mouseStop: vi.fn(),
  mouseDispose: vi.fn(),
  keyboardConstructedWith: vi.fn(),
  keyboardStart: vi.fn(),
  keyboardStop: vi.fn(),
  keyboardDispose: vi.fn(),
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
    resetFeedback = mock.resetFeedback;
    startResizeHandling = mock.startResizeHandling;
    stopResizeHandling = mock.stopResizeHandling;
    dispose = mock.dispose;
  },
}));

vi.mock('../src/ui/DamageFlashOverlay', () => ({
  DamageFlashOverlay: class {
    flash = mock.damageFlash;
    reset = mock.damageReset;
    dispose = mock.damageDispose;
  },
}));

vi.mock('../src/ui/GameOverOverlay', () => ({
  GameOverOverlay: class {
    constructor(_viewport: HTMLElement, onRetry: () => void) { mock.overlayConstructedWith(onRetry); }
    setVisible = mock.overlayVisible;
    dispose = mock.overlayDispose;
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

vi.mock('../src/input/MouseSteeringInput', () => ({
  MouseSteeringInput: class {
    constructor(_viewport: HTMLElement, callbacks: MouseSteeringCallbacks) {
      mock.mouseConstructedWith(callbacks);
    }
    start = mock.mouseStart;
    stop = mock.mouseStop;
    dispose = mock.mouseDispose;
  },
}));

vi.mock('../src/input/KeyboardSteeringInput', () => ({
  KeyboardSteeringInput: class {
    constructor(_eventTarget: Window, callbacks: KeyboardSteeringCallbacks) {
      mock.keyboardConstructedWith(callbacks);
    }
    start = mock.keyboardStart;
    stop = mock.keyboardStop;
    dispose = mock.keyboardDispose;
  },
}));

import { GameApp } from '../src/app/GameApp';

const level = LevelDefinitionSchema.parse(authoredLevel);
const combatTuning = { defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3,
  bruteRadius: 0.3, tier3Radius: 0.3,
  rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 18 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } };

function createConfigStore(startSquad = 3, formationSpacing = 0.45) {
  let config = {
    player: { startSquad, startRocketCount: 0, formationSpacing, memberRadius: 0.22, moveSpeed: 5, forwardSpeed: 3 },
    track: { halfWidth: 2.5, defenseLineOffset: 1.5 },
    controls: { mouseSensitivity: 1 },
    enemies: { grunt: { hp: 10, radius: 0.3 },
      brute: { hp: 300, radius: 0.3 }, tier3: { hp: 3000, radius: 0.3 } },
    weapon: { rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 18 },
      rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } },
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
    changeControls: (changes: Partial<GameConfig['controls']>) => {
      config = { ...config, controls: { ...config.controls, ...changes } };
      for (const listener of listeners) listener(config);
    },
    changeRifle: (changes: Partial<GameConfig['weapon']['rifle']>) => {
      config = { ...config, weapon: { ...config.weapon, rifle: { ...config.weapon.rifle, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    changeRocket: (changes: Partial<GameConfig['weapon']['rocket']>) => {
      config = { ...config, weapon: { ...config.weapon, rocket: { ...config.weapon.rocket, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    changeGrunt: (changes: Partial<GameConfig['enemies']['grunt']>) => {
      config = { ...config, enemies: { ...config.enemies, grunt: { ...config.enemies.grunt, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    changeBrute: (changes: Partial<GameConfig['enemies']['brute']>) => {
      config = { ...config, enemies: { ...config.enemies, brute: { ...config.enemies.brute, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    listenerCount: () => listeners.size,
  };
}

function createRaf() {
  vi.stubGlobal('window', {});
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
  it('passes live rifle/radius tuning without reconstructing or healing the simulation', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    app.start();
    raf.frame(100);
    config.changeRifle({ damage: 9, fireRate: 4 });
    config.changeRocket({ damage: 25, blastRadius: 2 });
    config.changePlayer({ memberRadius: 0.3 });
    config.changeGrunt({ hp: 99, radius: 0.5 });
    config.changeBrute({ hp: 110, radius: 0.7 });
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toEqual({ moveSpeed: 5, forwardSpeed: 3,
      trackHalfWidth: 2.5, defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.3, gruntRadius: 0.5,
      bruteRadius: 0.7, tier3Radius: 0.3,
      rifle: { damage: 9, fireRate: 4, projectileSpeed: 28, range: 18 },
      rocket: { damage: 25, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 2 } });
    expect(mock.constructedWith).toHaveBeenCalledOnce();
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 3,
      startRocketCount: 0, gruntHp: 10, bruteHp: 300, tier3Hp: 3000 });
    app.dispose();
  });
  it('starts the simulation from config and sends plain live state to the renderer', () => {
    const raf = createRaf();
    const config = createConfigStore(5, 0.8);
    const app = new GameApp({} as HTMLElement, config.store, level);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 0, gruntHp: 10, bruteHp: 300, tier3Hp: 3000 });
    expect(config.listenerCount()).toBe(1);

    app.start();
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, tier2RifleCount: 0, formationSpacing: 0.8 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, type: 'grunt', x: -0.4, z: 12, hp: 10 }],
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', x: 2, z: 5 }],
    });

    config.changePlayer({ startSquad: 9, formationSpacing: 1.2 });
    raf.frame(110);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, tier2RifleCount: 0, formationSpacing: 1.2 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, type: 'grunt', x: -0.4, z: 12, hp: 10 }],
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', x: 2, z: 5 }],
    });
    expect(mock.constructedWith).toHaveBeenCalledTimes(1);
    app.dispose();
    expect(config.listenerCount()).toBe(0);
  });

  it('passes normal enemy tier and HP through plain render state for hit feedback', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0, tier2RifleCount: 0 },
      enemies: [{ id: 673, type: 'brute', x: 0.1, z: 81.6, hp: 300 },
        { id: 2524, type: 'tier3', x: 0, z: 240, hp: 3000 }],
      streamRewards: [{ id: 2, tier: 1, x: -0.8, z: 30, hitProgress: 3, hitsRequired: 10 }],
      gates: [], pickups: [], projectiles: [] });
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0].enemies).toEqual([
      { id: 673, type: 'brute', x: 0.1, z: 81.6, hp: 300 },
      { id: 2524, type: 'tier3', x: 0, z: 240, hp: 3000 },
    ]);
    expect(mock.render.mock.lastCall![0].streamRewards).toEqual([
      { id: 2, tier: 1, x: -0.8, z: 30, hitProgress: 3, hitsRequired: 10 },
    ]);
    app.dispose();
  });

  it('passes mixed squad roles and rocket projectile kind through the render boundary', () => {
    const raf = createRaf();
    const config = createConfigStore(2);
    config.changePlayer({ startRocketCount: 1 });
    const app = new GameApp({} as HTMLElement, config.store, level);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 2,
      startRocketCount: 1, gruntHp: 10, bruteHp: 300, tier3Hp: 3000 });
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, tier2RifleCount: 0 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [{ id: 4, kind: 'rocket', x: 0.225, z: 3 }] });
    app.start();
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({ player: { x: 0, z: 0 },
      squad: { count: 2, rocketCount: 1, tier2RifleCount: 0, formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], streamRewards: [], gates: [], pickups: [],
      projectiles: [{ id: 4, kind: 'rocket', x: 0.225, z: 3 }] });
    app.dispose();
  });

  it('passes active gate hit progress and reward as plain render data', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 3 }, squad: { count: 1, rocketCount: 0, tier2RifleCount: 0 },
      enemies: [], streamRewards: [], projectiles: [], pickups: [{ id: 4, x: -2.7, zOffset: 2, rewardAmount: 1,
        rewardKind: 'rifle' }], gates: [{ id: 'rifle-generator',
        x: -2.7, zOffset: 8, width: 0.9, hitProgress: 7,
        reward: { mode: 'hitPickup', kind: 'rifle', amount: 1, hitsRequired: 10, dropSpeed: 4 } }] });
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0]).toMatchObject({ gates: [{ id: 'rifle-generator',
      x: -2.7, z: 11, width: 0.9, hitProgress: 7, hitsRequired: 10,
      rewardKind: 'rifle', rewardAmount: 1 }],
      pickups: [{ id: 4, x: -2.7, z: 5, rewardAmount: 1, rewardKind: 'rifle' }] });
    app.dispose();
  });

  it('passes Tier-2 squad, heavy shot, and pickup identity through the render boundary', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 3 },
      squad: { count: 2, rocketCount: 0, tier2RifleCount: 1 },
      enemies: [], streamRewards: [], gates: [],
      pickups: [{ id: 7, x: 2.7, zOffset: 4, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'heavyRifle', x: 0, z: 6 }] });
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0]).toMatchObject({
      squad: { count: 2, rocketCount: 0, tier2RifleCount: 1 },
      pickups: [{ id: 7, x: 2.7, z: 7, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'heavyRifle', x: 0, z: 6 }],
    });
    app.dispose();
  });

  it('uses one RAF loop and keeps its config listener across stop/start without catch-up', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    app.start();
    app.start();
    expect(raf.pending.size).toBe(1);
    expect(mock.startResizeHandling).toHaveBeenCalledTimes(1);
    expect(mock.inputStart).toHaveBeenCalledTimes(1);
    expect(mock.mouseStart).toHaveBeenCalledTimes(1);
    expect(mock.keyboardStart).toHaveBeenCalledTimes(1);

    raf.frame(100);
    expect(mock.step).not.toHaveBeenCalled();
    expect(mock.render).toHaveBeenCalledTimes(1);
    expect(raf.pending.size).toBe(1);

    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledExactlyOnceWith(
      1 / 60,
      { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );
    expect(mock.render).toHaveBeenCalledTimes(2);
    app.stop();
    expect(raf.pending.size).toBe(0);
    expect(raf.cancel).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(1);
    expect(mock.inputStop).toHaveBeenCalledTimes(1);
    expect(mock.mouseStop).toHaveBeenCalledTimes(1);
    expect(mock.keyboardStop).toHaveBeenCalledTimes(1);

    config.changePlayer({ formationSpacing: 0.9 });
    app.start();
    raf.frame(300_000);
    expect(mock.step).toHaveBeenCalledTimes(1);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, tier2RifleCount: 0, formationSpacing: 0.9 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, type: 'grunt', x: -0.4, z: 12, hp: 10 }],
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', x: 2, z: 5 }],
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
    expect(mock.mouseStart).toHaveBeenCalledTimes(2);
    expect(mock.mouseStop).toHaveBeenCalledTimes(2);
    expect(mock.mouseDispose).toHaveBeenCalledTimes(1);
    expect(mock.keyboardStart).toHaveBeenCalledTimes(2);
    expect(mock.keyboardStop).toHaveBeenCalledTimes(2);
    expect(mock.keyboardDispose).toHaveBeenCalledTimes(1);
    expect(mock.overlayDispose).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(0);
    expect(() => app.start()).toThrow(/disposed/);
  });

  it('maps relative drag from current player X and uses live movement tuning per tick', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    const callbacks = mock.inputConstructedWith.mock.calls[0][0] as PointerDragCallbacks;
    app.start();
    raf.frame(100);

    callbacks.onDragStart();
    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );

    callbacks.onDrag(0.25);
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 3.25 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );

    config.changePlayer({ moveSpeed: 8, forwardSpeed: 1.5 });
    config.changeTrack({ halfWidth: 3.5, defenseLineOffset: 2 });
    raf.frame(100 + 3 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 3.25 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5, ...combatTuning, defenseLineOffset: 2 },
    );

    callbacks.onDrag(0.5);
    raf.frame(100 + 4 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 5.5 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5, ...combatTuning, defenseLineOffset: 2 },
    );
    raf.frame(100 + 5 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 5.5 },
      { moveSpeed: 8, forwardSpeed: 1.5, trackHalfWidth: 3.5, ...combatTuning, defenseLineOffset: 2 },
    );
    app.dispose();
  });

  it('accumulates mouse deltas with live sensitivity and track width', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    const mouse = mock.mouseConstructedWith.mock.calls[0][0] as MouseSteeringCallbacks;
    const keyboard = mock.keyboardConstructedWith.mock.calls[0][0] as KeyboardSteeringCallbacks;
    app.start();
    raf.frame(100);

    mouse.onMove(0.1);
    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 2.5 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );

    config.changeControls({ mouseSensitivity: 2 });
    mouse.onMove(-0.05);
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60,
      { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );

    config.changeTrack({ halfWidth: 3.5 });
    mouse.onMove(-0.05);
    raf.frame(100 + 3 * 1000 / 60);
    const [dtSeconds, input, tuning] = mock.step.mock.lastCall!;
    expect(dtSeconds).toBe(1 / 60);
    expect((input as { targetX: number }).targetX).toBeCloseTo(1.3);
    expect(tuning).toEqual({ moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.5, ...combatTuning });

    keyboard.onAxisChange(1);
    mouse.onMove(-0.05);
    raf.frame(100 + 4 * 1000 / 60);
    expect((mock.step.mock.lastCall![1] as { targetX: number }).targetX).toBeCloseTo(1.3);
    app.dispose();
  });

  it('maps keyboard edges and neutral release to the current player position', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    const keyboard = mock.keyboardConstructedWith.mock.calls[0][0] as KeyboardSteeringCallbacks;
    const drag = mock.inputConstructedWith.mock.calls[0][0] as PointerDragCallbacks;
    app.start();
    raf.frame(100);

    keyboard.onAxisChange(-1);
    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: -2.5 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 2.5, ...combatTuning },
    );
    config.changeTrack({ halfWidth: 3.5 });
    keyboard.onAxisChange(1);
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 3.5 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.5, ...combatTuning },
    );
    keyboard.onAxisChange(0);
    raf.frame(100 + 3 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.5, ...combatTuning },
    );

    drag.onDragStart();
    drag.onDrag(0.25);
    raf.frame(100 + 4 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 3.75 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.5, ...combatTuning },
    );
    app.dispose();
  });

  it('derives Game Over from zero squad and retries with current config in the same RAF loop', () => {
    const raf = createRaf();
    const config = createConfigStore(3);
    const app = new GameApp({} as HTMLElement, config.store, level);
    app.start();
    raf.frame(100);
    raf.frame(108);
    expect(mock.step).not.toHaveBeenCalled();
    mock.getState.mockReturnValueOnce({
      player: { x: 2, z: 3 }, squad: { count: 0, rocketCount: 0, tier2RifleCount: 0 }, enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    raf.frame(116);
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(true);
    expect(raf.pending.size).toBe(1);

    config.changePlayer({ startSquad: 5, startRocketCount: 1 });
    config.changeGrunt({ hp: 4 });
    mock.getState.mockReturnValueOnce({
      player: { x: 0, z: 0 }, squad: { count: 5, rocketCount: 1, tier2RifleCount: 0 }, enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    const onRetry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    onRetry();
    expect(mock.constructedWith).toHaveBeenLastCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 1, gruntHp: 4, bruteHp: 300, tier3Hp: 3000 });
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(false);
    expect(raf.pending.size).toBe(1);
    const priorSteps = mock.step.mock.calls.length;
    raf.frame(124);
    expect(mock.step).toHaveBeenCalledTimes(priorSteps);
    raf.frame(124 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(priorSteps + 1);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 0 });
    app.dispose();
  });

  it('flashes on Tier-2 demotion and fatal loss, ignores growth, and resets on Retry', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    const stateWith = (count: number, tier2RifleCount: number) => ({
      player: { x: 0, z: 0 }, squad: { count, rocketCount: 0, tier2RifleCount },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    app.start();
    mock.getState.mockReturnValueOnce(stateWith(1, 1));
    raf.frame(100);
    expect(mock.damageFlash).not.toHaveBeenCalled();
    mock.getState.mockReturnValueOnce(stateWith(9, 0));
    raf.frame(100 + 1000 / 60);
    expect(mock.damageFlash).toHaveBeenLastCalledWith(false);
    mock.getState.mockReturnValueOnce(stateWith(10, 0));
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.damageFlash).toHaveBeenCalledTimes(1);
    mock.getState.mockReturnValueOnce(stateWith(0, 0));
    raf.frame(100 + 3 * 1000 / 60);
    expect(mock.damageFlash).toHaveBeenLastCalledWith(true);
    const onRetry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    onRetry();
    expect(mock.damageReset).toHaveBeenCalledOnce();
    expect(mock.resetFeedback).toHaveBeenCalledOnce();
    raf.frame(100 + 4 * 1000 / 60);
    expect(mock.damageFlash).toHaveBeenCalledTimes(2);
    app.dispose();
    expect(mock.damageDispose).toHaveBeenCalledOnce();
  });
});
