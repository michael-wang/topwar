import { createAirSupportPlaytest } from './TankPlaytest';
import { createPlaytestScenario, isPlaytestScene } from './PlaytestScenarios';
import { FieldObserver } from '../ui/FieldObserver';
import type { ObserverPortraits } from '../ui/ObserverPortraits';
import { ProgressionLevelObserver } from '../presentation/ProgressionLevelUp';
import { BattleInfoHud } from '../ui/BattleInfoHud';
import { CombatControlStrip } from '../ui/CombatControlStrip';
import { XpHud } from '../ui/XpHud';
import { FixedStepLoop } from '../core/FixedStepLoop';
import type { ConfigStore } from '../config/ConfigStore';
import type { GameConfig } from '../config/configSchema';
import type { LevelDefinition } from '../level/LevelDefinition';
import { GameRenderer } from '../rendering/GameRenderer';
import type { CharacterAssets } from '../rendering/CharacterAssets';
import type { GameRenderState } from '../rendering/RenderState';
import { Simulation } from '../simulation/Simulation';
import { damageFeedback, squadDefenseValue } from './combatFeedback';
import { DamageFlashOverlay } from '../ui/DamageFlashOverlay';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { TankBossHud } from '../ui/TankBossHud';
import { TankEntranceHud } from '../ui/TankEntranceHud';
import { ArtilleryEmergencyHud } from '../ui/ArtilleryEmergencyHud';
import { personalArtilleryThreat } from '../presentation/ArtilleryEmergency';
import { VictoryCelebration } from '../presentation/VictoryCelebration';
import type { SimulationFrameState } from '../simulation/SimulationState';
import { StageClearOverlay } from '../ui/StageClearOverlay';
import { TANK_DEATH_MS, TANK_EXPLOSION_TIMES_MS } from '../rendering/DefenseTankRenderer';
import { GameAudio } from '../audio/GameAudio';
import { defaultRuntimeTuning, type RuntimeTuning } from './runtimeTuning';
import { SupplyRewardTransfer } from '../ui/SupplyRewardTransfer';
import { PauseOverlay } from '../ui/PauseOverlay';
import { TuningPanel } from '../ui/TuningPanel';
import { HudActions } from '../ui/HudActions';
import { PerfDiagnostics } from './PerfDiagnostics';
import { PerfHud } from '../ui/PerfHud';
import { projectRenderState } from './projectRenderState';
import { LaneStepInput } from '../input/LaneStepInput';
import { createDevReviewFixture, type DevReviewFixture } from './DevReviewFixtures';
import { ManualAirSupportButton } from '../ui/ManualAirSupportButton';
import { supportBossHpThreshold } from '../simulation/commanderSupport';
import { DevReviewControls } from '../ui/DevReviewControls';
import { GameStartOverlay } from '../ui/GameStartOverlay';
import { GrenadeButton } from '../ui/GrenadeButton';
import { grenadeTarget } from '../simulation/grenade';
import { progressionStage } from '../simulation/progression';
import { clearCheckpoint, readCheckpoint, simulationFromCheckpoint, writeCheckpoint,
  type CheckpointRead, type SessionCheckpoint } from './SessionCheckpoint';
import { SessionRecovery } from '../ui/SessionRecovery';
import { DevFps } from '../ui/DevFps';
import { DevLifecycle } from './DevLifecycle';
import { ScreenWakeLock } from './ScreenWakeLock';
import { QaPanel } from '../ui/QaPanel';
import { createQaStressFixture, advanceQaPreparation, qaSimulationTuning } from './QaStressFixture';

function isInteractivePauseTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean;
    closest?: (selector: string) => Element | null } | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (['input', 'button', 'select', 'textarea', 'summary', 'option'].includes(
    element.tagName?.toLowerCase() ?? '')) return true;
  return Boolean(element.closest?.('button,input,select,textarea,summary,a[href],'
    + '[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"]'));
}

export class GameApp {
  private readonly renderer: GameRenderer;
  private readonly fixedStepLoop = new FixedStepLoop();
  private simulation: Simulation;
  private readonly gameOverOverlay: GameOverOverlay;
  private readonly tankBossHud: TankBossHud;
  private readonly tankEntranceHud: TankEntranceHud;
  private readonly artilleryEmergencyHud: ArtilleryEmergencyHud;
  private readonly stageClearOverlay: StageClearOverlay;
  private tankDeathAtMs: number | null = null;
  private stageClearAtMs: number | null = null;
  private celebration: VictoryCelebration | null = null;
  private lastCombatProjectiles: SimulationFrameState['projectiles'] | undefined;
  private tankDeathCue = -1;
  private readonly damageFlash: DamageFlashOverlay;
  private readonly audio: GameAudio;
  private readonly startOverlay: GameStartOverlay;
  private readonly pauseOverlay: PauseOverlay;
  private readonly hudActions: HudActions;
  private readonly tuningPanel: TuningPanel | null;
  private readonly laneInput: LaneStepInput | null;
  private readonly progressionObserver = new ProgressionLevelObserver();
  private readonly controlStrip: CombatControlStrip | null;
  private readonly xpHud: XpHud | null;
  private readonly battleInfo: BattleInfoHud | null;
  private readonly grenadeButton: GrenadeButton | null;
  private readonly fieldObserver: FieldObserver | null;
  private readonly supplyTransfer: SupplyRewardTransfer | null;
  private grenadeRequested = false;
  private airSupportRequested = false;
  private readonly manualSupportButton: ManualAirSupportButton | null;
  private readonly unsubscribeConfig: () => void;
  private config: Readonly<GameConfig>;
  private targetX: number;
  private readonly runtimeDefaults: RuntimeTuning;
  private runtimeTuning: RuntimeTuning;
  private frameId: number | null = null;
  private previousFrameTimestampMs: number | null = null;
  private presentationMs = 0;
  private previousDefenseValue: bigint;
  private previousWeaponFamily: 'rifle' | 'machineGun' = 'rifle';
  private lastRunSeed: number | null = null;
  private fatalPresentationUntilMs = -Infinity;
  private paused = false;
  private running = false;
  private startup: 'recovering' | 'awaiting-start' | 'activating' | 'started' = 'awaiting-start';
  private startGeneration = 0;
  private consumeStartClick = false;
  private disposed = false;
  private readonly perf: PerfDiagnostics | null;
  private readonly perfHud: PerfHud | null;
  private readonly devReview: DevReviewControls | null;
  private devReviewVisualSalt=-1;
  private devReviewFixture: DevReviewFixture | null = null;
  private historicalAirSupportReview = false;
  private readonly fps: DevFps | null;
  private readonly lifecycle: DevLifecycle | null;
  private readonly wakeLock = new ScreenWakeLock();
  private recovery: SessionRecovery | null = null;
  private recoveryPending: SessionCheckpoint | null = null;
  private restored = false;
  private sessionLevel: LevelDefinition;
  private hidden = false;
  private contextLost = false;
  private checkpointNotice: HTMLElement | null = null;
  private clearedFinishedCheckpoint = false;
  private readonly qaPanel:QaPanel|null;
  private readonly authoredConfig:Readonly<GameConfig>;
  private qaSession=false;
  private qaSleepActive=false;
  private qaPreparing=false;
  private qaGeneration=0;
  private qaHidden=false;

