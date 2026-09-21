import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src/core/Rng';

describe('SeededRng', () => {
  it('matches the specified LCG sequence from zero seed', () => {
    const rng = new SeededRng(0);
    const expectedStates = [1013904223, 1196435762, 3519870697, 2868466484, 1649599747];

    for (const state of expectedStates) {
      expect(rng.nextFloat()).toBe(state / 4294967296);
      expect(rng.getState()).toBe(state);
    }
  });

  it('repeats for the same seed and differs for another seed', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const c = new SeededRng(43);
    const sequence = () => [a.nextFloat(), a.nextFloat(), a.nextFloat()];

    expect(sequence()).toEqual([b.nextFloat(), b.nextFloat(), b.nextFloat()]);
    expect(new SeededRng(42).nextFloat()).not.toBe(c.nextFloat());
  });

  it('keeps float and integer outputs in range', () => {
    const rng = new SeededRng(0xffffffff);
    for (let i = 0; i < 1000; i++) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const integer = rng.nextInt(7);
      expect(integer).toBeGreaterThanOrEqual(0);
      expect(integer).toBeLessThan(7);
      expect(Number.isInteger(integer)).toBe(true);
    }
  });

  it('restores subsequent values exactly from serialized state', () => {
    const rng = new SeededRng(123);
    rng.nextFloat();
    const saved = rng.getState();
    expect(JSON.parse(JSON.stringify(saved))).toBe(saved);
    const future = [rng.nextFloat(), rng.nextInt(10), rng.nextFloat()];

    rng.setState(saved);
    expect([rng.nextFloat(), rng.nextInt(10), rng.nextFloat()]).toEqual(future);
  });

  it.each([-1, 4294967296, 1.5, Number.NaN, Infinity, -Infinity])(
    'rejects invalid seed and state %s',
    (value) => {
      expect(() => new SeededRng(value)).toThrow();
      expect(() => new SeededRng(0).setState(value)).toThrow();
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Infinity, -Infinity])(
    'rejects invalid maxExclusive %s',
    (value) => {
      expect(() => new SeededRng(0).nextInt(value)).toThrow();
    },
  );
});
