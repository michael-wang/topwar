import gameData from '../public/game-data/game.json';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';
import type { CharacterAssets } from '../src/rendering/CharacterAssets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigStore, ConfigListener } from '../src/config/ConfigStore';
import type { GameConfig } from '../src/config/configSchema';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import type { PointerDragCallbacks } from '../src/input/PointerDragInput';
import type { KeyboardSteeringCallbacks } from '../src/input/KeyboardSteeringInput';
import type { UpgradeGateSimulationState } from '../src/simulation/SimulationState';
import { GameAudio } from '../src/audio/GameAudio';
import { PerfDiagnostics } from '../src/app/PerfDiagnostics';
vi.mock('../src/ui/GameStartOverlay', () => ({ GameStartOverlay: class {
  show() {} setActivating() {} finish() {} dispose() {}
} }));
vi.mock('../src/ui/EnemyVfxLabControls', () => ({ EnemyVfxLabControls: class {
  constructor(_viewport: unknown, select: unknown, canUseShortcuts: unknown) { mock.labConstructed(select, canUseShortcuts); }
  setSelected() {} dispose() {}
} }));
vi.mock('../src/app/EnemyVfxLab', () => ({ createEnemyVfxLab: (...args: unknown[]) => {
  mock.labFixture(...args); return { getState: mock.getState };
} }));

const mock = vi.hoisted(() => ({
  constructedWith: vi.fn(),
  labConstructed: vi.fn(),
  labFixture: vi.fn(),
  grenadeConstructed: vi.fn(),
  step: vi.fn(),
  stepLane: vi.fn(),
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
    projectiles: [{ id: 1, kind: 'rifle' as const, tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
  })),
  consumePresentationEvents: vi.fn((): any[] => []),
  render: vi.fn(),
  present: vi.fn(),
  presentLevelUp: vi.fn(),
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
  xpConstructed: vi.fn(),
  laneConstructed: vi.fn(),
  hudConstructedWith: vi.fn(),
  hudSetPaused: vi.fn(),
  hudDispose: vi.fn(),
  panelConstructedWith: vi.fn(),
  panelAnchor: vi.fn(),
  panelSetValues: vi.fn(),
  panelToggle: vi.fn(),
  panelDispose: vi.fn(),
  inputConstructedWith: vi.fn(),
  inputStart: vi.fn(),
  inputStop: vi.fn(),
  inputDispose: vi.fn(),
  keyboardConstructedWith: vi.fn(),
  keyboardStart: vi.fn(),
  keyboardStop: vi.fn(),
  keyboardDispose: vi.fn(),
  touchConstructedWith: vi.fn(),
  touchStart: vi.fn(),
  touchStop: vi.fn(),
  touchDispose: vi.fn(),
}));

vi.mock('../src/simulation/Simulation', () => ({
  Simulation: class {
    constructor(options: unknown) { mock.constructedWith(options); }
    step = mock.step;
    stepLane = mock.stepLane;
    setRuntimeBalance = mock.setRuntimeBalance;
    getState = mock.getState;
    getFrameState = mock.getState;
    consumePresentationEvents = mock.consumePresentationEvents;
    consumeGrenadeEvents = vi.fn(() => []);
  },
}));

