export interface GameRng {
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  getState(): number;
  setState(state: number): void;
}

const UINT32_MAX = 0xffffffff;
const UINT32_RANGE = 0x100000000;

export class SeededRng implements GameRng {
  private state: number;

  constructor(seed: number) {
    this.state = 0;
    this.setState(seed);
  }

  nextFloat(): number {
    // Math.imul preserves 32-bit multiplication; >>> 0 stores the unsigned state.
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / UINT32_RANGE;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer');
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > UINT32_MAX) {
      throw new Error('RNG state must be an unsigned 32-bit integer');
    }
    this.state = state;
  }
}
