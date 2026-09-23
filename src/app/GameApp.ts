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

export class GameApp {
  private readonly renderer: GameRenderer;
  private readonly fixedStepLoop = new FixedStepLoop();
  private readonly simulation: Simulation;
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

  constructor(viewport: HTMLElement, configStore: ConfigStore, level: LevelDefinition) {
    this.config = configStore.getConfig();
    this.simulation = new Simulation({
      seed: 1,
      level,
      startSquad: this.config.player.startSquad,
      gruntHp: this.config.enemies.grunt.hp,
    });
    this.targetX = this.simulation.getState().player.x;
    this.renderer = new GameRenderer(viewport);
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
    this.renderer.dispose();
    this.disposed = true;
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
        formationSpacing: this.config.player.formationSpacing,
        memberRadius: this.config.player.memberRadius,
        gruntRadius: this.config.enemies.grunt.radius,
        gruntContactDamage: this.config.enemies.grunt.contactDamage,
        rifle: { ...this.config.weapon.rifle },
      },
    ));
    const state = this.simulation.getState();
    const renderState: GameRenderState = {
      player: { x: state.player.x, z: state.player.z },
      squad: { count: state.squad.count, formationSpacing: this.config.player.formationSpacing },
      track: { halfWidth: this.config.track.halfWidth },
      enemies: state.enemies.map((enemy) => ({ id: enemy.id, type: enemy.type, x: enemy.x, z: enemy.z })),
      projectiles: state.projectiles.map((projectile) => ({ id: projectile.id, x: projectile.x, z: projectile.z })),
    };
    this.renderer.render(renderState);
    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}
