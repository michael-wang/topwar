import { GameRenderer } from '../rendering/GameRenderer';

export class GameApp {
  private readonly renderer: GameRenderer;
  private frameId: number | null = null;
  private running = false;
  private disposed = false;

  constructor(viewport: HTMLElement) {
    this.renderer = new GameRenderer(viewport);
  }

  start(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameApp');
    if (this.running) return;

    this.running = true;
    this.renderer.startResizeHandling();
    this.frameId = requestAnimationFrame(this.renderFrame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.renderer.stopResizeHandling();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.renderer.dispose();
    this.disposed = true;
  }

  private readonly renderFrame = (): void => {
    if (!this.running) return;
    this.renderer.render();
    this.frameId = requestAnimationFrame(this.renderFrame);
  };
}