  constructor(private readonly viewport: HTMLElement, configStore: ConfigStore,
    private readonly level: LevelDefinition, assets: CharacterAssets, perfEnabled = false,
    audio = new GameAudio(), portraits?: ObserverPortraits,
    saved: CheckpointRead = { status: 'empty' },
    earlyRecovery?: { dialog: SessionRecovery; continueGame: boolean }) {
    this.sessionLevel = level;
    this.lifecycle = import.meta.env.DEV ? new DevLifecycle(saved.status,
      saved.checkpoint?.paused, saved.checkpoint?.hidden) : null;
    this.viewport.setAttribute?.('data-input-presentation', 'touch');
    this.perf = perfEnabled ? new PerfDiagnostics() : null;
    this.perfHud = perfEnabled ? new PerfHud(viewport) : null;
    this.config = configStore.getConfig();
    this.authoredConfig=structuredClone(this.config);
    if (this.config.catharsis?.defenseMode) this.viewport.classList.add('beachhead-defense');
    this.runtimeDefaults = defaultRuntimeTuning(this.config, level);
    this.runtimeTuning = { ...this.runtimeDefaults };
    this.simulation = this.createSimulation();
    const initialState = this.simulation.getState();
    this.targetX = initialState.player.x;
    this.previousDefenseValue = squadDefenseValue(initialState.squad, this.config.tiers.mergeCount);
    this.previousWeaponFamily = initialState.progression && initialState.catharsis
      ? progressionStage(initialState.progression.level, initialState.catharsis.balance.progression).weaponFamily : 'rifle';
    this.renderer = new GameRenderer(viewport, assets);
    this.audio = audio;
    this.fieldObserver = this.config.catharsis?.defenseMode ? new FieldObserver(viewport, this.audio, portraits) : null;
    this.startOverlay = new GameStartOverlay(viewport);
    this.pauseOverlay = new PauseOverlay(viewport, () => { if (this.paused) this.togglePaused(); });
    this.controlStrip = this.config.catharsis?.defenseMode ? new CombatControlStrip(viewport) : null;
    this.xpHud = this.controlStrip ? new XpHud(this.controlStrip.progressionHost) : null;
    this.battleInfo = this.config.catharsis?.defenseMode ? new BattleInfoHud(viewport) : null;
    this.grenadeButton = this.config.catharsis?.defenseMode ? new GrenadeButton(viewport, this.requestGrenade) : null;
    this.manualSupportButton = this.config.catharsis?.defenseMode
      ? new ManualAirSupportButton(viewport, this.requestAirSupport) : null;
    this.supplyTransfer=this.grenadeButton ? new SupplyRewardTransfer(viewport,this.grenadeButton,
      (x,z,now)=>this.renderer.projectSupplyPosition(x,z,now)) : null;
    this.hudActions = new HudActions(viewport, () => this.togglePaused());
    this.tuningPanel = new TuningPanel(viewport, this.runtimeDefaults, (values) => {
      if (this.startup === 'recovering' || this.recovery?.blocking) return;
      this.runtimeTuning = values;
      // Tuning an exposed value must not replace a restored historical plan or
      // encounter policy with the current game's authored configuration.
      const balance = this.simulation.getFrameState().catharsis?.balance ?? this.config.catharsis;
      if (balance) this.simulation.setCatharsisBalance({ ...balance,
        groupSize: values.groupSize ?? balance.groupSize,
        enemyVisualScale: values.enemyVisualScale!, gruntSpeed: values.gruntSpeed!,
        heavyHp: values.heavyHp!, heavySpeed: values.heavySpeed!, heavyChance: values.heavyChance! });
    }, open => {
      this.pauseOverlay.setMenuOpen(open);
      if (open && !this.paused) this.togglePaused();
    });
    const selectReview = (role: DevReviewFixture | null): void => {
      if (this.startup === 'recovering' || this.recovery?.blocking) return;
      this.exitSleepTest();
      this.devReviewFixture = role;
      this.devReview?.setSelected(role ?? undefined);
      if (role === null || this.restored || this.historicalAirSupportReview) {
        // An explicit new scene uses current authored data; Continue keeps the saved data intact.
        this.config = this.authoredConfig; this.runtimeTuning = defaultRuntimeTuning(this.config, this.level);
        this.tuningPanel?.setValues(this.runtimeTuning);
      }
      this.historicalAirSupportReview = false;
      this.retry();
    };
    this.devReview = this.config.catharsis?.defenseMode
      ? new DevReviewControls(this.tuningPanel!.reviewControlsHost, selectReview) : null;
    if (import.meta.env.DEV && this.config.catharsis?.defenseMode) {
      const lab = document.createElement('a');
      lab.href = '?explosion-lab'; lab.target = '_blank'; lab.rel = 'noopener';
      lab.textContent = '爆炸視覺比較（DEV）';
      lab.style.cssText = 'display:block;padding:12px;color:#ffe0a0';
      this.tuningPanel.advancedControlsHost.append(lab);
      const dense = document.createElement('button');
      dense.type = 'button'; dense.textContent = 'BOSS 密集輾壓'; dense.className = 'dev-dense-tank';
      dense.addEventListener('click', () => { selectReview('boss-dense'); dense.blur(); });
      this.tuningPanel.advancedControlsHost.prepend(dense);
    }

    this.damageFlash = new DamageFlashOverlay(viewport);
    this.gameOverOverlay = new GameOverOverlay(viewport, () => this.retry());
    this.tankBossHud = new TankBossHud(viewport);
    this.tankEntranceHud = new TankEntranceHud(viewport, () => this.audio.play('bossAlarm'));
    this.artilleryEmergencyHud = new ArtilleryEmergencyHud(viewport, x => this.renderer.projectPlayerWarningPosition(x));
    this.stageClearOverlay = new StageClearOverlay(viewport, () => this.retry());
    this.laneInput = this.config.catharsis?.defenseMode ? new LaneStepInput(viewport, window,
      (direction) => {
        if (!this.running || this.startup !== 'started' || this.paused || this.simulation.getFrameState().squad.count === 0) return false;
        if (this.stageClearAtMs !== null) return false;
        return this.celebration ? this.celebration.stepLane(direction) : this.simulation.stepLane(direction);
      }, this.controlStrip!.buttons) : null;
    this.unsubscribeConfig = configStore.subscribe((config) => { this.config = config; });
    this.fps = import.meta.env.DEV ? new DevFps(viewport) : null;
    this.qaPanel=import.meta.env.DEV && this.tuningPanel && this.config.catharsis?.defenseMode ? new QaPanel(this.tuningPanel.advancedControlsHost,{
      sleep:()=>{void this.beginSleepTest();},reload:()=>this.reloadTest(),exit:()=>this.exitSleepTest(),
    },viewport):null;
    if (this.qaPanel) this.wakeLock.observe(status => this.qaPanel?.setWake(status));
    if (saved.status === 'valid' || saved.status === 'invalid') {
      this.startup = 'recovering';
      this.recoveryPending = saved.checkpoint ?? null;
      this.recovery = earlyRecovery?.dialog ?? new SessionRecovery(viewport, saved.status === 'valid', this.chooseRecovery);
      if (earlyRecovery) this.chooseRecovery(earlyRecovery.continueGame);
    }
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameApp');
    if (this.running) return;

    this.running = true;
    this.previousFrameTimestampMs = null;
    this.renderer.startResizeHandling();
    if (this.startup === 'awaiting-start') this.startOverlay.show();
    if (this.startup === 'started') this.startInputs();
    this.viewport.addEventListener?.('pointerdown', this.onStartPointerDown, true);
    this.viewport.addEventListener?.('click', this.onStartClick, true);
    window.addEventListener?.('keydown', this.onStartKeyDown, true);
    window.addEventListener?.('keydown', this.onPauseKeyDown);
    window.addEventListener?.('keydown', this.onActiveItemKeyDown);
    document.addEventListener?.('visibilitychange', this.onVisibility);
    document.addEventListener?.('freeze', this.onFreeze);
    document.addEventListener?.('resume', this.onResumeLifecycle);
    window.addEventListener?.('pagehide', this.onPageHide);
    window.addEventListener?.('pageshow', this.onPageShow);
    const canvas = this.viewport.querySelector?.('canvas');
    canvas?.addEventListener('webglcontextlost', this.onContextLost);
    canvas?.addEventListener('webglcontextrestored', this.onContextRestored);
    this.hidden = document.visibilityState === 'hidden';
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    this.qaGeneration++;this.qaPreparing=false;
    if (!this.running) return;

    this.running = false;
    this.wakeLock.setActive(false);
    document.removeEventListener?.('visibilitychange', this.onVisibility);
    document.removeEventListener?.('freeze', this.onFreeze);
    document.removeEventListener?.('resume', this.onResumeLifecycle);
    window.removeEventListener?.('pagehide', this.onPageHide);
    window.removeEventListener?.('pageshow', this.onPageShow);
    const canvas = this.viewport.querySelector?.('canvas');
    canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.grenadeRequested = false; this.airSupportRequested = false;
    this.startOverlay.dispose();
    this.startGeneration++;
    if (this.startup === 'activating') this.startup = 'awaiting-start';
    this.viewport.removeEventListener?.('pointerdown', this.onStartPointerDown, true);
    this.viewport.removeEventListener?.('click', this.onStartClick, true);
    window.removeEventListener?.('keydown', this.onStartKeyDown, true);
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    window.removeEventListener?.('keydown', this.onPauseKeyDown);
    window.removeEventListener?.('keydown', this.onActiveItemKeyDown);
    this.laneInput?.stop();
    this.paused = false;
    this.pauseOverlay.setVisible(false);
    this.hudActions.setPaused(false);
    this.viewport.classList?.remove('game-paused');
    this.renderer.stopResizeHandling();
    this.fieldObserver?.reset();
    this.artilleryEmergencyHud.reset();
    this.audio.silenceMusic();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.unsubscribeConfig();
    this.laneInput?.dispose();
    this.xpHud?.dispose();
    this.controlStrip?.dispose();
    this.battleInfo?.dispose();
    this.supplyTransfer?.dispose();this.grenadeButton?.dispose(); this.manualSupportButton?.dispose();
    this.gameOverOverlay.dispose();
    this.tankBossHud.dispose(); this.stageClearOverlay.dispose();
    this.tankEntranceHud.dispose();
    this.artilleryEmergencyHud.dispose();
    this.tuningPanel?.dispose();
    this.hudActions.dispose();
    this.devReview?.dispose();
    this.pauseOverlay.dispose();
    this.damageFlash.dispose();
    this.fieldObserver?.dispose();
    this.audio.dispose();
    this.fps?.dispose(); this.lifecycle?.dispose(); this.recovery?.dispose(); this.checkpointNotice?.remove();
    this.wakeLock.dispose();
    this.qaGeneration++;this.qaPanel?.dispose();
    this.perfHud?.dispose();
    this.renderer.dispose();
    this.celebration = null; this.lastCombatProjectiles = undefined;
    this.disposed = true;
  }

