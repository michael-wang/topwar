import { GROUND_ARTILLERY_CUE, SKY_FLAK_CUE } from './EnvironmentAudioCue';

// Independent presentation clock: audible distant fighting need not match a visible flash.
export class EnvironmentAudioScheduler {
  private seed: number;
  private lastNowMs = 0;
  private groundAtMs: number;
  private flakAtMs: number;

  constructor(private readonly initialSeed = 0x7a31d10) {
    this.seed = initialSeed >>> 0;
    this.groundAtMs = this.groundInterval();
    this.flakAtMs = this.flakInterval();
  }

  get nextGroundAtMs(): number { return this.groundAtMs; }
  get nextFlakAtMs(): number { return this.flakAtMs; }
  get nextEventMs(): number { return Math.min(this.groundAtMs, this.flakAtMs); }

  update(nowMs: number): number {
    if (nowMs < this.lastNowMs) this.reset();
    this.lastNowMs = nowMs;
    let cues = 0;
    if (nowMs >= this.groundAtMs) {
      cues |= GROUND_ARTILLERY_CUE;
      this.groundAtMs = nowMs + this.groundInterval();
    }
    if (nowMs >= this.flakAtMs) {
      cues |= SKY_FLAK_CUE;
      this.flakAtMs = nowMs + this.flakInterval();
    }
    return cues;
  }

  reset(): void {
    this.seed = this.initialSeed >>> 0;
    this.lastNowMs = 0;
    this.groundAtMs = this.groundInterval();
    this.flakAtMs = this.flakInterval();
  }

  private groundInterval(): number { return 2000 + this.random() * 3000; }
  private flakInterval(): number { return 3500 + this.random() * 3500; }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