vi.mock('../src/rendering/GameRenderer', () => ({
  GameRenderer: class {
    render = mock.render;
    present = mock.present;
    presentGrenade = vi.fn();
    presentLevelUp = mock.presentLevelUp;
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
vi.mock('../src/ui/LaneHud', () => ({ LaneHud: class {
  constructor() { mock.laneConstructed(); }
} }));
vi.mock('../src/ui/XpHud', () => ({ XpHud: class {
  constructor(viewport: HTMLElement) { mock.xpConstructed(viewport); }
  update = vi.fn(); reset = vi.fn(); presentLevelUp = vi.fn(); dispose = vi.fn();
} }));
vi.mock('../src/ui/GrenadeButton', () => ({ GrenadeButton: class {
  constructor(_viewport: unknown, activate: unknown) { mock.grenadeConstructed(activate); }
  update = vi.fn(); reset = vi.fn(); dispose = vi.fn();
} }));
vi.mock('../src/ui/HudActions', () => ({ HudActions: class {
  element = {} as HTMLElement;
  constructor(_viewport: HTMLElement, togglePaused: () => void) {
    mock.hudConstructedWith(togglePaused);
  }
  setPaused = mock.hudSetPaused;
  dispose = mock.hudDispose;
} }));
vi.mock('../src/ui/TuningPanel', () => ({ TuningPanel: class {
  constructor(_viewport: HTMLElement, defaults: unknown, onChange: unknown) {
    mock.panelAnchor(_viewport); mock.panelConstructedWith(defaults, onChange);
  }
  setValues = mock.panelSetValues;
  toggle = mock.panelToggle;
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
vi.mock('../src/input/TouchSteeringInput', () => ({
  TouchSteeringInput: class {
    constructor(_viewport: HTMLElement, onAxisChange: (axis: -1 | 0 | 1) => void) {
      mock.touchConstructedWith(onAxisChange);
    }
    start = mock.touchStart;
    stop = mock.touchStop;
    dispose = mock.touchDispose;
  },
}));

import { GameApp } from '../src/app/GameApp';

const level = LevelDefinitionSchema.parse(authoredLevel);
const combatTuning = { defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22,
  normalEnemyRadius: 0.3, bossRadius: 2,
  rifle: { fireRate: 7, projectileSpeed: 28, range: 18,
    tierHitRadiusStep: 0.45, maxHitRadiusBonus: 0.90 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 1.25 } };

function createConfigStore(startSquad = 3, formationSpacing = 0.45) {
  let config = {
    player: { startSquad, startRocketCount: 0, formationSpacing, memberRadius: 0.22, moveSpeed: 5, forwardSpeed: 3 },
    track: { halfWidth: 2.5, defenseLineOffset: 1.5 },
    tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300,
      enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 },
    bosses: { basic: { visualScale: 7, radius: 2 } },
    weapon: { rifle: { fireRate: 7, projectileSpeed: 28, range: 18,
      tierHitRadiusStep: 0.45, maxHitRadiusBonus: 0.90 },
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
  vi.spyOn(GameAudio.prototype, 'activate').mockResolvedValue('running');
  const windowTarget = new EventTarget();
  vi.stubGlobal('window', windowTarget);
  let nextSeed = 1;
  vi.stubGlobal('crypto', { getRandomValues: (values: Uint32Array) => {
    values[0] = nextSeed++;
    return values;
  } });
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
    key: (key: string, repeat = false, target?: object, code = key.toLowerCase() === 'q' ? 'KeyQ' : '') => {
      const event = new Event('keydown', { cancelable: true });
      Object.defineProperties(event, { key: { value: key }, code: { value: code }, repeat: { value: repeat } });
      if (target) Object.defineProperty(event, 'target', { value: target });
      windowTarget.dispatchEvent(event);
      return event.defaultPrevented;
    },
    mouseMove: () => windowTarget.dispatchEvent(new Event('mousemove')),
    frame: (timestampMs: number) => {
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback(timestampMs);
    },
  };
}

async function startGame(app: GameApp): Promise<void> {
  app.start();
  await (app as unknown as { beginGameplay(): Promise<void> }).beginGameplay();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const method of Object.values(mock)) method.mockClear();
});

describe('GameApp config and frame lifecycle', () => {
  it('creates the HUD only in perf mode and resets diagnostics on Retry', async () => {
    createRaf();
    const element = { className: '', textContent: '', setAttribute: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => element) });
    const viewport = { append: vi.fn(), classList: { remove: vi.fn() } } as unknown as HTMLElement;
    const normal = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    expect(viewport.append).not.toHaveBeenCalled();
    normal.dispose();
    const reset = vi.spyOn(PerfDiagnostics.prototype, 'reset');
    const measured = new GameApp(viewport, createConfigStore().store,
      level, {} as CharacterAssets, true);
    expect(viewport.append).toHaveBeenCalledWith(element);
    expect(mock.constructedWith.mock.lastCall?.[0]).toHaveProperty('collisionDiagnostics');
    const retry = mock.overlayConstructedWith.mock.lastCall?.[0] as () => void;
    retry();
    expect(reset).toHaveBeenCalledOnce();
    measured.dispose();
    expect(element.remove).toHaveBeenCalledOnce();
    reset.mockRestore();
  });
  it('advances independent environmental audio from presentation time', async () => {
    const raf = createRaf();
    const updateEnvironment = vi.spyOn(GameAudio.prototype, 'updateEnvironment');
    const app = new GameApp({} as HTMLElement, createConfigStore().store,
      level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    expect(updateEnvironment).toHaveBeenCalledWith(0);
    app.dispose();
    updateEnvironment.mockRestore();
  });
  it('observes Boss audio separately from normal enemy audio', async () => {
    const raf = createRaf();
    const observe = vi.spyOn(GameAudio.prototype, 'observe');
    const baseState = mock.getState();
    mock.getState.mockReturnValue({ ...baseState, boss: { id: 99, hp: 100, tier: 1,
      x: 0, z: 30, phase: 'approach' } });
    const app = new GameApp({} as HTMLElement, createConfigStore().store,
      level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    expect(observe).toHaveBeenCalled();
    expect(observe.mock.calls.at(-1)?.[2]).toEqual(baseState.enemies);
    expect(observe.mock.calls.at(-1)?.[4]).toMatchObject({ id: 99 });
    app.dispose();
    observe.mockRestore();
    mock.getState.mockReturnValue(baseState);
  });
  it('shows a runtime error and stops scheduling frames when rendering throws', async () => {
    const raf = createRaf();
    const notice = { className: '', textContent: '', setAttribute: vi.fn() };
    vi.stubGlobal('document', { createElement: () => notice });
    const viewport = { append: vi.fn(), classList: { remove: vi.fn() } } as unknown as HTMLElement;
    const originalError = new Error('render failure');
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.render.mockImplementationOnce(() => { throw originalError; });
    const app = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    expect(reported).toHaveBeenCalledWith('TopWar game loop stopped after an unexpected error', originalError);
    expect(raf.pending.size).toBe(0);
    expect(viewport.append).toHaveBeenCalledWith(notice);
    expect(notice.textContent).toMatch(/Reload to retry/);
    app.dispose();
    reported.mockRestore();
  });
  it('reports the original simulation exception instead of leaving a frozen frame', async () => {
    const raf = createRaf();
    vi.stubGlobal('document', { createElement: () => ({ setAttribute: vi.fn() }) });
    const viewport = { append: vi.fn(), classList: { remove: vi.fn() } } as unknown as HTMLElement;
    const originalError = new Error('simulation failure');
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    mock.step.mockImplementationOnce(() => { throw originalError; });
    raf.frame(100 + 1000 / 60);
    expect(reported).toHaveBeenCalledWith('TopWar game loop stopped after an unexpected error', originalError);
    expect(raf.pending.size).toBe(0);
    app.dispose();
    reported.mockRestore();
  });
  it('passes live rifle/radius tuning without reconstructing or healing the simulation', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    await startGame(app);
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
      rifle: { fireRate: 4, projectileSpeed: 28, range: 18,
        tierHitRadiusStep: 0.45, maxHitRadiusBonus: 0.90 },
      rocket: { damage: 25, fireRate: 0.6, projectileSpeed: 18, range: 40, blastRadius: 2 } });
    expect(mock.constructedWith).toHaveBeenCalledOnce();
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 3,
      startRocketCount: 0, rewardRowsPerReward: 7, bossHpScale: 3, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    app.dispose();
  });
  it('starts the simulation from config and sends plain live state to the renderer', async () => {
    const raf = createRaf();
    const config = createConfigStore(5, 0.8);
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 0, rewardRowsPerReward: 7, bossHpScale: 3, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    expect(config.listenerCount()).toBe(1);

    await startGame(app);
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
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
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
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
    }, expect.any(Number));
    expect(mock.constructedWith).toHaveBeenCalledTimes(1);
    app.dispose();
    expect(config.listenerCount()).toBe(0);
  });

  it('passes normal enemy tier and HP through plain render state for hit feedback', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [{ id: 673, tier: 2, x: 0.1, z: 81.6, hp: 300 },
        { id: 2524, tier: 3, x: 0, z: 240, hp: 3000 }],
      streamRewards: [{ id: 2, tier: 1, x: -0.8, z: 30, hitProgress: 3, hitsRequired: 10 }],
      gates: [], pickups: [], projectiles: [] });
    await startGame(app);
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

  it('passes the active Boss as plain render data with authored visual scale', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const state = mock.getState();
    const bossState = { ...state,
      boss: { id: 6441, tier: 1, x: 0, z: 576, hp: 2997, maxHp: 3000,
        engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 } };
    mock.getState.mockReturnValueOnce(bossState);
    await startGame(app);
    raf.frame(100);
    expect(mock.render.mock.lastCall![0].boss).toEqual({
      id: 6441, tier: 1, x: 0, z: 576, hp: 2997, maxHp: 3000, visualScale: 7,
      engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0,
    });
    app.dispose();
  });

  it('passes mixed squad roles and rocket projectile kind through the render boundary', async () => {
    const raf = createRaf();
    const config = createConfigStore(2);
    config.changePlayer({ startRocketCount: 1 });
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 2,
      startRocketCount: 1, rewardRowsPerReward: 7, bossHpScale: 3, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [{ id: 4, kind: 'rocket', tier: 0, x: 0.225, z: 3, hitRadiusBonus: 0 }] });
    await startGame(app);
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({ player: { x: 0, z: 0 },
      squad: { count: 2, rocketCount: 1, rifleCounts: [1], formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [],
      projectiles: [{ id: 4, kind: 'rocket', tier: 0, x: 0.225, z: 3, hitRadiusBonus: 0 }] }, expect.any(Number));
    app.dispose();
  });

  it('passes active gate hit progress and reward as plain render data', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 3 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [], streamRewards: [], projectiles: [], pickups: [{ id: 4, x: -2.7, zOffset: 2, rewardAmount: 1,
        rewardKind: 'rifle' }], gates: [{ id: 'rifle-generator',
        x: -2.7, zOffset: 8, width: 0.9, hitProgress: 7,
        reward: { mode: 'hitPickup', kind: 'rifle', amount: 1, hitsRequired: 10, dropSpeed: 4 } }] });
    await startGame(app);
    raf.frame(100);
    expect(mock.render.mock.lastCall![0]).toMatchObject({ gates: [{ id: 'rifle-generator',
      x: -2.7, z: 11, width: 0.9, hitProgress: 7, hitsRequired: 10,
      rewardKind: 'rifle', rewardAmount: 1 }],
      pickups: [{ id: 4, x: -2.7, z: 5, rewardAmount: 1, rewardKind: 'rifle' }] });
    app.dispose();
  });

  it('passes Tier-2 squad, heavy shot, and pickup identity through the render boundary', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 3 },
      squad: { count: 2, rocketCount: 0, rifleCounts: [1, 1], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [],
      pickups: [{ id: 7, x: 2.7, zOffset: 4, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'rifle', tier: 2, x: 0, z: 6, hitRadiusBonus: 0.45 }] });
    await startGame(app);
    raf.frame(100);
    expect(mock.render.mock.lastCall![0]).toMatchObject({
      squad: { count: 2, rocketCount: 0, rifleCounts: [1, 1] },
      pickups: [{ id: 7, x: 2.7, z: 7, rewardKind: 'tier2Rifle', rewardAmount: 1 }],
      projectiles: [{ id: 8, kind: 'rifle', tier: 2, x: 0, z: 6, hitRadiusBonus: 0.45 }],
    });
    app.dispose();
  });

  it('uses one RAF loop and keeps its config listener across stop/start without catch-up', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    await startGame(app);
    await startGame(app);
    expect(raf.pending.size).toBe(1);
    expect(mock.startResizeHandling).toHaveBeenCalledTimes(1);
    expect(mock.inputStart).toHaveBeenCalledTimes(1);
    expect(mock.keyboardStart).toHaveBeenCalledTimes(1);
    expect(mock.touchStart).toHaveBeenCalledTimes(1);

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
    expect(mock.touchStop).toHaveBeenCalledTimes(1);

    config.changePlayer({ formationSpacing: 0.9 });
    await startGame(app);
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
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
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
    expect(mock.touchStart).toHaveBeenCalledTimes(2);
    expect(mock.touchStop).toHaveBeenCalledTimes(2);
    expect(mock.touchDispose).toHaveBeenCalledTimes(1);
    expect(mock.overlayDispose).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(0);
    expect(() => app.start()).toThrow(/disposed/);
  });

  it('maps relative drag from current player X and uses live movement tuning per tick', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    const callbacks = mock.inputConstructedWith.mock.calls[0][0] as PointerDragCallbacks;
    await startGame(app);
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

  it('does not steer from ordinary mouse movement', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    raf.mouseMove();
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    app.dispose();
  });

  it('pauses on P or Space and toggles TUNE with Escape without pausing', async () => {
    const raf = createRaf();
    const updateMusic = vi.spyOn(GameAudio.prototype, 'updateMusic');
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const keyboard = mock.keyboardConstructedWith.mock.calls[0][0] as KeyboardSteeringCallbacks;
    await startGame(app);
    raf.frame(100);
    keyboard.onAxisChange(1);
    raf.frame(100 + 1000 / 60);
    const stepCount = mock.step.mock.calls.length;
    const presentationTime = mock.render.mock.lastCall![1];
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(mock.keyboardStop).toHaveBeenCalledOnce();
    expect(mock.inputStop).toHaveBeenCalledOnce();
    expect(mock.touchStop).toHaveBeenCalledOnce();
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(true);
    raf.key('p', true);
    expect(raf.key('Escape')).toBe(true);
    expect(mock.panelToggle).toHaveBeenCalledTimes(1);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    for (const tagName of ['INPUT', 'BUTTON', 'SUMMARY']) {
      expect(raf.key(' ', false, { tagName })).toBe(false);
      expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    }
    expect(raf.key(' ', false, { tagName: 'SPAN', closest: () => ({ tagName: 'BUTTON' }) })).toBe(false);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    raf.frame(100_000);
    raf.frame(101_000);
    expect(mock.step).toHaveBeenCalledTimes(stepCount);
    expect(mock.render.mock.lastCall![1]).toBe(presentationTime);
    expect(updateMusic).toHaveBeenLastCalledWith(presentationTime,
      expect.objectContaining({ paused: true, musicVolume: .50 }));
    expect(raf.key(' ')).toBe(true);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(false);
    expect(mock.touchStart).toHaveBeenCalledTimes(2);
    expect(raf.key(' ', false, { tagName: 'INPUT' })).toBe(false);
    expect(raf.key('Escape')).toBe(true);
    expect(mock.panelToggle).toHaveBeenCalledTimes(2);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(raf.key(' ')).toBe(true);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(raf.key(' ')).toBe(true);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    raf.frame(200_000);
    expect(mock.step).toHaveBeenCalledTimes(stepCount);
    raf.frame(200_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(stepCount + 1);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    expect(mock.render.mock.lastCall![1]).toBeGreaterThan(presentationTime);
    expect(updateMusic.mock.lastCall?.[1]).toMatchObject({ paused: false });
    app.dispose();
    updateMusic.mockRestore();
  });

  it('uses the same Pause transition for keyboard and button and clears touch steering on Retry', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const touchAxis = mock.touchConstructedWith.mock.calls[0][0] as (axis: -1 | 0 | 1) => void;
    const pressPause = mock.hudConstructedWith.mock.calls[0][0] as () => void;
    await startGame(app);
    raf.frame(100);
    touchAxis(-1);
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: -2.5 });
    pressPause();
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(true);
    expect(mock.keyboardStop).toHaveBeenCalledOnce();
    expect(mock.inputStop).toHaveBeenCalledOnce();
    expect(mock.touchStop).toHaveBeenCalledOnce();
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(false);
    expect(mock.keyboardStart).toHaveBeenCalledTimes(2);
    expect(mock.inputStart).toHaveBeenCalledTimes(2);
    expect(mock.touchStart).toHaveBeenCalledTimes(2);
    raf.frame(200);
    raf.frame(200 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    touchAxis(1);
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    expect(mock.touchStop).toHaveBeenCalledTimes(2);
    expect(mock.touchStart).toHaveBeenCalledTimes(3);
    raf.frame(300);
    raf.frame(300 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    app.dispose();
  });

  it('applies runtime values including Boss HP scale and retains them for Retry', async () => {
    const raf = createRaf();
    const updateMusic = vi.spyOn(GameAudio.prototype, 'updateMusic');
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const defaults = mock.panelConstructedWith.mock.calls[0][0];
    const tune = mock.panelConstructedWith.mock.calls[0][1] as (values: typeof defaults) => void;
    const edited = { ...defaults, bulletSpeed: 52, bulletRange: 65,
      rewardRowsPerReward: 3, enemyHigherTierPowerMultiplier: 12,
      rifleHigherTierPowerMultiplier: 8, fireRate: 10, moveSpeed: 9, forwardSpeed: 1.2,
      bossHpScale: 20, musicVolume: .24 };
    tune(edited);
    expect(mock.setRuntimeBalance).toHaveBeenLastCalledWith({ rewardRowsPerReward: 3,
      enemyHigherTierPowerMultiplier: 12, rifleHigherTierPowerMultiplier: 8, bossHpScale: 20 });
    await startGame(app);
    raf.frame(100);
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 9, forwardSpeed: 1.2,
      rifle: { fireRate: 10, projectileSpeed: 52, range: 65 } });
    expect(updateMusic.mock.lastCall?.[1]).toMatchObject({ musicVolume: .24,
      playerZ: 3, squadCount: 3, boss: null });
    raf.key('p');
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(mock.constructedWith).toHaveBeenLastCalledWith(expect.objectContaining({
      rewardRowsPerReward: 3, bossHpScale: 20, tiers: expect.objectContaining({
        enemyHigherTierPowerMultiplier: 12, rifleHigherTierPowerMultiplier: 8 }),
    }));
    raf.frame(100_000);
    raf.frame(100_000 + 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 9, forwardSpeed: 1.2 });
    expect(updateMusic.mock.lastCall?.[1]).toMatchObject({ musicVolume: .24, paused: false });
    tune(defaults);
    expect(mock.setRuntimeBalance).toHaveBeenLastCalledWith({ rewardRowsPerReward: 7,
      enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, bossHpScale: 3 });
    raf.frame(100_000 + 2 * 1000 / 60);
    expect(mock.step.mock.lastCall![2]).toMatchObject({ moveSpeed: 5, forwardSpeed: 3,
      rifle: { fireRate: 7, projectileSpeed: 28, range: 18 } });
    expect(updateMusic.mock.lastCall?.[1]).toMatchObject({ musicVolume: .50 });
    app.dispose();
    updateMusic.mockRestore();
  });
  it('maps keyboard edges and neutral release to the current player position', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    config.changeTrack({ halfWidth: 3.2 });
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    const keyboard = mock.keyboardConstructedWith.mock.calls[0][0] as KeyboardSteeringCallbacks;
    const drag = mock.inputConstructedWith.mock.calls[0][0] as PointerDragCallbacks;
    await startGame(app);
    raf.frame(100);

    keyboard.onAxisChange(-1);
    raf.frame(100 + 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: -3.2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.2, ...combatTuning },
    );
    keyboard.onAxisChange(1);
    raf.frame(100 + 2 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 3.2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.2, ...combatTuning },
    );
    keyboard.onAxisChange(0);
    raf.frame(100 + 3 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 2 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.2, ...combatTuning },
    );

    drag.onDragStart();
    drag.onDrag(0.25);
    raf.frame(100 + 4 * 1000 / 60);
    expect(mock.step).toHaveBeenLastCalledWith(
      1 / 60, { targetX: 3.6 },
      { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.2, ...combatTuning },
    );
    app.dispose();
  });

  it('derives Game Over from zero squad and retries with current config in the same RAF loop', async () => {
    const raf = createRaf();
    const config = createConfigStore(3);
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    await startGame(app);
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
    expect(mock.constructedWith).toHaveBeenLastCalledWith({ seed: 2, level, startSquad: 5,
      startRocketCount: 1, rewardRowsPerReward: 7, bossHpScale: 3, tiers: { mergeCount: 10, tier1Power: 4,
        tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(false);
    expect(raf.pending.size).toBe(1);
    const priorSteps = mock.step.mock.calls.length;
    raf.frame(124);
    expect(mock.step).toHaveBeenCalledTimes(priorSteps);
    raf.frame(124 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(priorSteps + 1);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 0 });
    onRetry();
    expect(mock.constructedWith.mock.lastCall![0].seed).toBe(3);
    app.dispose();
  });

  it('flashes on Tier-2 demotion and fatal loss, ignores growth, and resets on Retry', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const stateWith = (count: number, tier2RifleCount: number) => ({
      player: { x: 0, z: 0 }, squad: { count, rocketCount: 0,
        rifleCounts: tier2RifleCount ? [count - tier2RifleCount, tier2RifleCount]
          : count ? [count] : [], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    await startGame(app);
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

  it('forwards transient contact events once and clears renderer feedback on Retry', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level,
      {} as CharacterAssets);
    const event = { kind: 'normalEnemyContact', enemyId: 4, enemyTier: 1,
      attackerX: 0, attackerZ: 2, playerX: 0, playerZ: 0,
      before: { count: 2, rocketCount: 0, rifleCounts: [2], rifleRemainder: 0 },
      after: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 } };
    mock.consumePresentationEvents.mockReturnValueOnce([event]);
    await startGame(app);
    raf.frame(100);
    expect(mock.present).toHaveBeenCalledExactlyOnceWith([event], 0, 2.5, .45);
    raf.frame(100 + 1000 / 60);
    expect(mock.present).toHaveBeenCalledTimes(1);
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    expect(mock.resetFeedback).toHaveBeenCalledOnce();
    app.dispose();
  });

  it('lets fatal knockout feedback finish before showing Game Over', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level,
      {} as CharacterAssets);
    const zero = { player: { x: 0, z: 0 },
      squad: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [] };
    mock.consumePresentationEvents.mockReturnValueOnce([{ kind: 'bossSlam', bossId: 1,
      bossTier: 1, slamCount: 1, attackerX: 0, attackerZ: 2,
      playerX: 0, playerZ: 0,
      before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      after: zero.squad }]);
    await startGame(app);
    mock.getState.mockReturnValueOnce(zero);
    raf.frame(100);
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(false);
    for (let frame = 1; frame <= 23; frame++) {
      mock.getState.mockReturnValueOnce(zero);
      raf.frame(100 + frame * (1000 / 60));
    }
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(true);
    app.dispose();
  });

  it('uses the player row for the enemy HUD and resets it on Retry', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const frameState = (row: number) => ({ ...mock.getState(),
      player: { x: 0, z: level.enemyStream!.startZ + row * level.enemyStream!.spacing } });
    await startGame(app);
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


it('dispatches one shared progression beat per gain, coalesces overflow and resets observation on Retry', async () => {
  const raf = createRaf();
  const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
  const base = mock.getState();
  const balance = CatharsisConfigSchema.parse(gameData.catharsis);
  const play = vi.spyOn(GameAudio.prototype, 'play').mockImplementation(() => {});
  await startGame(app);
  for (const [timestamp, playerLevel] of [[100, 1], [116, 2], [133, 2], [150, 5], [166, 5]]) {
    mock.getState.mockReturnValueOnce({ ...base, progression: { level: playerLevel, xp: 0 },
      catharsis: { balance, trackHalfWidth: 3.2 } });
    raf.frame(timestamp);
  }
  expect(mock.presentLevelUp).toHaveBeenCalledTimes(2);
  expect(mock.presentLevelUp.mock.calls.map(call => call[0])).toEqual([
    { kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 },
    { kind: 'progressionLevelUp', fromLevel: 2, toLevel: 5 },
  ]);
  expect(play.mock.calls.filter(call => call[0] === 'levelUp')).toHaveLength(2);
  (mock.overlayConstructedWith.mock.calls[0][0] as () => void)();
  mock.getState.mockReturnValueOnce({ ...base, progression: { level: 2, xp: 0 }, catharsis: { balance, trackHalfWidth: 3.2 } });
  raf.frame(200);
  expect(mock.presentLevelUp.mock.lastCall?.[0]).toEqual({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 });
  expect(mock.presentLevelUp).toHaveBeenCalledTimes(3);
  app.dispose(); play.mockRestore();
});

it('constructs defense XP presentation without constructing the obsolete lane-number HUD', async () => {
  createRaf();
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn() } });
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  expect(mock.xpConstructed).toHaveBeenCalledWith(viewport);
  expect(mock.panelAnchor).toHaveBeenCalledWith(viewport);
  expect(mock.laneConstructed).not.toHaveBeenCalled();
  expect(viewport.classList.add).toHaveBeenCalledWith('beachhead-defense');
  app.dispose();
});