  private retry(): void {
    if (this.disposed) throw new Error('Cannot retry a disposed GameApp');
    if (this.startup === 'recovering' || this.recovery?.blocking) return;
    if(this.qaSleepActive||this.qaPreparing)return;
    this.tuningPanel?.close();
    this.qaSession=false;
    clearCheckpoint(); this.checkpointNotice?.remove(); this.checkpointNotice = null;
    this.clearedFinishedCheckpoint = false; this.sessionLevel = this.level;
    this.celebration = null; this.lastCombatProjectiles = undefined; this.stageClearAtMs = null;
    this.restored = false;
    this.fps?.reset();
    this.laneInput?.stop();
    this.simulation = this.createSimulation();
    this.perf?.reset();
    this.perfHud?.reset();
    const initialState = this.simulation.getState();
    this.targetX = initialState.player.x;
    this.previousDefenseValue = squadDefenseValue(initialState.squad, this.config.tiers.mergeCount);
    this.previousWeaponFamily = initialState.progression && initialState.catharsis
      ? progressionStage(initialState.progression.level, initialState.catharsis.balance.progression).weaponFamily : 'rifle';
   
    this.paused = this.hidden || this.contextLost;
    if (this.paused) this.viewport.classList?.add('game-paused');
    else this.viewport.classList?.remove('game-paused');
    this.startInputs();
    this.fixedStepLoop.reset();
    this.previousFrameTimestampMs = null;
    this.presentationMs = 0;
    this.fatalPresentationUntilMs = -Infinity;
    this.pauseOverlay.setVisible(this.paused);
    this.hudActions.setPaused(this.paused);
    this.gameOverOverlay.setVisible(false);
    this.tankBossHud.reset(); this.stageClearOverlay.reset(); this.tankDeathAtMs = null; this.tankDeathCue = -1;
    this.stageClearOverlay.setDevPreview(this.devReviewFixture === 'victory');
    this.stageClearAtMs = null;
    this.tankEntranceHud.reset();
    this.artilleryEmergencyHud.reset();
    this.damageFlash.reset();
    this.fieldObserver?.reset();
    this.audio.resetObservation();
    if (!this.devReviewFixture) this.fieldObserver?.startMission(initialState.elapsedSeconds);
    this.xpHud?.reset();
    this.battleInfo?.reset();
    this.supplyTransfer?.reset();this.grenadeButton?.reset(); this.manualSupportButton?.reset();
    this.grenadeRequested = false; this.airSupportRequested = false;
    this.progressionObserver.reset();
    if (this.devReviewFixture && initialState.progression && initialState.catharsis) {
      // Selecting a QA loadout is initialization, not an earned level-up.
      this.progressionObserver.observe(initialState.progression.level);
      this.xpHud?.update(initialState.progression, initialState.catharsis.balance.progression, 0);
    }
    if (initialState.progression && initialState.catharsis) this.battleInfo?.update(initialState.progression, initialState.catharsis.balance.progression, this.presentationMs);
    this.renderer.resetFeedback(this.devReviewFixture ? ++this.devReviewVisualSalt : 0);
    this.syncWakeLock();
  }

