export interface FixedStepAdvanceResult {
  steps: number;
  alpha: number;
}

export interface FixedStepLoopOptions {
  stepSeconds?: number;
  maxFrameSeconds?: number;
}

export class FixedStepLoop {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  private accumulatorSeconds = 0;

  constructor(options: FixedStepLoopOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 60;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.25;

    if (!Number.isFinite(this.stepSeconds) || this.stepSeconds <= 0) {
      throw new Error('stepSeconds must be finite and greater than zero');
    }
    if (!Number.isFinite(this.maxFrameSeconds) || this.maxFrameSeconds <= 0) {
      throw new Error('maxFrameSeconds must be finite and greater than zero');
    }
  }

  advance(elapsedSeconds: number, onStep: (dtSeconds: number) => void): FixedStepAdvanceResult {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error('elapsedSeconds must be finite and non-negative');
    }

    // Discard long background-tab gaps instead of simulating an unbounded catch-up burst.
    this.accumulatorSeconds += Math.min(elapsedSeconds, this.maxFrameSeconds);

    let steps = 0;
    const tolerance = this.stepSeconds * 1e-9;
    while (this.accumulatorSeconds + tolerance >= this.stepSeconds) {
      this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - this.stepSeconds);
      if (this.accumulatorSeconds < tolerance) this.accumulatorSeconds = 0;
      onStep(this.stepSeconds);
      steps++;
    }

    return { steps, alpha: this.accumulatorSeconds / this.stepSeconds };
  }

  reset(): void {
    this.accumulatorSeconds = 0;
  }
}