it('restarts selected lab fixtures and clears renderer feedback on every switch and Retry', async () => {
  createRaf();
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn() } });
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  const select = mock.labConstructed.mock.lastCall![0] as (role: string) => void;
  for (const role of ['heavy', 'giant', 'grunt', 'grunt', 'grenade', 'grenade', 'evolve', 'machineGun', 'evolve']) {
    const before = mock.resetFeedback.mock.calls.length;
    select(role);
    expect(mock.labFixture.mock.lastCall![2]).toBe(role);
    expect(mock.resetFeedback.mock.calls.length).toBe(before + 1);
  }
  const retry = mock.overlayConstructedWith.mock.lastCall![0] as () => void;
  retry(); expect(mock.labFixture.mock.lastCall![2]).toBe('evolve');
  expect(mock.resetFeedback.mock.calls.map(call=>call[0])).toEqual([0,1,2,3,4,5,6,7,8,9]);
  expect(mock.resetFeedback).toHaveBeenCalledTimes(10);
  app.dispose();
});


it('omits every Lab control, including GRENADE, EVOLVE and MG, outside DEV', () => {
  createRaf();vi.stubEnv('DEV', false);
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn() } });
  try {
    const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
    expect(mock.labConstructed).not.toHaveBeenCalled();expect(mock.labFixture).not.toHaveBeenCalled();app.dispose();
  } finally { vi.unstubAllEnvs(); }
});