  private createSimulation(): Simulation {
    const randomWord = new Uint32Array(1);
    crypto.getRandomValues(randomWord);
    const seed = randomWord[0] === this.lastRunSeed
      ? (randomWord[0] + 1) >>> 0 : randomWord[0];
    this.lastRunSeed = seed;
    const balance = this.historicalAirSupportReview ? this.simulation.getState().catharsis?.balance : this.config.catharsis;
    const options = { seed, level: this.level,
      ...(this.config.catharsis ? { catharsis: { trackHalfWidth: this.config.track.halfWidth,
        balance: { ...balance!, enemyVisualScale: this.runtimeTuning.enemyVisualScale!,
          groupSize: this.runtimeTuning.groupSize ?? this.config.catharsis.groupSize,
          gruntSpeed: this.runtimeTuning.gruntSpeed!, heavyHp: this.runtimeTuning.heavyHp!,
          heavySpeed: this.runtimeTuning.heavySpeed!, heavyChance: this.runtimeTuning.heavyChance! } } } : {}),
      collisionDiagnostics: this.perf?.counters,
      startSquad: this.config.player.startSquad,
      startRocketCount: this.config.player.startRocketCount,
      tiers: this.config.tiers };
    if (this.historicalAirSupportReview && this.devReviewFixture === 'air-support')
      return createAirSupportPlaytest(options, this.runtimeTuning.fireRate);
    if (isPlaytestScene(this.devReviewFixture)) return createPlaytestScenario(options, this.runtimeTuning.fireRate, this.devReviewFixture);
    if (import.meta.env.DEV && this.devReviewFixture)
      return createDevReviewFixture(options, this.runtimeTuning.fireRate, this.devReviewFixture);
    return new Simulation(options);
  }

  private startInputs(): void {
    if (!this.running || this.startup !== 'started' || this.paused || this.hidden || this.contextLost || this.recovery?.blocking || this.stageClearAtMs !== null) return;
    if (this.laneInput) {
      if (this.simulation.getFrameState().squad.count > 0) this.laneInput.start();
    }
  }

  private takeGrenadeRequest(): boolean {
    const requested = this.grenadeRequested;
    this.grenadeRequested = false;
    return requested;
  }

  private takeAirSupportRequest(): boolean { const requested = this.airSupportRequested; this.airSupportRequested = false; return requested; }
  private readonly requestAirSupport = (): boolean => {
    if (!this.running || this.startup !== 'started' || this.paused || this.hidden || this.contextLost
      || this.recovery?.blocking || this.tuningPanel?.isOpen || this.airSupportRequested) return false;
    const s = this.simulation.getFrameState(), air = s.commanderSupport?.airstrike;
    if (s.catharsis?.balance.commanderSupport?.heavyRaid?.lastStand?.triggerPolicy !== 'manualPlayerCall'
      || !air?.manual?.ready || air.status !== 'ready' || !s.squad.count || s.defenseTank?.status !== 'active' || s.defenseTank.phase !== 3) return false;
    this.airSupportRequested = true; void this.audio.activate(); return true;
  };

  private readonly requestGrenade = (): void => {
    if (!this.running || this.startup !== 'started' || this.paused || this.grenadeRequested) return;
    const state = this.simulation.getFrameState();
    if (state.defenseTank?.status === 'defeated') return;
    if (state.squad.count > 0 && (state.grenade?.inventory ?? 0) > 0 && !state.grenade?.flight
      && state.catharsis && grenadeTarget(state, state.catharsis.balance.grenade))
      this.grenadeRequested = true;
  };

