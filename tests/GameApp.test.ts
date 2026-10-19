import gameData from './helpers/ShippingConfig';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';
import type { CharacterAssets } from '../src/rendering/CharacterAssets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigStore, ConfigListener } from '../src/config/ConfigStore';
import type { GameConfig } from '../src/config/configSchema';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { GameAudio } from '../src/audio/GameAudio';
import { PerfDiagnostics } from '../src/app/PerfDiagnostics';
import { progressionDefaults } from '../src/config/progressionConfig';
import { startDefenseTank } from '../src/simulation/defenseTank';
vi.mock('../src/ui/DevTracerControls', () => ({ DevTracerControls: class { setVisible() {} dispose() {} } }));
vi.mock('../src/ui/DevFps', () => ({ DevFps: class { frame() {} reset() {} dispose() {} } }));
vi.mock('../src/ui/ManualAirSupportButton', () => ({ ManualAirSupportButton: class {
  element = { offsetTop: 0 };
  constructor(_viewport: unknown, activate: unknown) { mock.manualSupportConstructed(activate); }
  update = vi.fn(); reset = vi.fn(); restore = vi.fn(); dispose = vi.fn();
} }));
vi.mock('../src/ui/QaPanel', () => ({ QaPanel: class {
  constructor() { mock.qaConstructed(); }
  open() {} setStatus() {} setWake() {} refreshCheckpoint() {} dispose() {}
} }));
vi.mock('../src/app/DevLifecycle', () => ({ DevLifecycle: class { record() {} dispose() {} } }));
vi.mock('../src/app/openingCohort', async original => ({ ...await original<typeof import('../src/app/openingCohort')>(), prepareOpeningCohort: vi.fn() }));
vi.mock('../src/ui/OpeningAlert', () => ({ OpeningAlert: class { update() {} dispose() {} } }));
vi.mock('../src/ui/FieldObserver', () => ({ FieldObserver: class {
  updateVictory(now: number, paused: boolean) { return mock.victory(now, paused); }
  finishCombat() {} victoryCheckpoint() { return undefined; } restoreVictory() {}
  update() {} reset() {} restore() {} dispose() {} startOpening() { mock.missionIntro(0); } updateOpening() { return true; }
} }));
vi.mock('../src/ui/GameStartOverlay', () => ({ GameStartOverlay: class {
  constructor(_viewport: unknown, start: unknown) { mock.startConstructed(start); }
  show() {} setActivating() {} finish() {} dispose() {}
} }));
vi.mock('../src/ui/DevReviewControls', () => ({ DevReviewControls: class {
  constructor(_viewport: unknown, select: unknown) { mock.reviewConstructed(select); }
  setSelected() {} dispose() {}
} }));
vi.mock('../src/app/PlaytestScenarios', async original => ({
  ...await original<typeof import('../src/app/PlaytestScenarios')>(),
  createPlaytestScenario: (...args: unknown[]) => { mock.reviewFixture(...args); return { getState: mock.getState, getFrameState: mock.getState }; },
}));
vi.mock('../src/app/DevReviewFixtures', () => ({ createDevReviewFixture: (...args: unknown[]) => {
  mock.reviewFixture(...args); return { getState: mock.getState, getFrameState: mock.getState };
} }));

