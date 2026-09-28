export type ArtilleryLayer = 'mid' | 'far';

export interface ArtillerySite {
  layer: ArtilleryLayer;
  x: number;
  z: number;
}

export const ARTILLERY_SITES: readonly ArtillerySite[] = [
  { layer: 'mid', x: -10.8, z: -4.8 },
  { layer: 'mid', x: 12.3, z: -2.7 },
  { layer: 'mid', x: 10.2, z: 3.5 },
  { layer: 'far', x: -14.1, z: -3.2 },
  { layer: 'far', x: 14.4, z: -4.3 },
];

// Visual-only LCG. It never consumes the simulation RNG or enters a snapshot.
export class ArtilleryScheduler {
  private seed: number;
  private nextPrimaryAtMs: number;
  private secondAtMs = Infinity;
  private lastSite = -1;
  private lastNowMs = 0;

  constructor(seed = 0x51f15e) {
    this.seed = seed >>> 0;
    this.nextPrimaryAtMs = this.interval();
  }

  get nextImpactAtMs(): number { return Math.min(this.nextPrimaryAtMs, this.secondAtMs); }

  update(nowMs: number): number {
    if (nowMs < this.lastNowMs) {
      this.secondAtMs = Infinity;
      this.nextPrimaryAtMs = nowMs + this.interval();
    }
    this.lastNowMs = nowMs;
    if (nowMs >= this.secondAtMs) {
      this.secondAtMs = Infinity;
      return this.site();
    }
    if (nowMs < this.nextPrimaryAtMs) return -1;
    const site = this.site();
    if (this.random() < .2) this.secondAtMs = nowMs + 150 + this.random() * 250;
    this.nextPrimaryAtMs = (this.secondAtMs < Infinity ? this.secondAtMs : nowMs) + this.interval();
    return site;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  private interval(): number { return 2500 + this.random() * 3500; }

  private site(): number {
    const first = Math.floor(this.random() * ARTILLERY_SITES.length);
    const site = first === this.lastSite ? (first + 1) % ARTILLERY_SITES.length : first;
    this.lastSite = site;
    return site;
  }
}