  private readonly onActiveItemKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyQ' || event.repeat || isInteractivePauseTarget(event.target)
      || (event.target as Element | null)?.closest?.('.tuning-panel')) return;
    this.requestGrenade();
  };

  private async beginGameplay(presentation: 'desktop' | 'touch' = 'touch'): Promise<void> {
    if (!this.running || this.startup !== 'awaiting-start' || this.recovery?.blocking) return;
    const generation = this.startGeneration;
    this.startup = 'activating';
    // Initial Start owns session hints only; later input and Retry never change them.
    this.viewport.setAttribute?.('data-input-presentation', presentation);
    this.startOverlay.setActivating();
    try { await this.audio.activate(); } catch { /* Optional audio cannot block play. */ }
    if (!this.running || this.disposed || generation !== this.startGeneration) return;
    this.fixedStepLoop.reset();
    this.previousFrameTimestampMs = null;
    this.presentationMs = 0;
    this.audio.resetObservation();
    this.startup = 'started';
    if (!this.restored && !this.devReviewFixture) this.fieldObserver?.startMission(this.simulation.getFrameState().elapsedSeconds);
    this.startOverlay.finish();
    if (this.hidden || this.contextLost) this.setPaused(true);
    this.startInputs();
    this.renderer.preparePresentation();
    this.syncWakeLock();
  }

  private readonly onStartPointerDown = (event: PointerEvent): void => {
    if (this.startup === 'recovering' || this.recovery?.blocking) return;
    if (this.startup === 'started') {
      if (this.audio.needsResume) void this.audio.activate();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.consumeStartClick = true;
    void this.beginGameplay(event.pointerType === 'mouse' ? 'desktop' : 'touch');
  };

  private readonly onStartClick = (event: MouseEvent): void => {
    if (this.startup === 'recovering' || this.recovery?.blocking) return;
    if (this.startup === 'started' && !this.consumeStartClick) return;
    this.consumeStartClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Supports assistive-technology button activation without a pointerdown.
    void this.beginGameplay();
  };

  private readonly onStartKeyDown = (event: KeyboardEvent): void => {
    if (this.startup === 'recovering' || this.recovery?.blocking) return;
    if (this.startup === 'started') {
      if (!event.repeat && this.audio.needsResume) void this.audio.activate();
      return;
    }
    event.stopImmediatePropagation();
    if (event.key !== 'Enter' && ![' ', 'Space', 'Spacebar'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) void this.beginGameplay('desktop');
  };

  private readonly onPauseKeyDown = (event: KeyboardEvent): void => {
    if (this.startup !== 'started' || this.recovery?.blocking) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (!event.repeat) {
        event.preventDefault();
        this.tuningPanel?.toggle();
      }
      return;
    }
    const isSpace = key === ' ' || key === 'space' || key === 'spacebar';
    if (event.repeat || (key !== 'p' && !isSpace) || isInteractivePauseTarget(event.target)) return;
    if (isSpace) event.preventDefault();
    this.togglePaused();
  };


  private togglePaused(): void {
    if (!this.running || this.startup !== 'started' || this.recovery?.blocking) return;
    if(this.qaSleepActive||this.qaPreparing)return;
    if (this.paused && (this.hidden || this.contextLost)) return;
    if (this.paused) void this.audio.activate(); // Called within the Resume gesture.
    this.setPaused(!this.paused);
    if (this.paused) this.saveCheckpoint('pause');
  }

  private setPaused(paused: boolean): void {
    if (!paused) this.tuningPanel?.close();
    this.paused = paused;
    this.fps?.reset(paused ? 'PAUSED' : '—');
    this.viewport.classList?.toggle('game-paused', this.paused);
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    if (this.paused) {
      this.audio.silenceArtillery(); this.audio.syncSupportFlyover(null, true);
      this.grenadeRequested = false; this.airSupportRequested = false;
      this.laneInput?.stop();
      const s = this.simulation.getState();
      this.targetX = s.player.x;
      if (s.defenseTank?.status === 'defeated' && this.tankDeathAtMs !== null
        && this.presentationMs - this.tankDeathAtMs >= TANK_DEATH_MS)
        this.fieldObserver?.updateVictory(this.presentationMs / 1000, true);
      else if (s.defenseTank?.status === 'defeated') this.fieldObserver?.finishCombat(this.presentationMs / 1000, true);
      else this.fieldObserver?.update(s.destroyer, s.catharsis?.balance.destroyer, s.elapsedSeconds, s.squad.count > 0, true, s.defenseTank, s.commanderSupport, s.catharsis?.balance.commanderSupport);
      this.audio.silenceMusic();
    } else {
      this.startInputs();
    }
    this.pauseOverlay.setVisible(this.paused);
    this.hudActions.setPaused(this.paused);
    this.syncWakeLock();
  }

  private syncWakeLock(): void {
    this.wakeLock.setActive(this.running && this.startup === 'started' && (!this.paused||this.qaPreparing) && !this.qaSleepActive && !this.recovery?.blocking
      && !this.hidden && !this.contextLost && document.visibilityState === 'visible'
      && this.simulation.getFrameState().squad.count > 0 && this.simulation.getFrameState().defenseTank?.status !== 'defeated');
  }

  private readonly chooseRecovery = (continueGame: boolean): void => {
    if (this.startup !== 'recovering') return;
    const c = this.recoveryPending;
    this.recoveryPending = null;
    if (continueGame && c) {
      try {
        this.simulation = simulationFromCheckpoint(c);
        this.config = c.config; this.sessionLevel = c.level; this.runtimeTuning = { ...c.tuning };
        this.devReviewFixture = c.fixture as DevReviewFixture | null;
        this.devReview?.setSelected(this.devReviewFixture ?? undefined); this.tuningPanel?.setValues(this.runtimeTuning);
        const s = this.simulation.getFrameState();
        this.historicalAirSupportReview = c.fixture === 'air-support'
          && s.catharsis?.balance.commanderSupport?.heavyRaid?.lastStand?.triggerPolicy !== 'manualPlayerCall';
        this.tankEntranceHud.restore(s);
        this.targetX = s.player.x; this.lastRunSeed = s.seed;
        this.previousDefenseValue = squadDefenseValue(s.squad, this.config.tiers.mergeCount);
        this.previousWeaponFamily = s.progression && s.catharsis
          ? progressionStage(s.progression.level, s.catharsis.balance.progression).weaponFamily : 'rifle';
        this.progressionObserver.reset(); if (s.progression) this.progressionObserver.observe(s.progression.level);
        this.fieldObserver?.reset(); this.audio.restoreObservation(this.previousDefenseValue,
          s.enemies, s.projectiles);
        this.renderer.restoreFeedback(projectRenderState(s, {
          formationSpacing: this.config.player.formationSpacing, trackHalfWidth: this.config.track.halfWidth,
          defenseLineOffset: this.config.track.defenseLineOffset,
          catharsis: s.catharsis,
        }), 0, c.playtestVictory?.elapsedMs);
        this.xpHud?.reset(); this.battleInfo?.reset();
        this.grenadeButton?.restore(s.grenade?.inventory ?? 0, s.grenade?.acquiredAtSeconds != null);
        this.manualSupportButton?.restore(s);
        this.presentationMs = 0; this.fixedStepLoop.reset(); this.previousFrameTimestampMs = null;
        this.celebration = null; this.lastCombatProjectiles = undefined;
        this.tankDeathAtMs = s.defenseTank?.status === 'defeated' ? -(c.playtestVictory?.elapsedMs ?? TANK_DEATH_MS) : null;
        this.stageClearAtMs = null;
        this.tankDeathCue = s.defenseTank?.status === 'defeated'
          ? TANK_EXPLOSION_TIMES_MS.filter(at => at <= (c.playtestVictory?.elapsedMs ?? TANK_DEATH_MS)).length - 1 : -1;
        if (c.playtestVictory?.communication) this.fieldObserver?.restoreVictory(c.playtestVictory.communication, 0);
        this.restored = true; this.startup = 'started'; this.setPaused(true);
        // Historical release QA saves still restore as ordinary paused Defense.
        this.stageClearOverlay.setDevPreview(this.devReviewFixture === 'victory');
        if (import.meta.env.DEV) {
          this.qaSession=!!c.qa;this.qaSleepActive=c.qa?.armed??false;
          if(c.qa){this.syncWakeLock();if(this.qaSleepActive)this.pauseOverlay.setVisible(false);
            this.tuningPanel?.openAdvanced();
            this.qaPanel?.open();this.qaPanel?.setStatus('已重新載入並恢復測試場景・保持暫停。導覽／Discard 指標僅供參考。');}
        }
        // Early Continue can precede AudioContext creation. Explicit Resume owns audio activation.
        this.renderer.preparePresentation();
        if (import.meta.env.DEV) this.lifecycle?.record('checkpoint-restored', { tick: s.tick });
        return;
      } catch { this.showCheckpointFailure('無法恢復進度，請重新開始'); }
    }
    clearCheckpoint(); this.startup = 'awaiting-start'; this.startOverlay.show();
  };

  private showCheckpointFailure(text: string): void {
    this.checkpointNotice ??= document.createElement('div');
    this.checkpointNotice.className = 'checkpoint-notice'; this.checkpointNotice.setAttribute('role', 'status');
    this.checkpointNotice.textContent = text; this.viewport.append(this.checkpointNotice);
  }

  private saveCheckpoint(reason: SessionCheckpoint['reason']): void {
    if (this.startup !== 'started') return;
    const started = performance.now(), state = this.simulation.getState();
    const victoryPreview = this.devReviewFixture === 'victory' && state.defenseTank?.status === 'defeated';
    if (state.squad.count === 0 || state.defenseTank?.status === 'defeated' && !victoryPreview) { clearCheckpoint(); return; }
    // Crate fixtures intentionally have no enemy stream; retain that level contract too.
    const level = state.enemyStream === null && this.sessionLevel.enemyStream
      ? { ...this.sessionLevel, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } : this.sessionLevel;
    const result = writeCheckpoint({ version: 1, simulationContract: 1, game: 'topwar',
      mode: 'defense', build: typeof __TOPWAR_SHA__ === 'string' ? __TOPWAR_SHA__ : 'unknown',
      savedAt: Date.now(), paused: true, hidden: this.hidden, reason,
      fixture: this.devReviewFixture,
      ...(victoryPreview ? { playtestVictory: { elapsedMs: this.tankDeathAtMs === null ? 0 : this.presentationMs - this.tankDeathAtMs,
        communication: this.fieldObserver?.victoryCheckpoint(this.presentationMs / 1000) } } : {}),
      ...(import.meta.env.DEV && this.qaSession?{qa:{version:1 as const,kind:'sleep-lv10' as const,armed:this.qaSleepActive}}:{}),
      config: this.config as GameConfig, level, tuning: this.runtimeTuning, state });
    if (import.meta.env.DEV) this.lifecycle?.record('checkpoint-write', { ...result, totalMilliseconds: performance.now() - started });
    if (!result.ok) this.showCheckpointFailure('無法儲存進度；請保持此分頁開啟');
    else { this.checkpointNotice?.remove(); this.checkpointNotice = null; }
    this.qaPanel?.refreshCheckpoint();
  }

  private suspendSession(reason: SessionCheckpoint['reason']): void {
    this.previousFrameTimestampMs = null; this.fixedStepLoop.reset();
    if (this.startup === 'started') { this.setPaused(true); this.saveCheckpoint(reason); }
    if (reason !== 'contextlost') this.audio.suspendForBackground();
    if (import.meta.env.DEV) this.lifecycle?.record(reason);
  }
  private readonly onVisibility = (): void => {
    this.hidden = document.visibilityState === 'hidden';
    if(this.qaSession&&this.hidden)this.qaHidden=true;
    if (this.hidden) this.suspendSession('hidden');
    else { this.previousFrameTimestampMs = null; this.fixedStepLoop.reset(); this.fps?.reset(this.paused ? 'PAUSED' : '—');
      if (import.meta.env.DEV) this.lifecycle?.record('visible'); }
    if(this.qaSession&&!this.hidden&&this.qaHidden)this.qaPanel?.setStatus('同一頁面返回・未重新載入・保持暫停。Android 熄屏／Tab discard 未由網頁判定。');
  };
  private readonly onPageHide = (event: PageTransitionEvent): void => {
    if(this.qaSession)this.qaHidden=true;
    this.hidden = true; this.suspendSession('pagehide');
    if (import.meta.env.DEV) this.lifecycle?.record('pagehide-persisted', event.persisted);
  };
  private readonly onPageShow = (event: PageTransitionEvent): void => {
    this.hidden = document.visibilityState === 'hidden'; this.previousFrameTimestampMs = null; this.fixedStepLoop.reset();
    if (import.meta.env.DEV) this.lifecycle?.record('pageshow', { persisted: event.persisted });
    if(this.qaSession&&this.qaHidden)this.qaPanel?.setStatus(`同一頁面 pageshow・${event.persisted?'BFCache':'未觀察到重新載入'}・保持暫停`);
  };
  private readonly onFreeze = (): void => { if(this.qaSession)this.qaHidden=true;this.hidden = true; this.suspendSession('freeze'); };
  private readonly onResumeLifecycle = (): void => {
    this.hidden = document.visibilityState === 'hidden'; this.previousFrameTimestampMs = null; this.fixedStepLoop.reset();
    if (import.meta.env.DEV) this.lifecycle?.record('resume');
    if(this.qaSession&&this.qaHidden)this.qaPanel?.setStatus('同一頁面 freeze/resume・保持暫停（未證明程序終止）');
  };
  private readonly onContextLost = (): void => { this.contextLost = true; this.suspendSession('contextlost'); };
  private readonly onContextRestored = (): void => {
    this.contextLost = false; this.previousFrameTimestampMs = null; this.fixedStepLoop.reset();
    if (import.meta.env.DEV) this.lifecycle?.record('contextrestored');
    if(this.qaSession)this.qaPanel?.setStatus('WebGL context 已恢復・保持暫停（不代表 Tab discard）');
  };

  private async beginSleepTest():Promise<void> {
    if (import.meta.env.DEV) {
    if(this.disposed||this.qaPreparing||this.recovery?.blocking||this.startup==='recovering')return;
    if(this.hidden||this.contextLost){this.qaPanel?.setStatus('請在可見且可用的遊戲畫面開始測試');return;}
    const generation=++this.qaGeneration;
    try {
      await this.audio.activate();
      if(this.disposed||generation!==this.qaGeneration)return;
      this.qaPreparing=true;this.qaSleepActive=false;this.qaSession=true;
      clearCheckpoint();this.devReviewFixture=null;this.config=this.authoredConfig;this.sessionLevel=this.level;
      this.runtimeTuning=defaultRuntimeTuning(this.config,this.level);
      const tuning=qaSimulationTuning(this.config);
      this.simulation=createQaStressFixture({seed:42,level:this.level,startSquad:1,startRocketCount:0,
        tiers:this.config.tiers,catharsis:{balance:this.config.catharsis!,trackHalfWidth:this.config.track.halfWidth}},tuning);
      this.startOverlay.finish();this.startup='started';this.restored=true;this.fieldObserver?.reset();
      this.progressionObserver.reset();this.progressionObserver.observe(10);this.renderer.resetFeedback();
      this.gameOverOverlay.setVisible(false);this.clearedFinishedCheckpoint=false;
      this.setPaused(true);this.pauseOverlay.setVisible(false);
      let ready=false;
      for(let tick=0;tick<5400&&!ready;){
        if(this.disposed||generation!==this.qaGeneration) return;
        if(this.hidden||this.contextLost)throw Error('Preparation interrupted; resume and restart testing');
        for(let n=0;n<30&&!ready;n++,tick++)ready=advanceQaPreparation(this.simulation,tuning,tick);
        if(!this.simulation.getFrameState().squad.count)throw Error('QA preparation lost all soldiers');
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      }
      if(!ready)throw Error('Bounded QA preparation did not reach its resource target');
      const s=this.simulation.getFrameState();this.targetX=s.player.x;this.presentationMs=s.elapsedSeconds*1000;
      this.previousDefenseValue=squadDefenseValue(s.squad,this.config.tiers.mergeCount);this.previousWeaponFamily='machineGun';
      this.audio.restoreObservation(this.previousDefenseValue,s.enemies,s.projectiles);
      this.renderer.restoreFeedback(projectRenderState(s,{formationSpacing:this.config.player.formationSpacing,
        trackHalfWidth:this.config.track.halfWidth,defenseLineOffset:this.config.track.defenseLineOffset,catharsis:s.catharsis}),this.presentationMs);
      this.renderer.preparePresentation();
      // Real visible frames upload the actual crowd, HP bars, projectile and shell batches.
      for(let i=0;i<3;i++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(this.disposed||generation!==this.qaGeneration)return;
      this.qaPreparing=false;this.qaSleepActive=true;this.setPaused(true);this.pauseOverlay.setVisible(false);
      this.saveCheckpoint('pause');
      if(readCheckpoint().status!=='valid')throw Error('Checkpoint storage unavailable or invalid');
      let timer:ReturnType<typeof setTimeout>|undefined;
      const released=await Promise.race([this.wakeLock.releaseForTest(),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),4000);})]);
      if(timer)clearTimeout(timer);
      if(generation!==this.qaGeneration||this.disposed)return;
      if(!released){this.qaPanel?.setStatus('尚未確認 Wake Lock 釋放。保持暫停，請稍候或結束測試。');return;}
      this.qaPanel?.setStatus('請勿觸碰螢幕，等待 Android 自動熄屏（建議設定 15 秒）');
    }catch(error){if(this.disposed||generation!==this.qaGeneration)return;
      this.qaPreparing=false;this.qaSleepActive=true;this.setPaused(true);
      this.qaPanel?.setStatus(`測試未完成：${error instanceof Error?error.message:'unknown'}`);}
    }
  }
  private exitSleepTest():void {
    if(!import.meta.env.DEV || !this.qaSession)return;
    this.qaGeneration++;this.qaPreparing=false;this.qaSleepActive=false;this.qaSession=false;
    this.setPaused(true);this.saveCheckpoint('pause');this.qaPanel?.setStatus('已結束測試・保持暫停，請按 Resume 繼續');
  }
  private reloadTest():void {
    if (!import.meta.env.DEV) return;
    if(this.startup!=='started'||!this.simulation.getFrameState().squad.count)return;
    this.setPaused(true);this.saveCheckpoint('pause');
    if(readCheckpoint().status==='valid')window.location.reload();
    else this.qaPanel?.setStatus('無有效儲存進度，未重新載入');
  }

  private readonly renderFrame = (timestampMs: number): void => {
    if (!this.running) return;
    try {
      if (this.startup !== 'started') {
        const state = this.simulation.getFrameState();
        if (state.progression && state.catharsis) {
          this.xpHud?.update(state.progression, state.catharsis.balance.progression, 0);
          this.battleInfo?.update(state.progression, state.catharsis.balance.progression, this.presentationMs);
        }
        this.renderer.render(projectRenderState(state, {
          formationSpacing: this.config.player.formationSpacing,
          trackHalfWidth: this.config.track.halfWidth,
          defenseLineOffset: this.config.track.defenseLineOffset,
          catharsis: state.catharsis,
        }), 0);
        this.frameId = requestAnimationFrame(this.renderFrame);
        return;
      }
      const perf = this.perf;
      perf?.beginFrame();
      const simStartedMs = perf ? performance.now() : 0;
      const elapsedSeconds = this.previousFrameTimestampMs === null
        ? 0
        : Math.max(0, (timestampMs - this.previousFrameTimestampMs) / 1000);
      this.previousFrameTimestampMs = timestampMs;
      let stepCpuMs = 0;
      if (!this.paused && !this.hidden && !this.contextLost) {
        this.presentationMs += Math.min(elapsedSeconds, this.fixedStepLoop.maxFrameSeconds) * 1000;
        const stepStartedMs = perf ? performance.now() : 0;
        const advance = this.fixedStepLoop.advance(elapsedSeconds, (dtSeconds) => {
        const before = this.simulation.getFrameState();
        if (before.defenseTank?.status === 'defeated') return;
        if (before.defenseTank) this.lastCombatProjectiles = before.projectiles;
        this.simulation.step(
        dtSeconds,
        { targetX: this.targetX, ...(this.takeGrenadeRequest() ? { throwGrenade: true } : {}),
          ...(before.catharsis?.balance.commanderSupport?.heavyRaid?.lastStand?.triggerPolicy === 'manualPlayerCall'
            ? { supportNoticeStarted: this.fieldObserver?.supportNoticeStarted,
            supportNoticeComplete: this.fieldObserver?.supportNoticeComplete, callAirSupport: this.takeAirSupportRequest() } : {}) },
        {
          moveSpeed: this.runtimeTuning.moveSpeed,
          forwardSpeed: this.runtimeTuning.forwardSpeed,
          trackHalfWidth: this.config.track.halfWidth,
          defenseLineOffset: this.config.track.defenseLineOffset,
          formationSpacing: this.config.player.formationSpacing,
          memberRadius: this.config.player.memberRadius,
          normalEnemyRadius: this.config.tiers.normalEnemyRadius,
          bossRadius: this.config.bosses.basic.radius,
          rifle: { fireRate: this.runtimeTuning.fireRate,
            projectileSpeed: this.runtimeTuning.bulletSpeed, range: this.runtimeTuning.bulletRange,
            tierHitRadiusStep: this.config.weapon.rifle.tierHitRadiusStep,
            maxHitRadiusBonus: this.config.weapon.rifle.maxHitRadiusBonus },
          rocket: { ...this.config.weapon.rocket },
        },
        );
        });
        if (perf) stepCpuMs = performance.now() - stepStartedMs;
        perf?.recordSteps(advance.steps);
      }
      const stateStartedMs = perf ? performance.now() : 0;
      const state = this.simulation.getFrameState();
      const cleared = state.defenseTank?.status === 'defeated';
      this.tankEntranceHud.update(state, this.paused);
      const emergency = personalArtilleryThreat(state);
      const emergencyRemaining = emergency ? emergency.impactAtSeconds - state.elapsedSeconds : null;
      this.artilleryEmergencyHud.update(emergencyRemaining, state.player.x);
      this.fps?.frame(timestampMs, !this.paused && !this.hidden && !this.contextLost && state.squad.count > 0);
      if (state.squad.count === 0 || this.stageClearAtMs !== null) this.laneInput?.stop();
      if (state.squad.count === 0 || cleared) {
        if (!this.clearedFinishedCheckpoint) { if (this.devReviewFixture !== 'victory') clearCheckpoint(); this.clearedFinishedCheckpoint = true; this.wakeLock.setActive(false); } }
      if (!cleared)
        this.fieldObserver?.update(state.destroyer, state.catharsis?.balance.destroyer, state.elapsedSeconds, state.squad.count > 0, this.paused, state.defenseTank, state.commanderSupport, state.catharsis?.balance.commanderSupport);
      if (cleared && (this.tankDeathAtMs === null || this.presentationMs - this.tankDeathAtMs < TANK_DEATH_MS))
        this.fieldObserver?.finishCombat(this.presentationMs / 1000, this.paused);
      const supportEvents = this.simulation.consumeSupportEvents();
      for (const event of supportEvents) if (event.kind === 'supportBomb') {
        if (event.heavy) this.audio.playSupportImpact(); else this.audio.play('grenadeExplosion');
      }
      const supportAir = state.commanderSupport?.airstrike;
      const supportConfig = state.catharsis?.balance.commanderSupport;
      this.audio.syncSupportFlyover(!cleared && state.squad.count > 0 && supportAir?.triggeredAtSeconds != null
        && supportAir.status !== 'cancelled' ? state.elapsedSeconds - (supportConfig?.heavyRaid
          ? supportAir.triggeredAtSeconds : supportAir.bombAtSeconds!) : null, this.paused,
        supportConfig?.heavyRaid ? supportConfig.warningSeconds + 5 * supportConfig.strikeSpacingSeconds + 10 : 1.2,
        supportConfig?.warningSeconds, supportConfig?.strikeSpacingSeconds);
      const tankEntranceEvents = this.simulation.consumeTankEntranceEvents();
      this.renderer.presentTankEntrance(tankEntranceEvents, this.presentationMs);
      if (tankEntranceEvents.some(event => event.shockwave)) this.audio.play('supplyImpact');
      this.manualSupportButton?.update(state, !this.paused && !this.hidden && !this.contextLost
        && !this.tuningPanel?.isOpen && !this.airSupportRequested && !this.recovery?.blocking && this.startup === 'started', this.presentationMs);
      const grenade = state.grenade;
      this.grenadeButton?.update(grenade?.inventory ?? 0, grenade?.acquiredAtSeconds != null,
        !cleared && !this.paused && state.squad.count > 0 && !this.grenadeRequested && (grenade?.inventory ?? 0) > 0 && !grenade?.flight
          && !!grenadeTarget(state, state.catharsis!.balance.grenade), this.presentationMs);
      const grenadeEvents = this.simulation.consumeGrenadeEvents();
      this.tankBossHud.presentGrenade(grenadeEvents, this.presentationMs);
      this.audio.presentSupply(grenadeEvents,this.presentationMs);
      for (const event of grenadeEvents) {
        if(event.kind==='grenadeSupplyOpened')this.supplyTransfer?.present(event,this.presentationMs);
        if (event.kind === 'grenadeThrown') {
          this.audio.play('grenadeLaunch'); this.grenadeButton?.presentThrow(this.presentationMs);
        } else if (event.kind === 'grenadeAcquired') this.audio.play('reward');
        else if (event.kind === 'grenadeDetonated') this.audio.play('grenadeExplosion');
      }
      this.renderer.presentGrenade(grenadeEvents, this.presentationMs);
      // A coincident Grenade cannot hide the heavy raid's 500-HP hit/flash.
      this.renderer.presentSupport(supportEvents, this.presentationMs);
      this.tankBossHud.presentSupport(supportEvents, this.presentationMs);
      const artilleryEvents = this.simulation.consumeArtilleryEvents();
      for (const event of artilleryEvents) {
        this.audio.play(event.kind === 'artilleryLaunch' ? 'enemyCannon' : 'enemyShellImpact');
        if (event.kind === 'artilleryLaunch' && state.catharsis?.balance.artillery?.warningPresentation !== 'personalEmergency')
          this.audio.play('enemyLockOn');
      }
      this.renderer.presentArtillery(artilleryEvents, this.presentationMs);
      if (cleared) {
        if (!this.celebration && state.catharsis?.balance.defenseMode && state.squad.count > 0)
          this.celebration = new VictoryCelebration(state, this.presentationMs,
            { ...this.runtimeTuning, formationSpacing: this.config.player.formationSpacing }, this.lastCombatProjectiles);
        this.tankDeathAtMs ??= this.presentationMs;
        const age = this.presentationMs - this.tankDeathAtMs;
        const times = TANK_EXPLOSION_TIMES_MS;
        for (let i = this.tankDeathCue + 1; i < times.length && age >= times[i]; i++) {
          this.audio.play(i === times.length - 1 ? 'giantDeath' : 'grenadeExplosion'); this.tankDeathCue = i;
        }
        if (age >= TANK_DEATH_MS && (this.fieldObserver?.updateVictory(this.presentationMs / 1000, this.paused) ?? true)
          && state.combatStats) {
          this.stageClearAtMs ??= this.presentationMs;
          this.stageClearOverlay.show(state.combatStats, state.defenseTank!.defeatedAtSeconds!);
          this.laneInput?.stop();
        }
        const wasFiring = this.celebration?.firingEnabled;
        this.celebration?.update(this.presentationMs, this.paused,
          this.fieldObserver?.victoryPresentationStarted ?? age >= TANK_DEATH_MS, this.stageClearAtMs !== null);
        if (wasFiring && !this.celebration?.firingEnabled) this.audio.silenceWeapons();
      }
      if (state.progression && state.catharsis) {
        const levelUp = this.progressionObserver.observe(state.progression.level);
        if (levelUp) {
          this.xpHud?.presentLevelUp(levelUp, this.presentationMs);
          this.renderer.presentLevelUp(levelUp, this.presentationMs);
          this.audio.play('levelUp');
        }
        this.xpHud?.update(state.progression, state.catharsis.balance.progression, this.presentationMs);
        this.battleInfo?.update(state.progression, state.catharsis.balance.progression, this.presentationMs);
      }
      const stateFinishedMs = perf ? performance.now() : 0;
      const presentationEvents = this.simulation.consumePresentationEvents();
      if (state.squad.count === 0 && presentationEvents.some((event) => event.after.count === 0)) {
        this.fatalPresentationUntilMs = this.presentationMs + 360;
      }
      const stream = this.level.enemyStream;
      const currentDefenseValue = squadDefenseValue(state.squad, this.config.tiers.mergeCount);
      const weaponFamily = state.progression && state.catharsis
        ? progressionStage(state.progression.level, state.catharsis.balance.progression).weaponFamily : 'rifle';
      // The family change is a power upgrade, not damage/recruitment. Real contact
      // events in the same frame still produce their ordinary casualty feedback.
      const feedbackBefore = weaponFamily !== this.previousWeaponFamily
        ? presentationEvents.reduce((value, event) => value
          + squadDefenseValue(event.before, this.config.tiers.mergeCount)
          - squadDefenseValue(event.after, this.config.tiers.mergeCount), currentDefenseValue)
        : this.previousDefenseValue;
      const feedback = damageFeedback(feedbackBefore, currentDefenseValue);
      if (feedback) this.damageFlash.flash(feedback === 'fatal');
      const audioStartedMs = perf ? performance.now() : 0;
      this.audio.observe(feedbackBefore, currentDefenseValue,
        state.enemies, this.presentationMs, this.celebration?.projectiles ?? state.projectiles);
      this.audio.updateMusic(this.presentationMs, {
        squadCount: state.squad.count,
        paused: this.paused,
        musicVolume: this.runtimeTuning.musicVolume,
        victorySeconds: this.stageClearAtMs === null ? null : (this.presentationMs - this.stageClearAtMs) / 1000,
        tank: state.defenseTank ? { status: state.defenseTank.status, phase: state.defenseTank.phase,
          elapsedSeconds: cleared ? (this.presentationMs - this.tankDeathAtMs!) / 1000
            : state.elapsedSeconds - state.defenseTank.startedAtSeconds,
          entrySeconds: state.defenseTank.activeAtSeconds - state.defenseTank.startedAtSeconds } : undefined,
      });
      const audioFinishedMs = perf ? performance.now() : 0;
      this.previousDefenseValue = currentDefenseValue;
      this.previousWeaponFamily = weaponFamily;
      const renderStartedMs = perf ? performance.now() : 0;
      const baseRenderState: GameRenderState = projectRenderState(state, {
        formationSpacing: this.config.player.formationSpacing,
        trackHalfWidth: this.config.track.halfWidth,
        defenseLineOffset: this.config.track.defenseLineOffset,
        catharsis: state.catharsis,
      });
      const renderState: GameRenderState = this.celebration
        ? { ...baseRenderState, player: this.celebration.player, projectiles: this.celebration.projectiles } : baseRenderState;
      const mapFinishedMs = perf ? performance.now() : 0;
      const renderEvents = state.catharsis?.balance.defenseMode ? presentationEvents.map((event) => ({ ...event,
        attackerZ: event.attackerZ - state.player.z, playerZ: 0 })) : presentationEvents;
      if (renderEvents.length > 0) this.renderer.present(renderEvents,
        this.presentationMs, this.config.track.halfWidth, this.config.player.formationSpacing,
        renderState.squad.defenseFormation, renderState.track.lanePositions?.at(-1));
      this.renderer.render(renderState, this.presentationMs);
      const tankHealthPosition = this.renderer.projectTankHealthPosition();
      this.tankBossHud.update(state, this.presentationMs, tankHealthPosition);
      this.supplyTransfer?.update(this.presentationMs);
      const renderFinishedMs = perf ? performance.now() : 0;
      if (perf) {
        perf.recordCpuBreakdown(stepCpuMs, stateFinishedMs - stateStartedMs,
          mapFinishedMs - renderStartedMs);
        const r = this.renderer.getDebugStats();
        perf.record(elapsedSeconds > 0 ? elapsedSeconds * 1000 : 0, stateFinishedMs - simStartedMs,
          renderFinishedMs - renderStartedMs,
          audioFinishedMs - audioStartedMs,
          { enemies: state.enemies.length, projectiles: state.projectiles.length,
            drawCalls: r.drawCalls, triangles: r.triangles, projectilePool: r.projectiles.pool });
        const stream = this.level.enemyStream;
        const row = stream ? Math.max(0, Math.floor((state.player.z - stream.startZ) / stream.spacing)) : 0;
        this.perfHud?.update(timestampMs, perf, this.renderer, this.audio,
          { enemies: state.enemies.length, projectiles: state.projectiles.length,
            rewards: state.streamRewards.length, boss: state.boss !== null,
            tier: state.progression?.level ?? 1,
            playerZ: state.player.z });
      }
      this.gameOverOverlay.setVisible(state.squad.count === 0
        && this.presentationMs >= this.fatalPresentationUntilMs);
      this.frameId = requestAnimationFrame(this.renderFrame);
    } catch (error) {
      console.error('TopWar game loop stopped after an unexpected error', error);
      this.stop();
      const notice = document.createElement('div');
      notice.className = 'runtime-error-overlay';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'Game stopped unexpectedly. Reload to retry.';
      this.viewport.append(notice);
    }
  };
}

