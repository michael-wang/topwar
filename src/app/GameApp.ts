import { FixedStepLoop } from '../core/FixedStepLoop';
import type { ConfigStore } from '../config/ConfigStore';
import type { GameConfig } from '../config/configSchema';
import { GameRenderer } from '../rendering/GameRenderer';
import type { GameRenderState } from '../rendering/RenderState';
import { Simulation } from '../simulation/Simulation';

export class GameApp {
  private readonly renderer: GameRenderer;
  private readonly fixedStepLoop = new FixedStepLoop();
  private readonly simulation: Simulation;
  private readonly unsubscribeConfig: () => void;
  private config: Readonly<GameConfig>;
  private frameId: number | null = null;
  private previousFrameTimestampMs: number | null = null;
  private running = false;
  private disposed = false;

  constructor(viewport: HTMLElement, configStore: ConfigStore) {
    this.config = configStore.getConfig();
    this.simulation = new Simulation({
      seed: 1,
      levelId: 'prototype',
      startSquad: this.config.player.startSquad,
    });
    this.renderer = new GameRenderer(viewport);
    this.unsubscribeConfig = configStore.subscribe((config) => { this.config = config; });
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameApp');
    if (this.running) return;

    this.running = true;
    this.previousFrameTimestampMs = null;
    this.renderer.startResizeHandling();
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousFrameTimestampMs = null;
    this.fixedStepLoop.reset();
    this.renderer.stopResizeHandling();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.unsubscribeConfig();
    this.renderer.dispose();
    this.disposed = true;
  }

  private readonly renderFrame = (timestampMs: number): void => {
    if (!this.running) return;
    const elapsedSeconds = this.previousFrameTimestampMs === null
      ? 0
      : Math.max(0, (timestampMs - this.previousFrameTimestampMs) / 1000);
    this.previousFrameTimestampMs = timestampMs;
    this.fixedStepLoop.advance(elapsedSeconds, (dtSeconds) => this.simulation.step(dtSeconds));
    const state = this.simulation.getState();
    const renderState: GameRenderState = {
      player: { x: state.player.x, z: state.player.z },
      squad: { count: state.squad.count, formationSpacing: this.config.player.formationSpacing },
    };
    this.renderer.render(renderState);
    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}
