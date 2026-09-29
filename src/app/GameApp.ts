import { FixedStepLoop } from '../core/FixedStepLoop';
import type { ConfigStore } from '../config/ConfigStore';
import type { GameConfig } from '../config/configSchema';
import { KeyboardSteeringInput } from '../input/KeyboardSteeringInput';
import { PointerDragInput } from '../input/PointerDragInput';
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
import { PauseOverlay } from '../ui/PauseOverlay';
import { ControlHint } from '../ui/ControlHint';
import { TuningPanel } from '../ui/TuningPanel';
import { PerfDiagnostics } from './PerfDiagnostics';
import { PerfHud } from '../ui/PerfHud';

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
  private readonly tierHud: TierHud;
  private readonly pauseOverlay: PauseOverlay;
  private readonly controlHint: ControlHint;
  private readonly tuningPanel: TuningPanel;
  private readonly dragInput: PointerDragInput;
  private readonly keyboardInput: KeyboardSteeringInput;
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
  private lastRunSeed: number | null = null;
  private fatalPresentationUntilMs = -Infinity;
  private paused = false;
  private running = false;
  private disposed = false;
  private readonly perf: PerfDiagnostics | null;
  private readonly perfHud: PerfHud | null;

  constructor(private readonly viewport: HTMLElement, configStore: ConfigStore,
    private readonly level: LevelDefinition, assets: CharacterAssets, perfEnabled = false) {
    this.perf = perfEnabled ? new PerfDiagnostics() : null;
    this.perfHud = perfEnabled ? new PerfHud(viewport) : null;
    this.config = configStore.getConfig();
    this.runtimeDefaults = defaultRuntimeTuning(this.config, level);
    this.runtimeTuning = { ...this.runtimeDefaults };
    this.simulation = this.createSimulation();
    const initialState = this.simulation.getState();
    this.targetX = initialState.player.x;
    this.previousDefenseValue = squadDefenseValue(initialState.squad, this.config.tiers.mergeCount);
    this.renderer = new GameRenderer(viewport, assets);
    this.audio = new GameAudio(viewport);
    this.tierHud = new TierHud(viewport);
    this.pauseOverlay = new PauseOverlay(viewport);
    this.controlHint = new ControlHint(viewport);
    this.tuningPanel = new TuningPanel(viewport, this.runtimeDefaults, (values) => {
      this.simulation.setRuntimeBalance({ rewardRowsPerReward: values.rewardRowsPerReward,
        enemyHigherTierPowerMultiplier: values.enemyHigherTierPowerMultiplier,
        rifleHigherTierPowerMultiplier: values.rifleHigherTierPowerMultiplier,
        bossHpScale: values.bossHpScale });
      this.runtimeTuning = values;
    });
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
      onAxisChange: (axis) => {
        this.targetX = axis === 0
          ? this.simulation.getState().player.x
          : axis * this.config.track.halfWidth;
      },
    });
    this.unsubscribeConfig = configStore.subscribe((config) => { this.config = config; });
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameApp');
    if (this.running) return;

    this.running = true;
    this.previousFrameTimestampMs = null;
    this.renderer.startResizeHandling();
    this.dragInput.start();
    this.keyboardInput.start();
    window.addEventListener?.('keydown', this.onPauseKeyDown);
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    window.removeEventListener?.('keydown', this.onPauseKeyDown);
    this.keyboardInput.stop();
    this.dragInput.stop();
    this.paused = false;
    this.pauseOverlay.setVisible(false);
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
    this.gameOverOverlay.dispose();
    this.tuningPanel.dispose();
    this.controlHint.dispose();
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
    this.simulation = this.createSimulation();
    this.perf?.reset();
    this.perfHud?.reset();
    const initialState = this.simulation.getState();
    this.targetX = initialState.player.x;
    this.previousDefenseValue = squadDefenseValue(initialState.squad, this.config.tiers.mergeCount);
    this.dragStartPlayerX = this.targetX;
    this.paused = false;
    this.viewport.classList?.remove('game-paused');
    if (this.running) {
      this.dragInput.start();
      this.keyboardInput.start();
    }
    this.fixedStepLoop.reset();
    this.previousFrameTimestampMs = null;
    this.presentationMs = 0;
    this.fatalPresentationUntilMs = -Infinity;
    this.pauseOverlay.setVisible(false);
    this.gameOverOverlay.setVisible(false);
    this.damageFlash.reset();
    this.audio.resetObservation();
    this.renderer.resetFeedback();
    this.tierHud.setTier(1);
  }

  private createSimulation(): Simulation {
    const randomWord = new Uint32Array(1);
    crypto.getRandomValues(randomWord);
    const seed = randomWord[0] === this.lastRunSeed
      ? (randomWord[0] + 1) >>> 0 : randomWord[0];
    this.lastRunSeed = seed;
    return new Simulation({ seed, level: this.level,
      collisionDiagnostics: this.perf?.counters,
      startSquad: this.config.player.startSquad,
      startRocketCount: this.config.player.startRocketCount,
      tiers: { ...this.config.tiers,
        enemyHigherTierPowerMultiplier: this.runtimeTuning.enemyHigherTierPowerMultiplier,
        rifleHigherTierPowerMultiplier: this.runtimeTuning.rifleHigherTierPowerMultiplier },
      rewardRowsPerReward: this.runtimeTuning.rewardRowsPerReward,
      bossHpScale: this.runtimeTuning.bossHpScale });
  }

  private readonly onPauseKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (!event.repeat) {
        event.preventDefault();
        this.tuningPanel.toggle();
      }
      return;
    }
    const isSpace = key === ' ' || key === 'space' || key === 'spacebar';
    if (event.repeat || (key !== 'p' && !isSpace) || isInteractivePauseTarget(event.target)) return;
    if (isSpace) event.preventDefault();
    this.paused = !this.paused;
    this.viewport.classList?.toggle('game-paused', this.paused);
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    if (this.paused) {
      this.keyboardInput.stop();
      this.dragInput.stop();
      this.targetX = this.simulation.getState().player.x;
    } else {
      this.keyboardInput.start();
      this.dragInput.start();
    }
    this.pauseOverlay.setVisible(this.paused);
  };

  private readonly renderFrame = (timestampMs: number): void => {
    if (!this.running) return;
    try {
      const perf = this.perf;
      perf?.beginFrame();
      const simStartedMs = perf ? performance.now() : 0;
      const elapsedSeconds = this.previousFrameTimestampMs === null
        ? 0
        : Math.max(0, (timestampMs - this.previousFrameTimestampMs) / 1000);
      this.previousFrameTimestampMs = timestampMs;
      if (!this.paused) {
        this.presentationMs += Math.min(elapsedSeconds, this.fixedStepLoop.maxFrameSeconds) * 1000;
        this.fixedStepLoop.advance(elapsedSeconds, (dtSeconds) => this.simulation.step(
        dtSeconds,
        { targetX: this.targetX },
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
      }
      const state = this.simulation.getState();
      const simFinishedMs = perf ? performance.now() : 0;
      const presentationEvents = this.simulation.consumePresentationEvents();
      if (state.squad.count === 0 && presentationEvents.some((event) => event.after.count === 0)) {
        this.fatalPresentationUntilMs = this.presentationMs + 360;
      }
      const stream = this.level.enemyStream;
      if (stream) {
        const row = Math.max(0, Math.floor((state.player.z - stream.startZ) / stream.spacing));
        this.tierHud.setTier(highestIntroducedTierForRow(row, stream.tierProgression));
      }
      const currentDefenseValue = squadDefenseValue(state.squad, this.config.tiers.mergeCount);
      const feedback = damageFeedback(this.previousDefenseValue, currentDefenseValue);
      if (feedback) this.damageFlash.flash(feedback === 'fatal');
      const audioStartedMs = perf ? performance.now() : 0;
      this.audio.observe(this.previousDefenseValue, currentDefenseValue,
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
      const renderStartedMs = perf ? performance.now() : 0;
      const renderState: GameRenderState = {
        player: { x: state.player.x, z: state.player.z },
        squad: { count: state.squad.count, rocketCount: state.squad.rocketCount,
          rifleCounts: [...state.squad.rifleCounts],
          formationSpacing: this.config.player.formationSpacing },
        track: { halfWidth: this.config.track.halfWidth,
          defenseLineZ: state.player.z - this.config.track.defenseLineOffset },
        enemies: state.enemies.map((enemy) => ({ id: enemy.id, tier: enemy.tier,
          x: enemy.x, z: enemy.z, hp: enemy.hp })),
        boss: state.boss ? { ...state.boss, visualScale: this.config.bosses.basic.visualScale } : null,
        streamRewards: state.streamRewards.map((reward) => ({ ...reward })),
        gates: state.gates.map((gate) => ({ id: gate.id, x: gate.x, z: state.player.z + gate.zOffset, width: gate.width,
          rewardKind: gate.reward.kind, rewardAmount: gate.reward.amount,
          hitProgress: gate.hitProgress, hitsRequired: gate.reward.hitsRequired })),
        pickups: state.pickups.map((pickup) => ({ id: pickup.id, x: pickup.x,
          z: state.player.z + pickup.zOffset, rewardAmount: pickup.rewardAmount,
          rewardKind: pickup.rewardKind })),
        projectiles: state.projectiles.map((projectile) => ({ id: projectile.id, kind: projectile.kind,
          tier: projectile.tier,
          x: projectile.x, z: projectile.z, hitRadiusBonus: projectile.hitRadiusBonus })),
      };
      if (presentationEvents.length > 0) this.renderer.present(presentationEvents,
        this.presentationMs, this.config.track.halfWidth, this.config.player.formationSpacing);
      this.renderer.render(renderState, this.presentationMs);
      const renderFinishedMs = perf ? performance.now() : 0;
      this.audio.updateEnvironment(this.presentationMs);
      if (perf) {
        const audioEnvironmentFinishedMs = performance.now();
        const r = this.renderer.getDebugStats();
        perf.record(elapsedSeconds > 0 ? elapsedSeconds * 1000 : 0, simFinishedMs - simStartedMs,
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