const mock = vi.hoisted(() => ({
  startConstructed: vi.fn(),
  dioramaRender: vi.fn(),
  missionIntro: vi.fn(),
  qaConstructed: vi.fn(),
  victory: vi.fn((_now: number, _paused: boolean) => false),
  constructedWith: vi.fn(),
  reviewConstructed: vi.fn(),
  reviewFixture: vi.fn(),
  grenadeConstructed: vi.fn(),
  manualSupportConstructed: vi.fn(),
  grenadeUpdate: vi.fn(),
  step: vi.fn(),
  stepLane: vi.fn(),
  setCatharsisBalance: vi.fn(),
  getState: vi.fn((): any => ({
    player: { x: 2, z: 3 },
    squad: { count: 3, rocketCount: 0, rifleCounts: [3], rifleRemainder: 0 },
    enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
    streamRewards: [] as { id: number; tier: number; x: number; z: number;
      hitProgress: number; hitsRequired: number }[],
    gates: [] as never[],
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
  pauseVisible: vi.fn(),
  pauseConstructedWith: vi.fn(),
  pauseDispose: vi.fn(),
  hintDispose: vi.fn(),
  xpConstructed: vi.fn(),
  stripConstructed: vi.fn(),
  laneConstructed: vi.fn(),
  hudConstructedWith: vi.fn(),
  hudSetPaused: vi.fn(),
  hudDispose: vi.fn(),
  panelConstructedWith: vi.fn(),
  advancedAppend: vi.fn(),
  panelAnchor: vi.fn(),
  panelSetValues: vi.fn(),
  panelToggle: vi.fn(),
  panelClose: vi.fn(),
  pauseMenuOpen: vi.fn(),
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
const stripDom = vi.hoisted(() => ({ progressionHost: {} as HTMLElement }));
const tankUi = vi.hoisted(() => ({ update: vi.fn(), show: vi.fn(), reset: vi.fn(), replay: null as (() => void) | null }));
vi.mock('../src/ui/TankBossHud', () => ({ TankBossHud: class { update = tankUi.update; presentGrenade = vi.fn(); presentSupport = vi.fn(); reset = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../src/ui/TankEntranceHud', () => ({ TankEntranceHud: class { update = vi.fn(); restore = vi.fn(); reset = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../src/ui/ArtilleryEmergencyHud', () => ({ ArtilleryEmergencyHud: class { update = vi.fn(); reset = vi.fn(); dispose = vi.fn(); } }));
vi.mock('../src/ui/StageClearOverlay', () => ({ StageClearOverlay: class {
  constructor(_viewport: unknown, replay: () => void) { tankUi.replay = replay; }
  show = tankUi.show; reset = tankUi.reset; dispose = vi.fn();
  setDevPreview = vi.fn();
} }));

vi.mock('../src/simulation/Simulation', () => ({
  Simulation: class {
    constructor(options: unknown) { mock.constructedWith(options); }
    step = mock.step;
    stepLane = mock.stepLane;
    setCatharsisBalance = mock.setCatharsisBalance;
    getState = mock.getState;
    getFrameState = mock.getState;
    consumePresentationEvents = mock.consumePresentationEvents;
    consumeGrenadeEvents = vi.fn(() => []);
    consumeArtilleryEvents = vi.fn(() => []);
    consumeTankEntranceEvents = vi.fn(() => []);
    consumeSupportEvents = vi.fn(() => []);
  },
}));

vi.mock('../src/rendering/GameRenderer', () => ({
  GameRenderer: class {
    render = mock.render;
    renderDiorama = mock.dioramaRender;
    renderInvasion = vi.fn(); finishInvasion = vi.fn();
    beginDioramaTransition = vi.fn();
    present = mock.present;
    presentGrenade = vi.fn();
    presentArtillery = vi.fn();
    presentTankEntrance = vi.fn();
    presentSupport = vi.fn();
    projectTankHealthPosition = vi.fn(() => ({ x: 195, y: 240 }));
    presentLevelUp = mock.presentLevelUp;
    resetFeedback = mock.resetFeedback;
    preparePresentation = vi.fn();
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
    visible = false;
    setVisible = (visible: boolean, ...args: unknown[]) => {
      this.visible = visible; mock.overlayVisible(visible, ...args);
    };
    dispose = mock.overlayDispose;
  },
}));



vi.mock('../src/ui/PauseOverlay', () => ({ PauseOverlay: class {
  constructor(_viewport: HTMLElement, resume: () => void) { mock.pauseConstructedWith(resume); }
  setVisible = mock.pauseVisible;
  setMenuOpen = mock.pauseMenuOpen;
  dispose = mock.pauseDispose;
} }));





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
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) });
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible',
    createElement: () => Object.assign(new EventTarget(), { className: '', textContent: '', style: { cssText: '' }, append: vi.fn(),
      value: '', setAttribute: vi.fn(), remove: vi.fn(), blur: vi.fn() }) }));
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
  // Combat-focused unit cases complete the separately tested opening boundary.
  (app as any).cancelOpening(); (app as any).startInputs();
}

it('isolates GIANT review from normal checkpoints through pause, Retry, lifecycle and disposal', async () => {
  const raf = createRaf(), { store } = createConfigStore();
  const original = 'owner checkpoint: must remain byte-for-byte intact';
  localStorage.setItem('topwar:session:v1:dev', original);
  const viewport = Object.assign(new EventTarget(), { append: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } });
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets,
    false, undefined, undefined, { status: 'invalid' }, undefined, true);
  await startGame(app); raf.frame(0);
  const internal = app as any;
  expect(internal.devReviewFixture).toBe('giant');
  expect(mock.qaConstructed).not.toHaveBeenCalled();
  expect(mock.reviewConstructed).not.toHaveBeenCalled();
  internal.setPaused(true);
  internal.retry();
  window.dispatchEvent(new Event('pagehide'));
  document.dispatchEvent(new Event('freeze'));
  internal.saveCheckpoint('contextlost');
  expect(localStorage.getItem('topwar:session:v1:dev')).toBe(original);
  expect(mock.reviewFixture.mock.calls.every(call => call[2] === 'giant')).toBe(true);
  app.dispose();
  expect(localStorage.getItem('topwar:session:v1:dev')).toBe(original);
});

it('suspends and checkpoints hidden/frozen pages without replacing the simulation or resuming on return', async () => {
  const raf = createRaf(), { store } = createConfigStore();
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } });
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  await startGame(app); raf.frame(0); raf.frame(1000 / 60);
  const internals = app as any, sim = internals.simulation, steps = mock.step.mock.calls.length;
  internals.grenadeRequested = true;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(internals.paused).toBe(true); expect(internals.grenadeRequested).toBe(false);
  expect(JSON.parse(localStorage.getItem('topwar:session:v1:dev')!).reason).toBe('hidden');
  raf.frame(500_000); expect(mock.step.mock.calls.length).toBe(steps);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('freeze'));
  document.dispatchEvent(new Event('resume')); window.dispatchEvent(new Event('pageshow'));
  expect(internals.simulation).toBe(sim); expect(internals.paused).toBe(true);
  expect(internals.previousFrameTimestampMs).toBeNull();
  internals.togglePaused(); raf.frame(600_000); expect(mock.step.mock.calls.length).toBe(steps);
  raf.frame(600_000 + 1000 / 60); expect(mock.step.mock.calls.length).toBeGreaterThan(steps);
  app.dispose(); localStorage.removeItem('topwar:session:v1:dev');
  document.dispatchEvent(new Event('freeze')); expect(localStorage.getItem('topwar:session:v1:dev')).toBeNull();
});

it('starts the mission intro only after activation, bypasses Retry, and keeps isolated DEV fixtures unchanged',async()=>{
  const raf=createRaf();
  const config={...gameData,catharsis:CatharsisConfigSchema.parse(gameData.catharsis)} as unknown as GameConfig;
  const base=mock.getState();mock.getState.mockReturnValue({...base,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}});
  const viewport=Object.assign(new EventTarget(),{classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
  const store={getConfig:()=>config,subscribe:()=>()=>{}} as unknown as ConfigStore;
  const app=new GameApp(viewport as unknown as HTMLElement,store,level,{} as CharacterAssets);
  app.start();raf.frame(0);expect(mock.missionIntro).not.toHaveBeenCalled();
  await startGame(app);expect(mock.missionIntro).toHaveBeenCalledOnce();
  raf.frame(100);raf.frame(100+1000/60);expect(mock.step).toHaveBeenCalled();
  const retry=mock.overlayConstructedWith.mock.lastCall![0];retry();expect(mock.missionIntro).toHaveBeenCalledTimes(1);
  const select=mock.reviewConstructed.mock.lastCall![0];select('naval');expect(mock.missionIntro).toHaveBeenCalledTimes(1);
  app.dispose();mock.getState.mockReturnValue(base);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const method of Object.values(mock)) method.mockClear();
  tankUi.update.mockClear(); tankUi.show.mockClear(); tankUi.reset.mockClear();
});

