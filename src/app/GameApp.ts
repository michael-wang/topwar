import { FixedStepLoop } from '../core/FixedStepLoop';
import type { ConfigStore } from '../config/ConfigStore';
import type { GameConfig } from '../config/configSchema';
import { KeyboardSteeringInput } from '../input/KeyboardSteeringInput';
import { MouseSteeringInput } from '../input/MouseSteeringInput';
import { PointerDragInput } from '../input/PointerDragInput';
import type { LevelDefinition } from '../level/LevelDefinition';
import { GameRenderer } from '../rendering/GameRenderer';
import type { GameRenderState } from '../rendering/RenderState';
import { Simulation } from '../simulation/Simulation';
import { GameOverOverlay } from '../ui/GameOverOverlay';

export class GameApp {
  private readonly renderer: GameRenderer;
  private readonly fixedStepLoop = new FixedStepLoop();
  private simulation: Simulation;
  private readonly gameOverOverlay: GameOverOverlay;
  private readonly dragInput: PointerDragInput;
  private readonly mouseInput: MouseSteeringInput;
  private readonly keyboardInput: KeyboardSteeringInput;
  private readonly unsubscribeConfig: () => void;
  private config: Readonly<GameConfig>;
  private targetX: number;
  private dragStartPlayerX = 0;
  private rebaseMouseTarget = false;
  private frameId: number | null = null;
  private previousFrameTimestampMs: number | null = null;
  private running = false;
  private disposed = false;

  constructor(viewport: HTMLElement, configStore: ConfigStore, private readonly level: LevelDefinition) {
    this.config = configStore.getConfig();
    this.simulation = new Simulation({
      seed: 1,
      level,
      startSquad: this.config.player.startSquad,
      startRocketCount: this.config.player.startRocketCount,
      gruntHp: this.config.enemies.grunt.hp,
      bruteHp: this.config.enemies.brute.hp,
    });
    this.targetX = this.simulation.getState().player.x;
    this.renderer = new GameRenderer(viewport);
    this.gameOverOverlay = new GameOverOverlay(viewport, () => this.retry());
    this.dragInput = new PointerDragInput(viewport, {
      onDragStart: () => {
        this.dragStartPlayerX = this.simulation.getState().player.x;
        this.targetX = this.dragStartPlayerX;
        this.rebaseMouseTarget = true;
      },
      onDrag: (normalizedDeltaX) => {
        this.targetX = this.dragStartPlayerX + normalizedDeltaX * (this.config.track.halfWidth * 2);
      },
    });
    this.mouseInput = new MouseSteeringInput(viewport, {
      onMove: (normalizedDeltaX) => {
        if (this.rebaseMouseTarget) {
          this.targetX = this.simulation.getState().player.x;
          this.rebaseMouseTarget = false;
        }
        const halfWidth = this.config.track.halfWidth;
        const deltaX = normalizedDeltaX * (halfWidth * 2) * this.config.controls.mouseSensitivity;
        this.targetX = Math.max(-halfWidth, Math.min(halfWidth, this.targetX + deltaX));
      },
    });
    this.keyboardInput = new KeyboardSteeringInput(window, {
      onAxisChange: (axis) => {
        this.targetX = axis === 0
          ? this.simulation.getState().player.x
          : axis * this.config.track.halfWidth;
        this.rebaseMouseTarget = true;
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
    this.mouseInput.start();
    this.keyboardInput.start();
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    this.keyboardInput.stop();
    this.mouseInput.stop();
    this.dragInput.stop();
    this.renderer.stopResizeHandling();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.unsubscribeConfig();
    this.dragInput.dispose();
    this.mouseInput.dispose();
    this.keyboardInput.dispose();
    this.gameOverOverlay.dispose();
    this.renderer.dispose();
    this.disposed = true;
  }

  private retry(): void {
    if (this.disposed) throw new Error('Cannot retry a disposed GameApp');
    this.simulation = new Simulation({
      seed: 1,
      level: this.level,
      startSquad: this.config.player.startSquad,
      startRocketCount: this.config.player.startRocketCount,
      gruntHp: this.config.enemies.grunt.hp,
      bruteHp: this.config.enemies.brute.hp,
    });
    this.targetX = this.simulation.getState().player.x;
    this.dragStartPlayerX = this.targetX;
    this.rebaseMouseTarget = true;
    this.fixedStepLoop.reset();
    this.previousFrameTimestampMs = null;
    this.gameOverOverlay.setVisible(false);
  }

  private readonly renderFrame = (timestampMs: number): void => {
    if (!this.running) return;
    const elapsedSeconds = this.previousFrameTimestampMs === null
      ? 0
      : Math.max(0, (timestampMs - this.previousFrameTimestampMs) / 1000);
    this.previousFrameTimestampMs = timestampMs;
    this.fixedStepLoop.advance(elapsedSeconds, (dtSeconds) => this.simulation.step(
      dtSeconds,
      { targetX: this.targetX },
      {
        moveSpeed: this.config.player.moveSpeed,
        forwardSpeed: this.config.player.forwardSpeed,
        trackHalfWidth: this.config.track.halfWidth,
        defenseLineOffset: this.config.track.defenseLineOffset,
        formationSpacing: this.config.player.formationSpacing,
        memberRadius: this.config.player.memberRadius,
        gruntRadius: this.config.enemies.grunt.radius,
        gruntContactDamage: this.config.enemies.grunt.contactDamage,
        bruteRadius: this.config.enemies.brute.radius,
        bruteContactDamage: this.config.enemies.brute.contactDamage,
        rifle: { ...this.config.weapon.rifle },
        rocket: { ...this.config.weapon.rocket },
      },
    ));
    const state = this.simulation.getState();
    const renderState: GameRenderState = {
      player: { x: state.player.x, z: state.player.z },
      squad: { count: state.squad.count, rocketCount: state.squad.rocketCount,
        tier2RifleCount: state.squad.tier2RifleCount,
        formationSpacing: this.config.player.formationSpacing },
      track: { halfWidth: this.config.track.halfWidth,
        defenseLineZ: state.player.z - this.config.track.defenseLineOffset },
      enemies: state.enemies.map((enemy) => ({ id: enemy.id, type: enemy.type, x: enemy.x, z: enemy.z })),
      gates: state.gates.map((gate) => ({ id: gate.id, x: gate.x, z: state.player.z + gate.zOffset, width: gate.width,
        hp: gate.hp, maxHp: gate.maxHp, rewardMode: gate.reward.mode, rewardKind: gate.reward.kind,
        rewardAmount: gate.reward.amount,
        rewardIntervalSeconds: gate.reward.mode === 'pickup' ? gate.reward.intervalSeconds : null })),
      pickups: state.pickups.map((pickup) => ({ id: pickup.id, x: pickup.x,
        z: state.player.z + pickup.zOffset, rewardAmount: pickup.rewardAmount,
        rewardKind: pickup.rewardKind })),
      projectiles: state.projectiles.map((projectile) => ({ id: projectile.id, kind: projectile.kind,
        x: projectile.x, z: projectile.z })),
    };
    this.renderer.render(renderState);
    this.gameOverOverlay.setVisible(state.squad.count === 0);
    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}
