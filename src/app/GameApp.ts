import { FixedStepLoop } from '../core/FixedStepLoop';
import { GameRenderer } from '../rendering/GameRenderer';
import { Simulation } from '../simulation/Simulation';

export class GameApp {
  private readonly renderer: GameRenderer;
  private readonly fixedStepLoop = new FixedStepLoop();
  private readonly simulation = new Simulation({ seed: 1, levelId: 'prototype' });
  private frameId: number | null = null;
  private previousFrameTimestampMs: number | null = null;
  private running = false;
  private disposed = false;

  constructor(viewport: HTMLElement) {
    this.renderer = new GameRenderer(viewport);
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
    this.renderer.render();
    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}
