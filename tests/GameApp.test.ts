import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigStore, ConfigListener } from '../src/config/ConfigStore';
import type { GameConfig } from '../src/config/configSchema';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import type { PointerDragCallbacks } from '../src/input/PointerDragInput';
import type { KeyboardSteeringCallbacks } from '../src/input/KeyboardSteeringInput';
import type { UpgradeGateSimulationState } from '../src/simulation/SimulationState';

const mock = vi.hoisted(() => ({
  constructedWith: vi.fn(),
  step: vi.fn(),
  setRuntimeBalance: vi.fn(),
  getState: vi.fn((): any => ({
    player: { x: 2, z: 3 },
    squad: { count: 3, rocketCount: 0, rifleCounts: [3], rifleRemainder: 0 },
    enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
    streamRewards: [] as { id: number; tier: number; x: number; z: number;
      hitProgress: number; hitsRequired: number }[],
    gates: [] as UpgradeGateSimulationState[],
    pickups: [] as { id: number; x: number; zOffset: number; rewardAmount: number;
      rewardKind: 'rifle' | 'tier2Rifle' }[],
    projectiles: [{ id: 1, kind: 'rifle' as const, tier: 1, x: 2, z: 5 }],
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
  tierHudSet: vi.fn(),
  tierHudDispose: vi.fn(),
  pauseVisible: vi.fn(),
  pauseDispose: vi.fn(),
  hintDispose: vi.fn(),
  panelConstructedWith: vi.fn(),
  panelSetValues: vi.fn(),
  panelDispose: vi.fn(),
  inputConstructedWith: vi.fn(),
  inputStart: vi.fn(),
  inputStop: vi.fn(),
  inputDispose: vi.fn(),
  keyboardConstructedWith: vi.fn(),
  keyboardStart: vi.fn(),
  keyboardStop: vi.fn(),
  keyboardDispose: vi.fn(),
}));

vi.mock('../src/simulation/Simulation', () => ({
  Simulation: class {
    constructor(options: unknown) { mock.constructedWith(options); }
    step = mock.step;
    setRuntimeBalance = mock.setRuntimeBalance;
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

vi.mock('../src/ui/TierHud', () => ({
  TierHud: class {
    setTier = mock.tierHudSet;
    dispose = mock.tierHudDispose;
  },
}));

vi.mock('../src/ui/PauseOverlay', () => ({ PauseOverlay: class {
  setVisible = mock.pauseVisible;
  dispose = mock.pauseDispose;
} }));
vi.mock('../src/ui/ControlHint', () => ({ ControlHint: class {
  dispose = mock.hintDispose;
} }));
vi.mock('../src/ui/TuningPanel', () => ({ TuningPanel: class {
  constructor(_viewport: HTMLElement, defaults: unknown, onChange: unknown) {
    mock.panelConstructedWith(defaults, onChange);
  }
  setValues = mock.panelSetValues;
  dispose = mock.panelDispose;
} }));

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
const combatTuning = { defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  normalEnemyRadius: 0.3, bossRadius: 2,
  rifle: { fireRate: 7, projectileSpeed: 28, range: 18 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } };

function createConfigStore(startSquad = 3, formationSpacing = 0.45) {
  let config = {
    player: { startSquad, startRocketCount: 0, formationSpacing, memberRadius: 0.22, moveSpeed: 5, forwardSpeed: 3 },
    track: { halfWidth: 2.5, defenseLineOffset: 1.5 },
    tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300,
      enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 },
    bosses: { basic: { visualScale: 7, radius: 2 } },
    weapon: { rifle: { fireRate: 7, projectileSpeed: 28, range: 18 },
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
    changeRifle: (changes: Partial<GameConfig['weapon']['rifle']>) => {
      config = { ...config, weapon: { ...config.weapon, rifle: { ...config.weapon.rifle, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    changeRocket: (changes: Partial<GameConfig['weapon']['rocket']>) => {
      config = { ...config, weapon: { ...config.weapon, rocket: { ...config.weapon.rocket, ...changes } } };
      for (const listener of listeners) listener(config);
    },
    changeTiers: (changes: Partial<GameConfig['tiers']>) => {
      config = { ...config, tiers: { ...config.tiers, ...changes } };
      for (const listener of listeners) listener(config);
    },
    listenerCount: () => listeners.size,
  };
}

function createRaf() {
  const windowTarget = new EventTarget();
  vi.stubGlobal('window', windowTarget);
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
    key: (key: string, repeat = false) => {
      const event = new Event('keydown');
      Object.defineProperties(event, { key: { value: key }, repeat: { value: repeat } });
      windowTarget.dispatchEvent(event);
    },
    mouseMove: () => windowTarget.dispatchEvent(new Event('mousemove')),
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
    const defaults = mock.panelConstructedWith.mock.calls[0][0];
    const tune = mock.panelConstructedWith.mock.calls[0][1] as (values: typeof defaults) => void;
    tune({ ...defaults, fireRate: 4 });
    config.changeRocket({ damage: 25, blastRadius: 2 });
    config.changePlayer({ memberRadius: 0.3 });
    config.changeTiers({ tier1Power: 99, normalEnemyRadius: 0.5 });
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toEqual({ moveSpeed: 5, forwardSpeed: 3,
      trackHalfWidth: 2.5, defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.3,
      normalEnemyRadius: 0.5, bossRadius: 2,
      rifle: { fireRate: 4, projectileSpeed: 28, range: 18 },
      rocket: { damage: 25, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 2 } });
    expect(mock.constructedWith).toHaveBeenCalledOnce();
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 3,
      startRocketCount: 0, rewardRowsPerReward: 8, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    app.dispose();
  });
  it('starts the simulation from config and sends plain live state to the renderer', () => {
    const raf = createRaf();
    const config = createConfigStore(5, 0.8);
    const app = new GameApp({} as HTMLElement, config.store, level);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 0, rewardRowsPerReward: 8, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    expect(config.listenerCount()).toBe(1);

    app.start();
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 0.8 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      boss: null,
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5 }],
    }, expect.any(Number));

    config.changePlayer({ startSquad: 9, formationSpacing: 1.2 });
    raf.frame(110);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 1.2 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      boss: null,
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5 }],
    }, expect.any(Number));
    expect(mock.constructedWith).toHaveBeenCalledTimes(1);
    app.dispose();
    expect(config.listenerCount()).toBe(0);
  });

  it('passes normal enemy tier and HP through plain render state for hit feedback', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [{ id: 673, tier: 2, x: 0.1, z: 81.6, hp: 300 },
        { id: 2524, tier: 3, x: 0, z: 240, hp: 3000 }],
      streamRewards: [{ id: 2, tier: 1, x: -0.8, z: 30, hitProgress: 3, hitsRequired: 10 }],
      gates: [], pickups: [], projectiles: [] });
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0].enemies).toEqual([
      { id: 673, tier: 2, x: 0.1, z: 81.6, hp: 300 },
      { id: 2524, tier: 3, x: 0, z: 240, hp: 3000 },
    ]);
    expect(mock.render.mock.lastCall![0].streamRewards).toEqual([
      { id: 2, tier: 1, x: -0.8, z: 30, hitProgress: 3, hitsRequired: 10 },
    ]);
    app.dispose();
  });

  it('passes the active Boss as plain render data with authored visual scale', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    const state = mock.getState();
    const bossState = { ...state,
      boss: { id: 6441, tier: 1, x: 0, z: 576, hp: 2997, maxHp: 3000 } };
    mock.getState.mockReturnValueOnce(bossState);
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0].boss).toEqual({
      id: 6441, tier: 1, x: 0, z: 576, hp: 2997, maxHp: 3000, visualScale: 7,
    });
    app.dispose();
  });

  it('passes mixed squad roles and rocket projectile kind through the render boundary', () => {
    const raf = createRaf();
    const config = createConfigStore(2);
    config.changePlayer({ startRocketCount: 1 });
    const app = new GameApp({} as HTMLElement, config.store, level);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 2,
      startRocketCount: 1, rewardRowsPerReward: 8, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [{ id: 4, kind: 'rocket', tier: 0, x: 0.225, z: 3 }] });
    app.start();
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({ player: { x: 0, z: 0 },
      squad: { count: 2, rocketCount: 1, rifleCounts: [1], formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [],
      projectiles: [{ id: 4, kind: 'rocket', tier: 0, x: 0.225, z: 3 }] }, expect.any(Number));
    app.dispose();
  });

  it('passes active gate hit progress and reward as plain render data', () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 3 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
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
      squad: { count: 2, rocketCount: 0, rifleCounts: [1, 1], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [],
      pickups: [{ id: 7, x: 2.7, zOffset: 4, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'rifle', tier: 2, x: 0, z: 6 }] });
    app.start();
    raf.frame(100);
    expect(mock.render.mock.lastCall![0]).toMatchObject({
      squad: { count: 2, rocketCount: 0, rifleCounts: [1, 1] },
      pickups: [{ id: 7, x: 2.7, z: 7, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'rifle', tier: 2, x: 0, z: 6 }],
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
    expect(mock.keyboardStop).toHaveBeenCalledTimes(1);

    config.changePlayer({ formationSpacing: 0.9 });
    app.start();
    raf.frame(300_000);
    expect(mock.step).toHaveBeenCalledTimes(1);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 0.9 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      boss: null,
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5 }],
    }, expect.any(Number));
    raf.frame(300_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(2);

    app.dispose();
    expect(raf.pending.size).toBe(0);
    expect(mock.stopResizeHandling).toHaveBeenCalledTimes(2);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(mock.inputStart).toHaveBeenCalledTimes(2);
    expect(mock.inputStop).toHaveBeenCalledTimes(2);
    expect(mock.inputDispose).toHaveBeenCalledTimes(1);
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

    const defaults = mock.panelConstructedWith.mock.calls[0][0];
    const tune = mock.panelConstructedWith.mock.calls[0][1] as (values: typeof defaults) => void;
    tune({ ...defaults, moveSpeed: 8, forwardSpeed: 1.5 });
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

  it('does not steer from ordinary mouse movement', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    app.start();
    raf.frame(100);
    raf.mouseMove();
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    app.dispose();
  });

  it('pauses on P or Escape, freezes presentation time, clears steering, and resumes without catch-up', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    const keyboard = mock.keyboardConstructedWith.mock.calls[0][0] as KeyboardSteeringCallbacks;
    app.start();
    raf.frame(100);
    keyboard.onAxisChange(1);
    raf.frame(100 + 1000 / 60);
    const stepCount = mock.step.mock.calls.length;
    const presentationTime = mock.render.mock.lastCall![1];
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(mock.keyboardStop).toHaveBeenCalledOnce();
    expect(mock.inputStop).toHaveBeenCalledOnce();
    raf.key('p', true);
    raf.frame(100_000);
    raf.frame(101_000);
    expect(mock.step).toHaveBeenCalledTimes(stepCount);
    expect(mock.render.mock.lastCall![1]).toBe(presentationTime);
    raf.key('Escape');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    raf.frame(200_000);
    expect(mock.step).toHaveBeenCalledTimes(stepCount);
    raf.frame(200_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(stepCount + 1);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    expect(mock.render.mock.lastCall![1]).toBeGreaterThan(presentationTime);
    app.dispose();
  });

  it('applies eight runtime values immediately and retains them for Retry', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    const defaults = mock.panelConstructedWith.mock.calls[0][0];
    const tune = mock.panelConstructedWith.mock.calls[0][1] as (values: typeof defaults) => void;
    const edited = { ...defaults, bulletSpeed: 52, bulletRange: 65,
      rewardRowsPerReward: 3, enemyHigherTierPowerMultiplier: 12,
      rifleHigherTierPowerMultiplier: 8, fireRate: 10, moveSpeed: 9, forwardSpeed: 1.2 };
    tune(edited);
    expect(mock.setRuntimeBalance).toHaveBeenLastCalledWith({ rewardRowsPerReward: 3,
      enemyHigherTierPowerMultiplier: 12, rifleHigherTierPowerMultiplier: 8 });
    app.start();
    raf.frame(100);
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 9, forwardSpeed: 1.2,
      rifle: { fireRate: 10, projectileSpeed: 52, range: 65 } });
    raf.key('p');
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(mock.constructedWith).toHaveBeenLastCalledWith(expect.objectContaining({
      rewardRowsPerReward: 3, tiers: expect.objectContaining({
        enemyHigherTierPowerMultiplier: 12, rifleHigherTierPowerMultiplier: 8 }),
    }));
    raf.frame(100_000);
    raf.frame(100_000 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 9, forwardSpeed: 1.2 });
    tune(defaults);
    expect(mock.setRuntimeBalance).toHaveBeenLastCalledWith({ rewardRowsPerReward: 8,
      enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10 });
    raf.frame(100_000 + 2 * 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 5, forwardSpeed: 3,
      rifle: { fireRate: 7, projectileSpeed: 28, range: 18 } });
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
      player: { x: 2, z: 3 }, squad: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 }, enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    raf.frame(116);
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(true);
    expect(raf.pending.size).toBe(1);

    config.changePlayer({ startSquad: 5, startRocketCount: 1 });
    config.changeTiers({ tier1Power: 4 });
    mock.getState.mockReturnValueOnce({
      player: { x: 0, z: 0 }, squad: { count: 5, rocketCount: 1, rifleCounts: [4], rifleRemainder: 0 }, enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    const onRetry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    onRetry();
    expect(mock.constructedWith).toHaveBeenLastCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 1, rewardRowsPerReward: 8, tiers: { mergeCount: 10, tier1Power: 4,
        tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
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
      player: { x: 0, z: 0 }, squad: { count, rocketCount: 0,
        rifleCounts: tier2RifleCount ? [count - tier2RifleCount, tier2RifleCount]
          : count ? [count] : [], rifleRemainder: 0 },
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

  it('uses the player row for the enemy HUD and resets it on Retry', () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level);
    const frameState = (row: number) => ({ ...mock.getState(),
      player: { x: 0, z: level.enemyStream!.startZ + row * level.enemyStream!.spacing } });
    app.start();
    mock.getState.mockReturnValueOnce(frameState(47));
    raf.frame(100);
    expect(mock.tierHudSet).toHaveBeenLastCalledWith(1);
    mock.getState.mockReturnValueOnce(frameState(48));
    raf.frame(120);
    expect(mock.tierHudSet).toHaveBeenLastCalledWith(2);
    mock.getState.mockReturnValueOnce(frameState(240));
    raf.frame(140);
    expect(mock.tierHudSet).toHaveBeenLastCalledWith(3);
    const onRetry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    onRetry();
    expect(mock.tierHudSet).toHaveBeenLastCalledWith(1);
    app.dispose();
    expect(mock.tierHudDispose).toHaveBeenCalledOnce();
  });
});
