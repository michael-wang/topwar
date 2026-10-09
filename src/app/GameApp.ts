import { ProgressionLevelObserver } from '../presentation/ProgressionLevelUp';
import { BattleInfoHud } from '../ui/BattleInfoHud';
import { CombatControlStrip } from '../ui/CombatControlStrip';
import { XpHud } from '../ui/XpHud';
import { FixedStepLoop } from '../core/FixedStepLoop';
import type { ConfigStore } from '../config/ConfigStore';
import type { GameConfig } from '../config/configSchema';
import { KeyboardSteeringInput } from '../input/KeyboardSteeringInput';
import { PointerDragInput } from '../input/PointerDragInput';
import { TouchSteeringInput } from '../input/TouchSteeringInput';
import type { LevelDefinition } from '../level/LevelDefinition';
import { GameRenderer } from '../rendering/GameRenderer';
import type { CharacterAssets } from '../rendering/CharacterAssets';
import type { GameRenderState } from '../rendering/RenderState';
import { Simulation } from '../simulation/Simulation';
import { damageFeedback, squadDefenseValue } from './combatFeedback';
import { DamageFlashOverlay } from '../ui/DamageFlashOverlay';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { GameAudio } from '../audio/GameAudio';
import { TierHud } from '../ui/TierHud';
import { highestIntroducedTierForRow } from '../simulation/tiers/tierRules';
import { defaultRuntimeTuning, type RuntimeTuning } from './runtimeTuning';
import { SupplyRewardTransfer } from '../ui/SupplyRewardTransfer';
import { PauseOverlay } from '../ui/PauseOverlay';
import { ControlHint } from '../ui/ControlHint';
import { TuningPanel } from '../ui/TuningPanel';
import { HudActions } from '../ui/HudActions';
import { PerfDiagnostics } from './PerfDiagnostics';
import { PerfHud } from '../ui/PerfHud';
import { projectRenderState } from './projectRenderState';
import { LaneStepInput } from '../input/LaneStepInput';
import { createThreatReview } from './ThreatReview';
import { createDevReviewFixture, type DevReviewFixture } from './DevReviewFixtures';
import { DevReviewControls } from '../ui/DevReviewControls';
import { GameStartOverlay } from '../ui/GameStartOverlay';
import { GrenadeButton } from '../ui/GrenadeButton';
import { grenadeTarget } from '../simulation/grenade';
import { progressionStage } from '../simulation/progression';

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
  private readonly damageFlash: DamageFlashOverlay;
  private readonly audio: GameAudio;
  private readonly startOverlay: GameStartOverlay;
  private readonly tierHud: TierHud;
  private readonly pauseOverlay: PauseOverlay;
  private readonly controlHint: ControlHint | null;
  private readonly hudActions: HudActions;
  private readonly tuningPanel: TuningPanel | null;
  private readonly dragInput: PointerDragInput;
  private readonly keyboardInput: KeyboardSteeringInput;
  private readonly touchInput: TouchSteeringInput | null;
  private readonly laneInput: LaneStepInput | null;
  private readonly progressionObserver = new ProgressionLevelObserver();
  private readonly controlStrip: CombatControlStrip | null;
  private readonly xpHud: XpHud | null;
  private readonly battleInfo: BattleInfoHud | null;
  private readonly grenadeButton: GrenadeButton | null;
  private readonly supplyTransfer: SupplyRewardTransfer | null;
  private grenadeRequested = false;
  private readonly unsubscribeConfig: () => void;
  private config: Readonly<GameConfig>;
  private targetX: number;
  private dragStartPlayerX = 0;
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
  private startup: 'awaiting-start' | 'activating' | 'started' = 'awaiting-start';
  private startGeneration = 0;
  private consumeStartClick = false;
  private disposed = false;
  private readonly perf: PerfDiagnostics | null;
  private readonly perfHud: PerfHud | null;
  private readonly devReview: DevReviewControls | null;
  private devReviewVisualSalt=-1;
  private devReviewFixture: DevReviewFixture | null = null;

  constructor(private readonly viewport: HTMLElement, configStore: ConfigStore,
    private readonly level: LevelDefinition, assets: CharacterAssets, perfEnabled = false,
    private readonly reviewThreats = false) {
    this.viewport.setAttribute?.('data-input-presentation', 'touch');
    this.perf = perfEnabled ? new PerfDiagnostics() : null;
    this.perfHud = perfEnabled ? new PerfHud(viewport) : null;
    this.config = configStore.getConfig();
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
    this.audio = new GameAudio();
    this.startOverlay = new GameStartOverlay(viewport);
    this.tierHud = new TierHud(viewport);
    this.pauseOverlay = new PauseOverlay(viewport);
    this.controlHint = this.config.catharsis?.defenseMode ? null : new ControlHint(viewport);
    this.controlStrip = this.config.catharsis?.defenseMode ? new CombatControlStrip(viewport) : null;
    this.xpHud = this.controlStrip ? new XpHud(this.controlStrip.progressionHost) : null;
    this.battleInfo = this.config.catharsis?.defenseMode ? new BattleInfoHud(viewport) : null;
    this.grenadeButton = this.config.catharsis?.defenseMode ? new GrenadeButton(viewport, this.requestGrenade) : null;
    this.supplyTransfer=this.grenadeButton ? new SupplyRewardTransfer(viewport,this.grenadeButton,
      (x,z,now)=>this.renderer.projectSupplyPosition(x,z,now)) : null;
    this.hudActions = new HudActions(viewport, () => this.togglePaused());
    this.tuningPanel = import.meta.env.DEV ? new TuningPanel(this.config.catharsis?.defenseMode ? viewport : this.hudActions.element, this.runtimeDefaults, (values) => {
      this.simulation.setRuntimeBalance({ rewardRowsPerReward: values.rewardRowsPerReward,
        enemyHigherTierPowerMultiplier: values.enemyHigherTierPowerMultiplier,
        rifleHigherTierPowerMultiplier: values.rifleHigherTierPowerMultiplier,
        bossHpScale: values.bossHpScale });
      this.runtimeTuning = values;
      if (this.config.catharsis) this.simulation.setCatharsisBalance({ ...this.config.catharsis,
        groupSize: values.groupSize ?? this.config.catharsis.groupSize,
        enemyVisualScale: values.enemyVisualScale!, gruntSpeed: values.gruntSpeed!,
        heavyHp: values.heavyHp!, heavySpeed: values.heavySpeed!, heavyChance: values.heavyChance! });
    }, !!this.config.catharsis?.defenseMode) : null;
    this.devReview = import.meta.env.DEV && this.config.catharsis?.defenseMode
      ? new DevReviewControls(this.tuningPanel!.reviewControlsHost, (role) => {
        this.devReviewFixture = role;
        this.devReview?.setSelected(role);
        this.tuningPanel?.close();
        this.retry();
      }, () => this.running && this.startup === 'started') : null;

    this.damageFlash = new DamageFlashOverlay(viewport);
    this.gameOverOverlay = new GameOverOverlay(viewport, () => this.retry());
    this.dragInput = new PointerDragInput(viewport, {
      onDragStart: () => {
        this.dragStartPlayerX = this.simulation.getState().player.x;
        this.targetX = this.dragStartPlayerX;
      },
      onDrag: (normalizedDeltaX) => {
        this.targetX = this.dragStartPlayerX + normalizedDeltaX * (this.config.track.halfWidth * 2);
      },
    });
    this.keyboardInput = new KeyboardSteeringInput(window, {
      onAxisChange: (axis) => this.setSteeringAxis(axis),
    });
    this.touchInput = this.config.catharsis?.defenseMode ? null
      : new TouchSteeringInput(viewport, (axis) => this.setSteeringAxis(axis));
    this.laneInput = this.config.catharsis?.defenseMode ? new LaneStepInput(viewport, window,
      (direction) => {
        if (!this.running || this.startup !== 'started' || this.paused || this.simulation.getFrameState().squad.count === 0) return false;
        return this.simulation.stepLane(direction);
      }, this.controlStrip!.buttons) : null;
    this.unsubscribeConfig = configStore.subscribe((config) => { this.config = config; });
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameApp');
    if (this.running) return;

    this.running = true;
    this.previousFrameTimestampMs = null;
    this.renderer.startResizeHandling();
    if (this.startup !== 'started') this.startOverlay.show();
    if (this.startup === 'started') this.startInputs();
    this.viewport.addEventListener?.('pointerdown', this.onStartPointerDown, true);
    this.viewport.addEventListener?.('click', this.onStartClick, true);
    window.addEventListener?.('keydown', this.onStartKeyDown, true);
    window.addEventListener?.('keydown', this.onPauseKeyDown);
    window.addEventListener?.('keydown', this.onActiveItemKeyDown);
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    this.grenadeRequested = false;
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
    this.keyboardInput.stop();
    this.dragInput.stop();
    this.touchInput?.stop();
    this.laneInput?.stop();
    this.paused = false;
    this.pauseOverlay.setVisible(false);
    this.hudActions.setPaused(false);
    this.viewport.classList?.remove('game-paused');
    this.renderer.stopResizeHandling();
    this.audio.silenceMusic();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.unsubscribeConfig();
    this.dragInput.dispose();
    this.keyboardInput.dispose();
    this.touchInput?.dispose();
    this.laneInput?.dispose();
    this.xpHud?.dispose();
    this.controlStrip?.dispose();
    this.battleInfo?.dispose();
    this.supplyTransfer?.dispose();this.grenadeButton?.dispose();
    this.gameOverOverlay.dispose();
    this.tuningPanel?.dispose();
    this.hudActions.dispose();
    this.devReview?.dispose();
    this.controlHint?.dispose();
    this.pauseOverlay.dispose();
    this.tierHud.dispose();
    this.damageFlash.dispose();
    this.audio.dispose();
    this.perfHud?.dispose();
    this.renderer.dispose();
    this.disposed = true;
  }

  private retry(): void {
    if (this.disposed) throw new Error('Cannot retry a disposed GameApp');
    this.keyboardInput.stop();
    this.dragInput.stop();
    this.touchInput?.stop();
    this.laneInput?.stop();
    this.simulation = this.createSimulation();
    this.perf?.reset();
    this.perfHud?.reset();
    const initialState = this.simulation.getState();
    this.targetX = initialState.player.x;
    this.previousDefenseValue = squadDefenseValue(initialState.squad, this.config.tiers.mergeCount);
    this.previousWeaponFamily = initialState.progression && initialState.catharsis
      ? progressionStage(initialState.progression.level, initialState.catharsis.balance.progression).weaponFamily : 'rifle';
    this.dragStartPlayerX = this.targetX;
    this.paused = false;
    this.viewport.classList?.remove('game-paused');
    this.startInputs();
    this.fixedStepLoop.reset();
    this.previousFrameTimestampMs = null;
    this.presentationMs = 0;
    this.fatalPresentationUntilMs = -Infinity;
    this.pauseOverlay.setVisible(false);
    this.hudActions.setPaused(false);
    this.gameOverOverlay.setVisible(false);
    this.damageFlash.reset();
    this.audio.resetObservation();
    this.xpHud?.reset();
    this.battleInfo?.reset();
    this.supplyTransfer?.reset();this.grenadeButton?.reset();
    this.grenadeRequested = false;
    this.progressionObserver.reset();
    if (import.meta.env.DEV && this.devReviewFixture && initialState.progression && initialState.catharsis) {
      // Selecting a QA loadout is initialization, not an earned level-up.
      this.progressionObserver.observe(initialState.progression.level);
      this.xpHud?.update(initialState.progression, initialState.catharsis.balance.progression, 0);
    }
    if (initialState.progression && initialState.catharsis) this.battleInfo?.update(initialState.progression, initialState.catharsis.balance.progression, this.presentationMs);
    this.renderer.resetFeedback(import.meta.env.DEV && this.devReviewFixture ? ++this.devReviewVisualSalt : 0);
    this.tierHud.setTier(1);
  }

  private createSimulation(): Simulation {
    const randomWord = new Uint32Array(1);
    crypto.getRandomValues(randomWord);
    const seed = randomWord[0] === this.lastRunSeed
      ? (randomWord[0] + 1) >>> 0 : randomWord[0];
    this.lastRunSeed = seed;
    const options = { seed, level: this.level,
      ...(this.config.catharsis ? { catharsis: { trackHalfWidth: this.config.track.halfWidth,
        balance: { ...this.config.catharsis, enemyVisualScale: this.runtimeTuning.enemyVisualScale!,
          groupSize: this.runtimeTuning.groupSize ?? this.config.catharsis.groupSize,
          gruntSpeed: this.runtimeTuning.gruntSpeed!, heavyHp: this.runtimeTuning.heavyHp!,
          heavySpeed: this.runtimeTuning.heavySpeed!, heavyChance: this.runtimeTuning.heavyChance! } } } : {}),
      collisionDiagnostics: this.perf?.counters,
      startSquad: this.config.player.startSquad,
      startRocketCount: this.config.player.startRocketCount,
      tiers: { ...this.config.tiers,
        enemyHigherTierPowerMultiplier: this.runtimeTuning.enemyHigherTierPowerMultiplier,
        rifleHigherTierPowerMultiplier: this.runtimeTuning.rifleHigherTierPowerMultiplier },
      rewardRowsPerReward: this.runtimeTuning.rewardRowsPerReward,
      bossHpScale: this.runtimeTuning.bossHpScale };
    if (import.meta.env.DEV && this.devReviewFixture)
      return createDevReviewFixture(options, this.runtimeTuning.fireRate, this.devReviewFixture);
    return this.reviewThreats ? createThreatReview(options, this.runtimeTuning.fireRate) : new Simulation(options);
  }

  private startInputs(): void {
    if (!this.running || this.startup !== 'started' || this.paused) return;
    if (this.laneInput) {
      if (this.simulation.getFrameState().squad.count > 0) this.laneInput.start();
    } else { this.dragInput.start(); this.keyboardInput.start(); this.touchInput?.start(); }
  }

  private takeGrenadeRequest(): boolean {
    const requested = this.grenadeRequested;
    this.grenadeRequested = false;
    return requested;
  }

  private readonly requestGrenade = (): void => {
    if (!this.running || this.startup !== 'started' || this.paused || this.grenadeRequested) return;
    const state = this.simulation.getFrameState();
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
    if (!this.running || this.startup !== 'awaiting-start') return;
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
    this.startOverlay.finish();
    this.startInputs();
  }

  private readonly onStartPointerDown = (event: PointerEvent): void => {
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
    if (this.startup === 'started' && !this.consumeStartClick) return;
    this.consumeStartClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Supports assistive-technology button activation without a pointerdown.
    void this.beginGameplay();
  };

  private readonly onStartKeyDown = (event: KeyboardEvent): void => {
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
    if (this.startup !== 'started') return;
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

  private setSteeringAxis(axis: -1 | 0 | 1): void {
    this.targetX = axis === 0
      ? this.simulation.getState().player.x
      : axis * this.config.track.halfWidth;
  }

  private togglePaused(): void {
    if (!this.running || this.startup !== 'started') return;
    this.paused = !this.paused;
    this.viewport.classList?.toggle('game-paused', this.paused);
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    if (this.paused) {
      this.grenadeRequested = false;
      this.keyboardInput.stop();
      this.dragInput.stop();
      this.touchInput?.stop();
      this.laneInput?.stop();
      this.targetX = this.simulation.getState().player.x;
    } else {
      this.startInputs();
    }
    this.pauseOverlay.setVisible(this.paused);
    this.hudActions.setPaused(this.paused);
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
          bossVisualScale: this.config.bosses.basic.visualScale,
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
      if (!this.paused) {
        this.presentationMs += Math.min(elapsedSeconds, this.fixedStepLoop.maxFrameSeconds) * 1000;
        const stepStartedMs = perf ? performance.now() : 0;
        const advance = this.fixedStepLoop.advance(elapsedSeconds, (dtSeconds) => this.simulation.step(
        dtSeconds,
        { targetX: this.targetX, ...(this.takeGrenadeRequest() ? { throwGrenade: true } : {}) },
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
        ));
        if (perf) stepCpuMs = performance.now() - stepStartedMs;
        perf?.recordSteps(advance.steps);
      }
      const stateStartedMs = perf ? performance.now() : 0;
      const state = this.simulation.getFrameState();
      if (state.squad.count === 0) this.laneInput?.stop();
      const grenade = state.grenade;
      this.grenadeButton?.update(grenade?.inventory ?? 0, grenade?.acquiredAtSeconds != null,
        !this.paused && state.squad.count > 0 && !this.grenadeRequested && (grenade?.inventory ?? 0) > 0 && !grenade?.flight
          && !!grenadeTarget(state, state.catharsis!.balance.grenade));
      const grenadeEvents = this.simulation.consumeGrenadeEvents();
      this.audio.presentSupply(grenadeEvents,this.presentationMs);
      for (const event of grenadeEvents) {
        if(event.kind==='grenadeSupplyOpened')this.supplyTransfer?.present(event,this.presentationMs);
        if (event.kind === 'grenadeAcquired') this.audio.play('reward');
        else if (event.kind === 'grenadeDetonated') this.audio.play('grenadeExplosion');
      }
      this.renderer.presentGrenade(grenadeEvents, this.presentationMs);
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
      if (stream && !state.catharsis?.balance.defenseMode) {
        const row = Math.max(0, Math.floor((state.player.z - stream.startZ) / stream.spacing));
        this.tierHud.setTier(highestIntroducedTierForRow(row, stream.tierProgression));
      }
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
        state.enemies,
        state.streamRewards, state.boss, this.presentationMs, state.projectiles);
      this.audio.updateMusic(this.presentationMs, {
        playerZ: state.player.z,
        squadCount: state.squad.count,
        boss: state.boss ? { z: state.boss.z, engaged: state.boss.engaged } : null,
        paused: this.paused,
        musicVolume: this.runtimeTuning.musicVolume,
      });
      const audioFinishedMs = perf ? performance.now() : 0;
      this.previousDefenseValue = currentDefenseValue;
      this.previousWeaponFamily = weaponFamily;
      const renderStartedMs = perf ? performance.now() : 0;
      const renderState: GameRenderState = projectRenderState(state, {
        formationSpacing: this.config.player.formationSpacing,
        trackHalfWidth: this.config.track.halfWidth,
        defenseLineOffset: this.config.track.defenseLineOffset,
        bossVisualScale: this.config.bosses.basic.visualScale,
        catharsis: state.catharsis,
      });
      const mapFinishedMs = perf ? performance.now() : 0;
      const renderEvents = state.catharsis?.balance.defenseMode ? presentationEvents.map((event) => ({ ...event,
        attackerZ: event.attackerZ - state.player.z, playerZ: 0 })) : presentationEvents;
      if (renderEvents.length > 0) this.renderer.present(renderEvents,
        this.presentationMs, this.config.track.halfWidth, this.config.player.formationSpacing);
      this.renderer.render(renderState, this.presentationMs);
      this.supplyTransfer?.update(this.presentationMs);
      const renderFinishedMs = perf ? performance.now() : 0;
      this.audio.updateEnvironment(this.presentationMs);
      if (perf) {
        const audioEnvironmentFinishedMs = performance.now();
        perf.recordCpuBreakdown(stepCpuMs, stateFinishedMs - stateStartedMs,
          mapFinishedMs - renderStartedMs);
        const r = this.renderer.getDebugStats();
        perf.record(elapsedSeconds > 0 ? elapsedSeconds * 1000 : 0, stateFinishedMs - simStartedMs,
          renderFinishedMs - renderStartedMs,
          audioFinishedMs - audioStartedMs + audioEnvironmentFinishedMs - renderFinishedMs,
          { enemies: state.enemies.length, projectiles: state.projectiles.length,
            drawCalls: r.drawCalls, triangles: r.triangles, projectilePool: r.projectiles.pool });
        const stream = this.level.enemyStream;
        const row = stream ? Math.max(0, Math.floor((state.player.z - stream.startZ) / stream.spacing)) : 0;
        this.perfHud?.update(timestampMs, perf, this.renderer, this.audio,
          { enemies: state.enemies.length, projectiles: state.projectiles.length,
            rewards: state.streamRewards.length, boss: state.boss !== null,
            tier: stream ? highestIntroducedTierForRow(row, stream.tierProgression) : 1,
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
