export const SHIP_STARTED = 1;
export const AIRCRAFT_STARTED = 2;
export const SKY_FLAK_STARTED = 4;

// Presentation-only timing; no Simulation state or gameplay RNG is consumed.
export class WarActivityScheduler {
  private seed: number;
  private lastNowMs = 0;
  private nextShipMs: number;
  private nextAircraftMs: number;
  private nextFlakMs: number;
  shipStartedAtMs = -Infinity;
  aircraftStartedAtMs = -Infinity;
  flakStartedAtMs = -Infinity;
  shipSide = 1;
  shipX = 9;
  aircraftSide = 1;
  flakX = 0;
  flakY = 17;

  constructor(private readonly initialSeed = 0x4a7f21) {
    this.seed = initialSeed >>> 0;
    this.nextShipMs = 3500 + this.random() * 3000;
    this.nextAircraftMs = 2500 + this.random() * 3000;
    this.nextFlakMs = 2000 + this.random() * 2500;
  }

  get nextEventMs(): number {
    return Math.min(this.nextShipMs, this.nextAircraftMs, this.nextFlakMs);
  }

  update(nowMs: number): number {
    if (nowMs < this.lastNowMs) this.reset();
    this.lastNowMs = nowMs;
    let events = 0;
    if (nowMs >= this.nextShipMs) {
      this.shipStartedAtMs = nowMs;
      this.shipSide = this.random() < .5 ? -1 : 1;
      this.shipX = this.shipSide * (8.8 + this.random() * 2);
      this.nextShipMs = nowMs + 11000 + 6500 + this.random() * 8500;
      events |= SHIP_STARTED;
    }
    if (nowMs >= this.nextAircraftMs) {
      this.aircraftStartedAtMs = nowMs;
      this.aircraftSide = this.random() < .5 ? -1 : 1;
      this.nextAircraftMs = nowMs + 10000 + 7000 + this.random() * 9000;
      events |= AIRCRAFT_STARTED;
    }
    if (nowMs >= this.nextFlakMs) {
      this.flakStartedAtMs = nowMs;
      this.flakX = (this.random() * 2 - 1) * 19;
      this.flakY = 14 + this.random() * 5;
      this.nextFlakMs = nowMs + 5500 + this.random() * 4500;
      events |= SKY_FLAK_STARTED;
    }
    return events;
  }

  private reset(): void {
    this.seed = this.initialSeed >>> 0;
    this.nextShipMs = 3500 + this.random() * 3000;
    this.nextAircraftMs = 2500 + this.random() * 3000;
    this.nextFlakMs = 2000 + this.random() * 2500;
    this.shipStartedAtMs = -Infinity;
    this.aircraftStartedAtMs = -Infinity;
    this.flakStartedAtMs = -Infinity;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
