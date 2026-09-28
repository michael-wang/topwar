export interface InfernoSurgeState {
  surgeStartMs: number;
  surgeDurationMs: number;
  nextSurgeAtMs: number;
  intensity: number;
  heightScale: number;
  widthScale: number;
  smokeScale: number;
  strength: number;
}

type Source = InfernoSurgeState & { seed: number };

// Three independent presentation clocks. No simulation state or gameplay RNG is consumed.
export class InfernoSurgeScheduler {
  private readonly sources: Source[] = [];
  private lastNowMs = 0;

  constructor(private readonly initialSeed = 0x1f3e70a9) {
    this.reset();
  }

  get states(): readonly InfernoSurgeState[] { return this.sources; }

  update(nowMs: number): readonly InfernoSurgeState[] {
    if (nowMs < this.lastNowMs) this.reset();
    this.lastNowMs = nowMs;
    for (const source of this.sources) {
      if (nowMs >= source.nextSurgeAtMs) {
        source.surgeStartMs = nowMs;
        source.surgeDurationMs = 1500 + this.random(source) * 3000;
        source.intensity = .55 + this.random(source) * .55;
        source.heightScale = .8 + this.random(source) * .6;
        source.widthScale = .85 + this.random(source) * .45;
        source.smokeScale = .65 + this.random(source) * .6;
        source.nextSurgeAtMs = nowMs + source.surgeDurationMs
          + 3000 + this.random(source) * 7000;
      }
      const progress = (nowMs - source.surgeStartMs) / source.surgeDurationMs;
      source.strength = progress >= 0 && progress <= 1
        ? Math.sin(Math.PI * progress) * source.intensity : 0;
    }
    return this.sources;
  }

  reset(): void {
    this.sources.length = 0;
    this.lastNowMs = 0;
    for (let index = 0; index < 3; index++) {
      const source: Source = { seed: (this.initialSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0,
        surgeStartMs: -Infinity, surgeDurationMs: 1, nextSurgeAtMs: 0,
        intensity: 0, heightScale: 1, widthScale: 1, smokeScale: 1, strength: 0 };
      source.nextSurgeAtMs = 2400 + this.random(source) * 4200;
      this.sources.push(source);
    }
  }

  private random(source: Source): number {
    source.seed = (Math.imul(source.seed, 1664525) + 1013904223) >>> 0;
    return source.seed / 0x100000000;
  }
}