describe('Q primary active item', () => {
  function setup() {
    const raf = createRaf(), base = mock.getState();
    const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
    const state = { ...base, player: { x: 0, z: 0, selectedLane: 2 },
      catharsis: { trackHalfWidth: config.track.halfWidth, balance: config.catharsis! },
      grenade: { inventory: 1, acquiredAtSeconds: 0, flight: null },
      enemies: [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 12, hp: 1 }] };
    mock.getState.mockReturnValue(state);
    const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } });
    const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
    const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
    const control = app as unknown as { grenadeRequested: boolean; takeGrenadeRequest(): boolean };
    return { raf, state, app, control, button: mock.grenadeConstructed.mock.lastCall![0] as () => void,
      dispose: () => { app.dispose(); mock.getState.mockReturnValue(base); } };
  }

  it('uses the identical button callback and physical Q request, coalescing repeats until a fixed tick', async () => {
    const s = setup();
    try {
      await startGame(s.app);
      s.button();expect(s.control.takeGrenadeRequest()).toBe(true);
      s.raf.key('ø', false, undefined, 'KeyQ');expect(s.control.grenadeRequested).toBe(true);
      s.raf.key('q', true);s.button();
      expect(s.control.takeGrenadeRequest()).toBe(true);expect(s.control.takeGrenadeRequest()).toBe(false);
      s.raf.key('q', true);expect(s.control.takeGrenadeRequest()).toBe(false);
      s.raf.key('q', false, undefined, 'KeyA');expect(s.control.takeGrenadeRequest()).toBe(false);
      s.raf.key('a');s.raf.key('ArrowRight');expect(mock.stepLane.mock.calls).toEqual([[-1],[1]]);
      s.raf.key('q');s.raf.frame(0);s.raf.frame(100);
      expect(mock.stepLane).toHaveBeenCalledTimes(2);
      expect(mock.step.mock.calls.filter(call => call[1].throwGrenade)).toHaveLength(1);
      expect(s.state.grenade.inventory).toBe(1); // App requests; simulation owns consumption.
    } finally { s.dispose(); }
  });

  it('ignores Q from interactive, editable, nested-button and TUNE focus', async () => {
    const s = setup();
    try {
      await startGame(s.app);
      for (const target of [
        ...['INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY'].map(tagName => ({tagName})),
        {isContentEditable:true}, {tagName:'SPAN',closest:()=>({tagName:'BUTTON'})},
        {tagName:'OUTPUT',closest:(selector:string)=>selector === '.tuning-panel' ? {} : null},
      ]) { s.raf.key('q',false,target);expect(s.control.takeGrenadeRequest()).toBe(false); }
    } finally { s.dispose(); }
  });

  it('blocks Q before start, while paused, dead, empty or without an eligible lane target', async () => {
    const s = setup();
    try {
      s.app.start();s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
      await startGame(s.app);
      s.raf.key('p');s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);s.raf.key('p');
      s.state.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};
      s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
      s.state.squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
      s.state.grenade.inventory=0;s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
      s.state.grenade.inventory=1;s.state.player.selectedLane=0;
      s.raf.key('q');s.button();expect(s.control.takeGrenadeRequest()).toBe(false);
      expect(s.state.grenade.inventory).toBe(1);
      s.state.player.selectedLane=2;s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(true);
      s.app.stop();s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
    } finally { s.dispose(); }
  });
});