describe('GameApp config and frame lifecycle', () => {
  it('creates the HUD only in perf mode and resets diagnostics on Retry', async () => {
    createRaf();
    const element = { className: '', textContent: '', setAttribute: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => element) });
    const viewport = { append: vi.fn(), classList: { toggle: vi.fn(), remove: vi.fn() } } as unknown as HTMLElement;
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
  it('shows a runtime error and stops scheduling frames when rendering throws', async () => {
    const raf = createRaf();
    const notice = { className: '', textContent: '', setAttribute: vi.fn() };
    vi.stubGlobal('document', { createElement: () => notice });
    const viewport = { append: vi.fn(), classList: { toggle: vi.fn(), remove: vi.fn() } } as unknown as HTMLElement;
    const originalError = new Error('render failure');
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.render.mockImplementationOnce(() => { throw originalError; });
    const app = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    expect(reported).toHaveBeenCalledWith('TopWar game loop stopped after an unexpected error', originalError);
    expect(raf.pending.size).toBe(0);
    expect(viewport.append).toHaveBeenCalledWith(notice);
    expect(notice.textContent).toMatch(/遊戲意外中止，請重新載入再試一次。/);
    app.dispose();
    reported.mockRestore();
  });
  it('reports the original simulation exception instead of leaving a frozen frame', async () => {
    const raf = createRaf();
    vi.stubGlobal('document', { createElement: () => ({ setAttribute: vi.fn() }) });
    const viewport = { append: vi.fn(), classList: { toggle: vi.fn(), remove: vi.fn() } } as unknown as HTMLElement;
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
      startRocketCount: 0, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    app.dispose();
  });
  it('starts the simulation from config and sends plain live state to the renderer', async () => {
    const raf = createRaf();
    const config = createConfigStore(5, 0.8);
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    expect(mock.constructedWith).toHaveBeenCalledWith({ seed: 1, level, startSquad: 5,
      startRocketCount: 0, tiers: { mergeCount: 10, tier1Power: 10, tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 } });
    expect(config.listenerCount()).toBe(1);

    await startGame(app);
    raf.frame(100);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 0.8 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
    }, expect.any(Number));

    config.changePlayer({ startSquad: 9, formationSpacing: 1.2 });
    raf.frame(110);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 1.2 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
    }, expect.any(Number));
    expect(mock.constructedWith).toHaveBeenCalledTimes(1);
    app.dispose();
    expect(config.listenerCount()).toBe(0);
  });

  it('passes current Heavy/Giant HP through plain render state for hit feedback', async () => {
    const raf = createRaf();
    const config = createConfigStore();
    const app = new GameApp({} as HTMLElement, config.store, level, {} as CharacterAssets);
    await startGame(app);
    mock.getState.mockReturnValueOnce({ player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      enemies: [{ id: 673, tier: 1, archetype: 'heavy', lane: 2, x: 0.1, z: 21.6, hp: 7 },
        { id: 2524, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 40, hp: 132 }],
      streamRewards: [],
      gates: [], pickups: [], projectiles: [] });
    raf.frame(100);
    expect(mock.render.mock.lastCall![0].enemies).toEqual([
      { id: 673, tier: 1, archetype: 'heavy', lane: 2, x: 0.1, z: 21.6, hp: 7 },
      { id: 2524, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 40, hp: 132 },
    ]);
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

    config.changePlayer({ formationSpacing: 0.9 });
    await startGame(app);
    raf.frame(300_000);
    expect(mock.step).toHaveBeenCalledTimes(1);
    expect(mock.render).toHaveBeenLastCalledWith({
      player: { x: 2, z: 3 },
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: 0.9 },
      track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [{ id: 1, tier: 1, x: -0.4, z: 12, hp: 10 }],
      projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 5, hitRadiusBonus: 0 }],
    }, expect.any(Number));
    raf.frame(300_000 + 1000 / 60);
    expect(mock.step).toHaveBeenCalledTimes(2);

    app.dispose();
    expect(raf.pending.size).toBe(0);
    expect(mock.stopResizeHandling).toHaveBeenCalledTimes(2);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(mock.overlayDispose).toHaveBeenCalledTimes(1);
    expect(config.listenerCount()).toBe(0);
    expect(() => app.start()).toThrow(/disposed/);
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

  it('pauses on P/Space and opens the testing menu with Escape while remaining paused on close', async () => {
    const raf = createRaf();
    const updateMusic = vi.spyOn(GameAudio.prototype, 'updateMusic');
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    raf.frame(100);
    raf.frame(100 + 1000 / 60);
    const stepCount = mock.step.mock.calls.length;
    const presentationTime = mock.render.mock.lastCall![1];
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
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
    expect(raf.key(' ', false, { tagName: 'INPUT' })).toBe(false);
    expect(raf.key('Escape')).toBe(true);
    expect(mock.panelToggle).toHaveBeenCalledTimes(2);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(raf.key('Escape')).toBe(true);
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    raf.key('p');
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

  it('uses the same Pause transition for keyboard and button and keeps Retry input neutral', async () => {
    const raf = createRaf();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    const pressPause = mock.hudConstructedWith.mock.calls[0][0] as () => void;
    await startGame(app);
    raf.frame(100);
    raf.frame(100 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    pressPause();
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(true);
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(true);
    raf.key('p');
    expect(mock.pauseVisible).toHaveBeenLastCalledWith(false);
    expect(mock.hudSetPaused).toHaveBeenLastCalledWith(false);
    raf.frame(200);
    raf.frame(200 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    raf.frame(300);
    raf.frame(300 + 1000 / 60);
    expect(mock.step.mock.lastCall![1]).toEqual({ targetX: 2 });
    app.dispose();
  });

  it('central Resume uses the guarded gesture path and cannot toggle twice or resume hidden/lost contexts', async () => {
    createRaf(); const app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
    await startGame(app);
    const resume = mock.pauseConstructedWith.mock.calls[0][0] as () => void;
    const toggle = mock.hudConstructedWith.mock.calls[0][0] as () => void;
    const internals = app as unknown as {paused: boolean; hidden: boolean; contextLost: boolean};
    const activate = vi.spyOn(GameAudio.prototype, 'activate');
    activate.mockClear();
    resume(); expect(internals.paused).toBe(false); expect(activate).not.toHaveBeenCalled();
    toggle(); expect(internals.paused).toBe(true);
    internals.hidden = true; resume(); expect(internals.paused).toBe(true);
    internals.hidden = false; internals.contextLost = true; resume(); expect(internals.paused).toBe(true);
    internals.contextLost = false; resume(); resume(); expect(internals.paused).toBe(false);
    expect(activate).toHaveBeenCalledOnce(); app.dispose(); activate.mockRestore();
  });

  it('auto-pauses a native menu change once, leaves close paused, and closes before guarded Resume',async()=>{
    const raf=createRaf(),app=new GameApp({} as HTMLElement,createConfigStore().store,level,{} as CharacterAssets);
    await startGame(app);raf.frame(0);raf.frame(20);
    const a=app as any,steps=mock.step.mock.calls.length,clock=mock.render.mock.lastCall![1];a.grenadeRequested=true;
    a.tuningPanel.toggle();expect(a.paused).toBe(true);expect(mock.pauseMenuOpen).toHaveBeenLastCalledWith(true);
    expect(a.grenadeRequested).toBe(false);raf.frame(500);expect(mock.step).toHaveBeenCalledTimes(steps);
    expect(mock.render.mock.lastCall![1]).toBe(clock);
    a.tuningPanel.close();expect(a.paused).toBe(true);expect(mock.pauseMenuOpen).toHaveBeenLastCalledWith(false);
    a.tuningPanel.toggle();expect(a.paused).toBe(true);
    const resume=mock.hudConstructedWith.mock.lastCall![0] as ()=>void;
    for(const guard of ['hidden','contextLost','qaSleepActive','qaPreparing']){
      a[guard]=true;resume();expect(a.paused).toBe(true);expect(mock.pauseMenuOpen).toHaveBeenLastCalledWith(true);a[guard]=false;
    }
    resume();expect(a.paused).toBe(false);expect(mock.pauseMenuOpen).toHaveBeenLastCalledWith(false);
    expect(mock.panelClose.mock.invocationCallOrder.at(-1)).toBeLessThan(mock.hudSetPaused.mock.invocationCallOrder.at(-1)!);
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
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(true, undefined, undefined);
    expect(raf.pending.size).toBe(1);

    config.changePlayer({ startSquad: 5, startRocketCount: 0 });
    config.changeTiers({ tier1Power: 4 });
    mock.getState.mockReturnValueOnce({
      player: { x: 0, z: 0 }, squad: { count: 5, rocketCount: 0, rifleCounts: [5], rifleRemainder: 0 }, enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [],
    });
    const onRetry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    onRetry();
    expect(mock.constructedWith).toHaveBeenLastCalledWith({ seed: 2, level, startSquad: 5,
      startRocketCount: 0, tiers: { mergeCount: 10, tier1Power: 4,
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
    expect(mock.present).toHaveBeenCalledExactlyOnceWith([event], 0, 2.5, .45, undefined, undefined);
    raf.frame(100 + 1000 / 60);
    expect(mock.present).toHaveBeenCalledTimes(1);
    const retry = mock.overlayConstructedWith.mock.calls[0][0] as () => void;
    retry();
    expect(mock.resetFeedback).toHaveBeenCalledOnce();
    app.dispose();
  });

  it('lets fatal knockout feedback finish before showing Game Over', async () => {
    const raf = createRaf();
    const base = mock.getState();
    const app = new GameApp({} as HTMLElement, createConfigStore().store, level,
      {} as CharacterAssets);
    const zero = { player: { x: 0, z: 0 },
      squad: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 },
      elapsedSeconds: 90, combatStats: { gruntKills: 5, heavyKills: 2, giantKills: 1,
        shotsFired: 100, shotsHit: 35, grenadesUsed: 1 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [] };
    mock.consumePresentationEvents.mockReturnValueOnce([{ kind: 'artilleryContact', shellId: 1, attackerX: 0, attackerZ: 2,
      playerX: 0, playerZ: 0,
      before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      after: zero.squad }]);
    await startGame(app);
    mock.getState.mockReturnValue(zero);
    raf.frame(100);
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(false);
    for (let frame = 1; frame <= 23; frame++) {
      raf.frame(100 + frame * (1000 / 60));
    }
    expect(mock.overlayVisible).toHaveBeenLastCalledWith(true, zero.combatStats, 90);
    const frozenAge = (app as unknown as { presentationMs: number }).presentationMs;
    raf.frame(1100);
    expect((app as unknown as { presentationMs: number }).presentationMs).toBe(frozenAge);
    app.dispose();
    mock.getState.mockReturnValue(base);
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

it.each(['personalEmergency', 'overheadLanes', undefined] as const)('keeps cannon/impact cues and gates launch lock-on for %s', warningPresentation => {
  const raf = createRaf(), app = new GameApp({} as HTMLElement, createConfigStore().store, level, {} as CharacterAssets);
  const play = vi.spyOn(GameAudio.prototype, 'play').mockImplementation(() => {});
  const base = mock.getState(), balance = CatharsisConfigSchema.parse(gameData.catharsis);
  balance.artillery!.warningPresentation = warningPresentation;
  mock.getState.mockReturnValue({ ...base, elapsedSeconds: 0, catharsis: { balance, trackHalfWidth: 3.2 } });
  const internal = app as unknown as { startup: string; simulation: { consumeArtilleryEvents: ReturnType<typeof vi.fn> } };
  internal.startup = 'started';
  internal.simulation.consumeArtilleryEvents.mockReturnValueOnce([{ kind: 'artilleryLaunch' }, { kind: 'artilleryImpact' }]);
  app.start(); raf.frame(100);
  expect(play).toHaveBeenCalledWith('enemyCannon'); expect(play).toHaveBeenCalledWith('enemyShellImpact');
  expect(play.mock.calls.filter(([cue]) => cue === 'enemyLockOn')).toHaveLength(warningPresentation === 'personalEmergency' ? 0 : 1);
  app.dispose(); play.mockRestore();
});

it('constructs defense XP presentation without constructing the obsolete lane-number HUD', async () => {
  createRaf();
  const viewport = Object.assign(new EventTarget(), { classList: { toggle: vi.fn(), add: vi.fn(), remove: vi.fn() } });
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  expect(mock.stripConstructed).toHaveBeenCalledWith(viewport);
  expect(mock.xpConstructed).toHaveBeenCalledWith(stripDom.progressionHost);
  expect(mock.touchConstructedWith).not.toHaveBeenCalled();
  expect(mock.panelAnchor).toHaveBeenCalledWith(viewport);
  expect(mock.laneConstructed).not.toHaveBeenCalled();
  expect(viewport.classList.add).toHaveBeenCalledWith('beachhead-defense');
  app.dispose();
});

it('enables only visible defense controls after start and clears them on Pause, death, Retry and stop', async () => {
  const raf=createRaf(),base=mock.getState();
  const config={...gameData,catharsis:CatharsisConfigSchema.parse(gameData.catharsis)} as unknown as GameConfig;
  const state={...base,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}};
  mock.getState.mockReturnValue(state);
  const viewport=Object.assign(new EventTarget(),{classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
  const app=new GameApp(viewport as unknown as HTMLElement,{getConfig:()=>config,subscribe:()=>()=>{}} as unknown as ConfigStore,level,{} as CharacterAssets);
  const buttons=(app as unknown as {controlStrip:{buttons:HTMLButtonElement[]}}).controlStrip.buttons;
  try {
    expect(buttons.every(b=>b.disabled)).toBe(true);
    await startGame(app);expect(buttons.every(b=>!b.disabled)).toBe(true);
    const press=new Event('pointerdown',{cancelable:true});
    Object.defineProperties(press,{pointerType:{value:'touch'},pointerId:{value:1}});
    mock.stepLane.mockReturnValue(true);buttons[0].dispatchEvent(press);
    expect(mock.stepLane).toHaveBeenLastCalledWith(-1);
    const pause=mock.hudConstructedWith.mock.lastCall![0] as ()=>void;
    pause();expect(buttons.every(b=>b.disabled)).toBe(true);
    pause();expect(buttons.every(b=>!b.disabled)).toBe(true);
    state.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};raf.frame(0);
    expect(buttons.every(b=>b.disabled)).toBe(true);
    pause();pause();expect(buttons.every(b=>b.disabled)).toBe(true);
    state.squad={...base.squad};
    (mock.overlayConstructedWith.mock.lastCall![0] as ()=>void)();expect(buttons.every(b=>!b.disabled)).toBe(true);
    app.stop();expect(buttons.every(b=>b.disabled)).toBe(true);
  } finally {app.dispose();mock.getState.mockReturnValue(base);}
});

it('restarts selected development fixtures and clears renderer feedback on every switch and Retry', async () => {
  createRaf();
  const viewport = Object.assign(new EventTarget(), { classList: { toggle: vi.fn(), add: vi.fn(), remove: vi.fn() } });
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  expect(mock.advancedAppend.mock.lastCall![0].href).toBe('?explosion-lab');
  const select = mock.reviewConstructed.mock.lastCall![0] as (role: string) => void;
  for (const role of ['late', 'late', 'crate3', 'crate8', 'naval', 'crate3']) {
    const before = mock.resetFeedback.mock.calls.length;
    select(role);
    expect(mock.panelClose).toHaveBeenCalledTimes(before + 1);
    expect(mock.reviewFixture.mock.lastCall![2]).toBe(role);
    expect(mock.resetFeedback.mock.calls.length).toBe(before + 1);
  }
  const retry = mock.overlayConstructedWith.mock.lastCall![0] as () => void;
  retry(); expect(mock.reviewFixture.mock.lastCall![2]).toBe('crate3');
  expect(mock.resetFeedback.mock.calls.map(call=>call[0])).toEqual([0,1,2,3,4,5,6]);
  expect(mock.resetFeedback).toHaveBeenCalledTimes(7);
  app.dispose();
});


it('shares the approved playtest menu outside DEV while omitting engineering QA', () => {
  createRaf();vi.stubEnv('DEV', false);
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const viewport = Object.assign(new EventTarget(), { classList: { toggle: vi.fn(), add: vi.fn(), remove: vi.fn() } });
  try {
    const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
    expect(mock.reviewConstructed).toHaveBeenCalledOnce();expect(mock.reviewFixture).not.toHaveBeenCalled();
    expect(mock.panelConstructedWith).toHaveBeenCalledOnce(); expect(mock.qaConstructed).not.toHaveBeenCalled();
    expect(mock.advancedAppend).not.toHaveBeenCalled();
    expect(mock.manualSupportConstructed).toHaveBeenCalledOnce(); app.dispose();
  } finally { vi.unstubAllEnvs(); }
});

it.each([true,false])('guards manual support across lifecycle/menu states and consumes one request at a fixed tick (DEV %s)', async dev => {
  const raf = createRaf(), base = mock.getState(), config = structuredClone(gameData);
  vi.stubEnv('DEV', dev);
  const balance = structuredClone(config.catharsis!);
  balance.commanderSupport!.heavyRaid!.lastStand!.triggerPolicy = 'manualPlayerCall';
  delete balance.commanderSupport!.heavyRaid!.lastStand!.livingMgHpThresholds;
  const state = { ...base, elapsedSeconds: 60, tick: 3600, catharsis: { balance, trackHalfWidth: config.track.halfWidth },
    defenseTank: { ...startDefenseTank(50, 17, balance.defenseTank!), status: 'active', phase: 3, hp: 1000 },
    commanderSupport: { giantSeen: true, giantAtSeconds: null, airstrike: { status: 'ready', triggeredAtSeconds: null,
      bombAtSeconds: null, strikesCompleted: 0, targets: [], manual: { availableAtSeconds: 55, announcementAtSeconds: 55, ready: true } } } };
  mock.getState.mockReturnValue(state);
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } });
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets), internal = app as any;
  const press = mock.manualSupportConstructed.mock.lastCall![0] as () => boolean;
  expect(press()).toBe(false); await startGame(app); raf.frame(0);
  for (const flag of ['paused', 'hidden', 'contextLost']) { internal[flag] = true; expect(press()).toBe(false); internal[flag] = false; }
  Object.defineProperty(internal.tuningPanel, 'isOpen', { value: true, writable: true }); expect(press()).toBe(false); internal.tuningPanel.isOpen = false;
  state.squad.count = 0; expect(press()).toBe(false); state.squad.count = 3;
  state.defenseTank.status = 'defeated'; expect(press()).toBe(false); state.defenseTank.status = 'active';
  state.commanderSupport.airstrike.manual.ready = false; expect(press()).toBe(false); state.commanderSupport.airstrike.manual.ready = true;
  expect(press()).toBe(true); expect(press()).toBe(false); expect(mock.step).not.toHaveBeenCalled();
  raf.frame(1000 / 60); expect(mock.step.mock.lastCall![1].callAirSupport).toBe(true);
  state.commanderSupport.airstrike.status = 'waiting'; expect(press()).toBe(false);
  raf.frame(2000 / 60); expect(mock.step.mock.lastCall![1].callAirSupport).toBe(false);
  app.dispose(); mock.getState.mockReturnValue(base);
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

  it.each([38,47])('enables the Lv6 button and both request paths with only distant enemies at depth %s', async depth => {
    const s=setup();
    try {
      s.state.enemies[0].z=depth;
      s.state.progression={level:6,xp:0};
      s.state.squad={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
      await startGame(s.app);s.raf.frame(0);s.raf.frame(100);
      expect(mock.grenadeUpdate).toHaveBeenLastCalledWith(1,true,true,expect.any(Number));
      s.button();expect(s.control.takeGrenadeRequest()).toBe(true);
      s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(true);
      expect(s.state.grenade.inventory).toBe(1); // Only simulation consumes.
      s.raf.key('p');s.raf.frame(200);
      expect(mock.grenadeUpdate).toHaveBeenLastCalledWith(1,true,false,expect.any(Number));
      s.button();s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
    } finally {s.dispose();}
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

  it('blocks both request paths during a flight without consuming two reserve charges', async () => {
    const s=setup();
    try {
      await startGame(s.app);s.state.grenade.inventory=2;
      Object.assign(s.state.grenade,{flight:{startX:0,startZ:0,targetX:0,targetZ:12,
        startedAtSeconds:0,flightSeconds:.65,damageEnemyHp:9,blastRadius:4}});
      s.raf.key('q');s.button();expect(s.control.takeGrenadeRequest()).toBe(false);
      expect(s.state.grenade.inventory).toBe(2);
      s.state.grenade.flight=null;s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(true);
    } finally {s.dispose();}
  });

  it('blocks Q before start, paused, dead or empty; allows both empty fields and enemies in another lane', async () => {
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
      s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(true);
      const enemies=s.state.enemies;s.state.enemies=[];
      s.raf.key('q');s.button();expect(s.control.takeGrenadeRequest()).toBe(true);
      expect(s.state.grenade.inventory).toBe(1);
      s.state.enemies=enemies;s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(true);
      s.app.stop();s.raf.key('q');expect(s.control.takeGrenadeRequest()).toBe(false);
    } finally { s.dispose(); }
  });
});

describe('intentional gameplay startup', () => {
  it.each([
    ['mouse','desktop'],['Enter','desktop'],[' ','desktop'],
    ['touch','touch'],['pen','touch'],['','touch'],['unknown','touch'],['click','touch'],
  ] as const)('selects %s Start hints before audio resolves and preserves %s through Retry/mixed input',async (gesture,expected)=>{
    const raf=createRaf(),attributes=new Map<string,string>();
    let resolve!: (value:'running')=>void;
    vi.mocked(GameAudio.prototype.activate).mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const viewport=Object.assign(new EventTarget(),{
      setAttribute:(key:string,value:string)=>attributes.set(key,value),classList:{remove:vi.fn(),toggle:vi.fn()},
    });
    const app=new GameApp(viewport as unknown as HTMLElement,createConfigStore().store,level,{} as CharacterAssets);
    expect(attributes.get('data-input-presentation')).toBe('touch');app.start();
    const pointer=(pointerType:string)=>{
      const e=new Event('pointerdown',{cancelable:true});Object.defineProperty(e,'pointerType',{value:pointerType});viewport.dispatchEvent(e);
    };
    mock.startConstructed.mock.lastCall![0](expected);
    expect(attributes.get('data-input-presentation')).toBe(expected);
    // A competing gesture during optional audio activation cannot replace the first.
    pointer(expected==='desktop'?'touch':'mouse');raf.key('Enter');
    expect(attributes.get('data-input-presentation')).toBe(expected);
    expect(GameAudio.prototype.activate).toHaveBeenCalledOnce();
    resolve('running');await Promise.resolve();
    raf.key('p');raf.key('p');mock.overlayConstructedWith.mock.lastCall![0]();
    pointer(expected==='desktop'?'touch':'mouse');raf.key('a');
    expect(attributes.get('data-input-presentation')).toBe(expected);app.dispose();
  });
  it('renders a frozen initial world for a long wait, without observers, cues or steps', async () => {
    const raf = createRaf();
    const observe = vi.spyOn(GameAudio.prototype, 'observe');
    const music = vi.spyOn(GameAudio.prototype, 'updateMusic');
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
    expect(play).not.toHaveBeenCalled();
    expect(GameAudio.prototype.activate).not.toHaveBeenCalled();
    expect(mock.render.mock.calls.every(call => call[1] === 0)).toBe(true);
    expect(raf.key('Enter')).toBe(false);
    mock.startConstructed.mock.lastCall![0]('desktop');
    await Promise.resolve();
    raf.frame(400000);
    expect(mock.step).not.toHaveBeenCalled();
    expect(observe.mock.lastCall?.[3]).toBe(0);
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
    mock.startConstructed.mock.lastCall![0]('desktop');
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

  it('leaves unrelated controls usable, freezes during activation and ignores duplicate starts', async () => {
    const raf = createRaf();
    let resolve!: (value: 'running') => void;
    vi.mocked(GameAudio.prototype.activate).mockImplementation(() => new Promise(r => { resolve = r; }));
    const viewport = Object.assign(new EventTarget(), { classList: { remove: vi.fn(), toggle: vi.fn() } }) as unknown as HTMLElement;
    const app = new GameApp(viewport, createConfigStore().store, level, {} as CharacterAssets);
    const control = vi.fn();
    app.start();
    viewport.addEventListener('pointerdown', control);
    viewport.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    raf.key('Enter');
    raf.frame(5000);
    expect(control).toHaveBeenCalledOnce();
    expect(GameAudio.prototype.activate).not.toHaveBeenCalled();
    mock.startConstructed.mock.lastCall![0]('touch');
    mock.startConstructed.mock.lastCall![0]('desktop');
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

it('keeps a restored eight-level plan and sequential encounter policy when changing an unrelated DEV value',()=>{
  createRaf();const base=mock.getState();
  const config={...gameData,catharsis:CatharsisConfigSchema.parse(gameData.catharsis)} as unknown as GameConfig;
  const balance=structuredClone(config.catharsis!);balance.progression=structuredClone(progressionDefaults);
  balance.destroyer!.startPolicy='afterCarnival';
  mock.getState.mockReturnValue({...base,progression:{level:8,xp:0},catharsis:{balance,trackHalfWidth:config.track.halfWidth}});
  const store={getConfig:()=>config,subscribe:()=>()=>{}} as unknown as ConfigStore;
  const viewport=Object.assign(new EventTarget(),{classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
  try {
    const app=new GameApp(viewport as unknown as HTMLElement,store,level,{} as CharacterAssets);
    const [defaults,tune]=mock.panelConstructedWith.mock.lastCall!;tune({...defaults,groupSize:30});
    const passed=mock.setCatharsisBalance.mock.lastCall![0];
    expect(passed.progression).toEqual(balance.progression);expect(passed.destroyer.startPolicy).toBe('afterCarnival');
    expect(passed.postCapSurvival).toEqual(balance.postCapSurvival);expect(passed.groupSize).toBe(30);
    expect(mock.constructedWith).toHaveBeenCalledOnce();app.dispose();
  } finally {mock.getState.mockReturnValue(base);}
});

vi.mock('../src/ui/LaneHud', () => ({ LaneHud: class {
  constructor() { mock.laneConstructed(); }
} }));

vi.mock('../src/ui/XpHud', () => ({ XpHud: class {
  constructor(viewport: HTMLElement) { mock.xpConstructed(viewport); }
  update = vi.fn(); reset = vi.fn(); presentLevelUp = vi.fn(); dispose = vi.fn();
} }));

vi.mock('../src/ui/CombatControlStrip', () => ({ CombatControlStrip: class {
  progressionHost = stripDom.progressionHost;
  buttons = [0,1].map(() => Object.assign(new EventTarget(), {
    disabled:true, classList:{add:vi.fn(),remove:vi.fn()},setAttribute:vi.fn(),
    setPointerCapture:vi.fn(),hasPointerCapture:()=>false,releasePointerCapture:vi.fn(),
  }));
  constructor(viewport:HTMLElement){mock.stripConstructed(viewport);}
  dispose=vi.fn();
} }));

vi.mock('../src/ui/BattleInfoHud', () => ({ BattleInfoHud: class {
  update = vi.fn(); reset = vi.fn(); dispose = vi.fn();
} }));

vi.mock('../src/ui/GrenadeButton', () => ({ GrenadeButton: class {
  constructor(_viewport: unknown, activate: unknown) { mock.grenadeConstructed(activate); }
  update = mock.grenadeUpdate; reset = vi.fn(); dispose = vi.fn();
} }));

vi.mock('../src/ui/SupplyRewardTransfer', () => ({SupplyRewardTransfer: class {
  present=vi.fn();update=vi.fn();reset=vi.fn();dispose=vi.fn();
}}));

vi.mock('../src/ui/HudActions', () => ({ HudActions: class {
  element = {} as HTMLElement;
  constructor(_viewport: HTMLElement, togglePaused: () => void) {
    mock.hudConstructedWith(togglePaused);
  }
  setPaused = mock.hudSetPaused;
  dispose = mock.hudDispose;
} }));

vi.mock('../src/ui/TuningPanel', () => ({ TuningPanel: class {
  reviewControlsHost = {} as HTMLElement;
  menuActionsHost = {append:vi.fn()} as unknown as HTMLElement;
  advancedControlsHost = {prepend:vi.fn(),append:mock.advancedAppend} as unknown as HTMLElement;
  private open = false;
  close() {mock.panelClose();if(this.open){this.open=false;this.onOpenChange(false);}}
  constructor(_viewport: HTMLElement, defaults: unknown, onChange: unknown, private onOpenChange:(open:boolean)=>void) {
    mock.panelAnchor(_viewport); mock.panelConstructedWith(defaults, onChange,onOpenChange);
  }
  setValues = mock.panelSetValues;
  toggle() {mock.panelToggle();this.open=!this.open;this.onOpenChange(this.open);}
  openAdvanced() {if(!this.open){this.open=true;this.onOpenChange(true);}}
  dispose = mock.panelDispose;
} }));

it('waits for the tank finale, freezes it on Pause and uses PLAY AGAIN to reset the same app', async () => {
  const raf = createRaf(), base = mock.getState();
  const silenceWeapons = vi.spyOn(GameAudio.prototype, 'silenceWeapons');
  const config = { ...gameData, catharsis: CatharsisConfigSchema.parse(gameData.catharsis) } as unknown as GameConfig;
  const viewport = Object.assign(new EventTarget(), { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } });
  const store = { getConfig: () => config, subscribe: () => () => {} } as unknown as ConfigStore;
  const app = new GameApp(viewport as unknown as HTMLElement, store, level, {} as CharacterAssets);
  await startGame(app); raf.frame(0);
  const tank = startDefenseTank(0, 17, gameData.catharsis!.defenseTank!);
  Object.assign(tank, { status: 'defeated', hp: 0, phase: 3, defeatedAtSeconds: 90 });
  const stats = { gruntKills: 5, heavyKills: 3, giantKills: 1, shotsFired: 100, shotsHit: 35, grenadesUsed: 2 };
  mock.getState.mockReturnValue({ ...base, catharsis: { balance: gameData.catharsis!, trackHalfWidth: 3.2 },
    player: { ...base.player, selectedLane: 2 }, projectiles: [],
    weapons: {nextProjectileId: 1, rifleMemberCooldowns: [0,0,0], rifleCooldownRemainingSeconds: 0, rocketCooldownRemainingSeconds: 0},
    progression: { level: 9, xp: 0 }, defenseTank: tank, combatStats: stats });
  raf.frame(100); expect(tankUi.show).not.toHaveBeenCalled();
  const lethalSteps = mock.step.mock.calls.length;
  raf.key('p'); raf.frame(10000); expect(tankUi.show).not.toHaveBeenCalled();
  raf.key('p'); raf.frame(10250);
  for (let i = 1; i <= 14; i++) raf.frame(10250 + i * 250);
  expect(mock.victory).toHaveBeenCalled(); expect(tankUi.show).not.toHaveBeenCalled();
  expect(silenceWeapons).toHaveBeenCalledOnce(); expect(mock.step).toHaveBeenCalledTimes(lethalSteps);
  raf.key('p'); expect(mock.victory).toHaveBeenLastCalledWith(expect.any(Number), true);
  raf.frame(20000); expect(tankUi.show).not.toHaveBeenCalled();
  raf.key('p'); raf.frame(20250);
  mock.victory.mockReturnValueOnce(true); raf.frame(20500);
  expect(tankUi.show).toHaveBeenCalledWith(stats, 90); expect(mock.overlayVisible).toHaveBeenLastCalledWith(false);
  mock.getState.mockReturnValue(base); tankUi.replay!(); expect(tankUi.reset).toHaveBeenCalled();
  expect(mock.constructedWith).toHaveBeenCalledTimes(2); app.dispose();
  silenceWeapons.mockRestore();
});

it('keeps the decorative Defense tableau silent, bounded, hidden-aware and independent of simulation', async () => {
  const raf=createRaf(), base=mock.getState();
  const config={...gameData,catharsis:CatharsisConfigSchema.parse(gameData.catharsis)} as unknown as GameConfig;
  const state={...base,elapsedSeconds:0,tick:0,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}};
  mock.getState.mockReturnValue(state);
  const viewport=Object.assign(new EventTarget(),{classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
  const store={getConfig:()=>config,subscribe:()=>()=>{}} as unknown as ConfigStore;
  const app=new GameApp(viewport as unknown as HTMLElement,store,level,{} as CharacterAssets);
  const initial=structuredClone(state);
  try {
    app.start(); for(let i=0;i<61;i++)raf.frame(i*1000/60);
    expect(mock.dioramaRender.mock.calls.length).toBeLessThanOrEqual(31);
    expect(mock.dioramaRender).toHaveBeenCalled();expect(mock.step).not.toHaveBeenCalled();
    expect(state).toEqual(initial);expect(GameAudio.prototype.activate).not.toHaveBeenCalled();
    expect(mock.missionIntro).not.toHaveBeenCalled();expect(localStorage.getItem('topwar:session:v1:dev')).toBeNull();
    const draws=mock.dioramaRender.mock.calls.length;
    Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));raf.frame(20000);
    expect(mock.dioramaRender).toHaveBeenCalledTimes(draws);
    Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));raf.frame(30000);
    expect(mock.dioramaRender.mock.lastCall![1]).toBeLessThan(1100);
    const ageBeforeSleep=mock.dioramaRender.mock.lastCall![1];
    Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
    // Real browsers may deliver no RAF at all while hidden.
    Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));raf.frame(90000);
    expect(mock.dioramaRender.mock.lastCall![1]).toBe(ageBeforeSleep);
    mock.startConstructed.mock.lastCall![0]('touch');await Promise.resolve();
    expect(mock.resetFeedback).toHaveBeenCalledOnce();expect(mock.missionIntro).toHaveBeenCalledOnce();
    raf.frame(31000);raf.frame(31020);raf.frame(31040);expect(mock.step).toHaveBeenCalled();
    const drawsAtStart=mock.dioramaRender.mock.calls.length;
    mock.overlayConstructedWith.mock.lastCall![0]();raf.frame(32000);
    expect(mock.dioramaRender).toHaveBeenCalledTimes(drawsAtStart);
  } finally {app.dispose();mock.getState.mockReturnValue(base);}
});

it('initiates audio then optional fullscreen synchronously once, before audio resolves; only first restored Resume retries', async () => {
  const raf=createRaf(),order:string[]=[];
  Object.assign(window,{innerWidth:390,innerHeight:844});
  vi.stubGlobal('navigator',{maxTouchPoints:1});
  let resolve!:(value:'running')=>void;
  vi.mocked(GameAudio.prototype.activate).mockImplementation(()=>{order.push('audio');return new Promise(r=>{resolve=r;});});
  const requestFullscreen=vi.fn(()=>{order.push('fullscreen');return Promise.resolve();});
  const viewport=Object.assign(new EventTarget(),{requestFullscreen,classList:{add:vi.fn(),remove:vi.fn(),toggle:vi.fn()}});
  const app=new GameApp(viewport as unknown as HTMLElement,createConfigStore().store,level,{} as CharacterAssets);
  try {
    app.start();mock.startConstructed.mock.lastCall![0]('touch');mock.startConstructed.mock.lastCall![0]('touch');
    expect(order).toEqual(['audio','fullscreen']);expect(mock.step).not.toHaveBeenCalled();
    resolve('running');await Promise.resolve();await Promise.resolve();
    raf.key('p');(app as any).resumeFullscreenPending=true;
    order.length=0;raf.key('p');expect(order).toEqual(['audio','fullscreen']);
    raf.key('p');raf.key('p');expect(requestFullscreen).toHaveBeenCalledTimes(2);
    mock.overlayConstructedWith.mock.lastCall![0]();expect(requestFullscreen).toHaveBeenCalledTimes(2);
  } finally {app.dispose();}
});
