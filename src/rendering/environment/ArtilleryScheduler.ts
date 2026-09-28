export type ArtilleryLayer = 'near' | 'mid' | 'far';

export interface ArtillerySite {
  layer: ArtilleryLayer;
  x: number;
  z: number;
  y?: number;
}

export const ARTILLERY_SITES: readonly ArtillerySite[] = [
  { layer: 'near', x: -12.8, z: -6.4 },
  { layer: 'near', x: 13.2, z: -5.8 },
  { layer: 'near', x: -8.9, y: -.48, z: -22 },
  { layer: 'near', x: 9.1, y: -.48, z: -23 },
  { layer: 'mid', x: -10.8, z: -4.8 },
  { layer: 'mid', x: 12.3, z: -2.7 },
  { layer: 'mid', x: 10.2, z: 3.5 },
  // These sites sit beneath the ghost cranes, terminal, and transports.
  { layer: 'far', x: -12.6, z: -2.8 },
  { layer: 'far', x: 11.8, z: -3.6 },
  { layer: 'far', x: 17.1, z: -4.2 },
];

const SITES_BY_LAYER: readonly (readonly number[])[] = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]];

// Visual-only LCG. Each bag of three primary impacts visits every depth once.
export class ArtilleryScheduler {
  private seed: number;
  private nextPrimaryAtMs: number;
  private secondAtMs = Infinity;
  private secondSite = -1;
  private lastNowMs = 0;
  private readonly layerBag = [0, 1, 2];
  private bagCursor = 3;
  private lastSite = -1;

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
      this.lastSite = this.secondSite;
      return this.secondSite;
    }
    if (nowMs < this.nextPrimaryAtMs) return -1;
    const layer = this.nextLayer();
    const site = this.site(layer);
    this.lastSite = site;
    if (this.random() < .28) {
      this.secondAtMs = nowMs + 140 + this.random() * 180;
      const otherLayer = (layer + 1 + Math.floor(this.random() * 2)) % 3;
      this.secondSite = this.site(otherLayer);
    }
    this.nextPrimaryAtMs = nowMs + this.interval();
    return site;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  private interval(): number { return 1500 + this.random() * 1700; }

  private nextLayer(): number {
    if (this.bagCursor === 3) {
      this.layerBag[0] = 0;
      this.layerBag[1] = 1;
      this.layerBag[2] = 2;
      for (let index = 2; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        [this.layerBag[index], this.layerBag[other]] =
          [this.layerBag[other], this.layerBag[index]];
      }
      this.bagCursor = 0;
    }
    return this.layerBag[this.bagCursor++];
  }

  private site(layer: number): number {
    const sites = SITES_BY_LAYER[layer];
    const first = Math.floor(this.random() * sites.length);
    const site = sites[first];
    return site === this.lastSite ? sites[(first + 1) % sites.length] : site;
  }
}