describe('intentional gameplay startup', () => {
  it('opens DEV fixture shortcuts only after startup and closes them when stopped', async () => {
    createRaf();
    const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn() } });
    const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
    const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
    const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
    const canUse = mock.labConstructed.mock.lastCall![1] as () => boolean;
    expect(canUse()).toBe(false);
    await startGame(app);
    expect(canUse()).toBe(true);
    app.stop();
    expect(canUse()).toBe(false);
    app.dispose();
  });
  it('renders a frozen initial world for a long wait, without observers, cues or steps', async () => {
    const raf = createRaf();
    const observe = vi.spyOn(GameAudio.prototype, 'observe');
    const music = vi.spyOn(GameAudio.prototype, 'updateMusic');
    const environment = vi.spyOn(GameAudio.prototype, 'updateEnvironment');
    const play = vi.spyOn(GameAudio.prototype, 'play');
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const initial = structuredClone(mock.getState());
    app.start();
    for (const t of [0, 3000, 5000, 300000]) raf.frame(t);
    expect(mock.getState()).toEqual(initial);
    expect(mock.step).not.toHaveBeenCalled();
    expect(mock.consumePresentationEvents).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(music).not.toHaveBeenCalled();
    expect(environment).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(GameAudio.prototype.activate).not.toHaveBeenCalled();
    expect(mock.render.mock.calls.every(call => call[1] === 0)).toBe(true);
    expect(mock.inputStart).not.toHaveBeenCalled();
    expect(raf.key('Enter')).toBe(true);
    await Promise.resolve();
    raf.frame(400000);
    expect(mock.step).not.toHaveBeenCalled();
    expect(observe.mock.lastCall?.[5]).toBe(0);
    raf.frame(400000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledOnce();
    expect(GameAudio.prototype.activate).toHaveBeenCalledOnce();
    app.dispose();
  });

  it.each(['running', 'denied', 'unavailable'] as const)('starts even when activation reports %s; Retry keeps the gate open', async result => {
    const raf = createRaf();
    vi.mocked(GameAudio.prototype.activate).mockResolvedValue(result);
    const reset = vi.spyOn(GameAudio.prototype, 'resetObservation');
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    app.start();
    expect(raf.key(' ')).toBe(true);
    await Promise.resolve();
    raf.frame(10000);
    raf.frame(10000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledOnce();
    const retry = mock.overlayConstructedWith.mock.lastCall![0];
    retry();
    raf.frame(90000);
    expect(mock.step).toHaveBeenCalledOnce();
    raf.frame(90000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(2);
    expect(GameAudio.prototype.activate).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledTimes(2);
    app.dispose();
  });

  it('consumes dev-control gestures, freezes while activation is pending and ignores duplicate starts', async () => {
    const raf = createRaf();
    let resolve!: (value: 'running') => void;
    vi.mocked(GameAudio.prototype.activate).mockImplementation(() => new Promise(r => { resolve = r; }));
    const viewport = Object.assign(new EventTarget(), { classList: { remove: vi.fn() } }) as unknown as HTMLElement;
    const app = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    const control = vi.fn();
    app.start();
    viewport.addEventListener('pointerdown', control);
    viewport.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    raf.key('Enter');
    raf.frame(5000);
    expect(control).not.toHaveBeenCalled();
    expect(mock.step).not.toHaveBeenCalled();
    expect(GameAudio.prototype.activate).toHaveBeenCalledOnce();
    resolve('running'); await Promise.resolve();
    raf.frame(10000);
    expect(mock.render.mock.lastCall![1]).toBe(0);
    app.dispose();
  });

  it('does not restart a disposed app when pending activation resolves', async () => {
    createRaf();
    let resolve!: (value: 'running') => void;
    vi.mocked(GameAudio.prototype.activate).mockImplementation(() => new Promise(r => { resolve = r; }));
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    app.start();
    const pending = (app as unknown as { beginGameplay(): Promise<void> }).beginGameplay();
    app.dispose(); resolve('running'); await pending;
    expect(mock.inputStart).not.toHaveBeenCalled();
  });
});

it('does not flash player damage or play damage audio when three Rifles evolve into one MG',async()=>{
 const raf=createRaf(),base=mock.getState();
 const config={...gameData,catharsis:CatharsisConfigSchema.parse(gameData.catharsis)} as unknown as GameConfig;
 const state={...base,progression:{level:5,xp:219},catharsis:{trackHalfWidth:config.track.halfWidth,balance:config.catharsis!}};
 mock.getState.mockReturnValue(state);
 const observe=vi.spyOn(GameAudio.prototype,'observe');
 const viewport=Object.assign(new EventTarget(),{classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
 const store={getConfig:()=>config,subscribe:()=>()=>{}} as unknown as ConfigStore;
 const app=new GameApp(viewport as unknown as HTMLElement,store,level,{} as CharacterAssets);
 try{
  await startGame(app);raf.frame(0);raf.frame(100);
  mock.damageFlash.mockClear();state.progression={level:6,xp:0};state.squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
  raf.frame(200);expect(mock.damageFlash).not.toHaveBeenCalled();expect(observe.mock.lastCall!.slice(0,2)).toEqual([1n,1n]);
 } finally{app.dispose();mock.getState.mockReturnValue(base);}
});
