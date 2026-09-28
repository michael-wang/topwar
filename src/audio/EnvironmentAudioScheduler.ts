export type GroundArtilleryAudioEvent = {
  kind: 'groundArtillery';
  volumeScale: number;
  durationScale: number;
  pitchScale: number;
};
export type EnvironmentAudioEvent = GroundArtilleryAudioEvent | { kind: 'skyFlak' };

// Independent presentation clock: audible distant fighting need not match a visible flash.
export class EnvironmentAudioScheduler {
  private seed: number;
  private lastNowMs = 0;
  private groundAtMs: number;
  private flakAtMs: number;
  private shortGroundStreak = 0;
  private readonly events: EnvironmentAudioEvent[] = [];

  constructor(private readonly initialSeed = 0x7a31d10) {
    this.seed = initialSeed >>> 0;
    this.groundAtMs = this.groundInterval();
    this.flakAtMs = this.flakInterval();
  }

  get nextGroundAtMs(): number { return this.groundAtMs; }
  get nextFlakAtMs(): number { return this.flakAtMs; }
  get nextEventMs(): number { return Math.min(this.groundAtMs, this.flakAtMs); }

  update(nowMs: number): readonly EnvironmentAudioEvent[] {
    if (nowMs < this.lastNowMs) this.reset();
    this.lastNowMs = nowMs;
    this.events.length = 0;
    if (nowMs >= this.groundAtMs) {
      this.events.push({ kind: 'groundArtillery',
        volumeScale: .55 + this.random() * .65,
        durationScale: .65 + this.random() * .85,
        pitchScale: .88 + this.random() * .2 });
      this.groundAtMs = nowMs + this.groundInterval();
    }
    if (nowMs >= this.flakAtMs) {
      this.events.push({ kind: 'skyFlak' });
      this.flakAtMs = nowMs + this.flakInterval();
    }
    return this.events;
  }

  reset(): void {
    this.seed = this.initialSeed >>> 0;
    this.lastNowMs = 0;
    this.shortGroundStreak = 0;
    this.events.length = 0;
    this.groundAtMs = this.groundInterval();
    this.flakAtMs = this.flakInterval();
  }

  private groundInterval(): number {
    const band = this.random();
    if (band < .2 && this.shortGroundStreak < 2) {
      this.shortGroundStreak++;
      return 1200 + this.random() * 1000;
    }
    this.shortGroundStreak = 0;
    if (band < .75) return 2400 + this.random() * 2600;
    return 5200 + this.random() * 3300;
  }
  private flakInterval(): number { return 3500 + this.random() * 3500; }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
