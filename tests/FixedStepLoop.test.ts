import { describe, expect, it, vi } from 'vitest';
import { FixedStepLoop } from '../src/core/FixedStepLoop';

describe('FixedStepLoop', () => {
  it('uses 60 Hz stepping and clamps frame gaps to 0.25 seconds by default', () => {
    const loop = new FixedStepLoop();
    const onStep = vi.fn();

    expect(loop.stepSeconds).toBe(1 / 60);
    expect(loop.maxFrameSeconds).toBe(0.25);
    expect(loop.advance(10, onStep)).toEqual({ steps: 15, alpha: 0 });
    expect(onStep).toHaveBeenCalledTimes(15);
    expect(onStep).toHaveBeenCalledWith(1 / 60);
  });

  it('accumulates insufficient time and carries a fractional remainder', () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.1, maxFrameSeconds: 1 });
    const onStep = vi.fn();

    expect(loop.advance(0.05, onStep)).toEqual({ steps: 0, alpha: 0.5 });
    expect(loop.advance(0.08, onStep).steps).toBe(1);
    expect(loop.advance(0, onStep).alpha).toBeCloseTo(0.3);
    expect(loop.advance(0.07, onStep)).toEqual({ steps: 1, alpha: 0 });
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('runs multiple exact steps and passes the fixed delta', () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.125, maxFrameSeconds: 1 });
    const onStep = vi.fn();

    expect(loop.advance(0.375, onStep)).toEqual({ steps: 3, alpha: 0 });
    expect(onStep.mock.calls).toEqual([[0.125], [0.125], [0.125]]);
  });

  it('reset clears the accumulated remainder', () => {
    const loop = new FixedStepLoop({ stepSeconds: 0.125 });
    loop.advance(0.0625, () => {});
    loop.reset();
    expect(loop.advance(0.0625, () => {})).toEqual({ steps: 0, alpha: 0.5 });
  });

  it.each([0, -1, Number.NaN, Infinity, -Infinity])('rejects invalid stepSeconds %s', (value) => {
    expect(() => new FixedStepLoop({ stepSeconds: value })).toThrow();
  });

  it.each([0, -1, Number.NaN, Infinity, -Infinity])('rejects invalid maxFrameSeconds %s', (value) => {
    expect(() => new FixedStepLoop({ maxFrameSeconds: value })).toThrow();
  });

  it.each([-1, Number.NaN, Infinity, -Infinity])('rejects invalid elapsed time %s', (value) => {
    expect(() => new FixedStepLoop().advance(value, () => {})).toThrow();
  });
});
