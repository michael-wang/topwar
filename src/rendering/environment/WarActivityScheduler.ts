export const AIRCRAFT_STARTED = 2;
export const AIRCRAFT_PASS_MS = 4500;

export interface AircraftPass {
  startedAtMs: number;
  side: number;
  y: number;
  z: number;
}

// Presentation-only timing; no Simulation state or gameplay RNG is consumed.
export class WarActivityScheduler {
  private seed: number;
  private lastNowMs = 0;
  private nextAircraftMs: number;
  private nextWingmanMs = Infinity;
  readonly aircraftPasses: [AircraftPass, AircraftPass] = [
    { startedAtMs: -Infinity, side: 1, y: 17, z: -15 },
    { startedAtMs: -Infinity, side: -1, y: 19.5, z: -23 },
  ];

  constructor(private readonly initialSeed = 0x4a7f21) {
    this.seed = initialSeed >>> 0;
    this.nextAircraftMs = 2500 + this.random() * 3000;
  }

  get nextEventMs(): number {
    return Math.min(this.nextAircraftMs, this.nextWingmanMs);
  }

  update(nowMs: number): number {
    if (nowMs < this.lastNowMs) this.reset();
    this.lastNowMs = nowMs;
    let events = 0;
    if (nowMs >= this.nextAircraftMs) {
      const side = this.random() < .5 ? -1 : 1;
      this.aircraftPasses[0].startedAtMs = nowMs;
      this.aircraftPasses[0].side = side;
      this.aircraftPasses[1].side = -side;
      this.nextWingmanMs = this.random() < .32 ? nowMs + 700 + this.random() * 1000
        : Infinity;
      this.nextAircraftMs = nowMs + AIRCRAFT_PASS_MS + 4500 + this.random() * 5000;
      events |= AIRCRAFT_STARTED;
    }
    if (nowMs >= this.nextWingmanMs) {
      this.aircraftPasses[1].startedAtMs = nowMs;
      this.nextWingmanMs = Infinity;
      events |= AIRCRAFT_STARTED;
    }
    return events;
  }

  private reset(): void {
    this.seed = this.initialSeed >>> 0;
    this.nextAircraftMs = 2500 + this.random() * 3000;
    this.nextWingmanMs = Infinity;
    for (const pass of this.aircraftPasses) pass.startedAtMs = -Infinity;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
