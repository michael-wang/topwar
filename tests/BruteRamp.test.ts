import { describe, expect, it } from 'vitest';
import { tier2ProbabilityForRow, tier2RollForSlot } from '../src/simulation/enemies/bruteRamp';

const ramp = { startRow: 48, fullRow: 144, curvePower: 2 };

describe('deterministic Tier-2 probability', () => {
  it('rises smoothly from zero to one and stays within bounds', () => {
    expect(tier2ProbabilityForRow(0, ramp)).toBe(0);
    expect(tier2ProbabilityForRow(47, ramp)).toBe(0);
    expect(tier2ProbabilityForRow(48, ramp)).toBe(0); // guaranteed reveal is separate
    expect(tier2ProbabilityForRow(72, ramp)).toBeCloseTo(0.0625);
    expect(tier2ProbabilityForRow(96, ramp)).toBeCloseTo(0.25);
    expect(tier2ProbabilityForRow(120, ramp)).toBeCloseTo(0.5625);
    expect(tier2ProbabilityForRow(136, ramp)).toBeCloseTo((88 / 96) ** 2);
    expect(tier2ProbabilityForRow(144, ramp)).toBe(1);
    expect(tier2ProbabilityForRow(200, ramp)).toBe(1);
    let previous = 0;
    for (let row = 0; row <= 200; row++) {
      const probability = tier2ProbabilityForRow(row, ramp);
      expect(probability).toBeGreaterThanOrEqual(previous);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      previous = probability;
    }
  });

  it('gives each seed, row, and slot a repeatable independent roll', () => {
    const rolls = (seed: number, row: number) =>
      Array.from({ length: 7 }, (_, slot) => tier2RollForSlot(seed, row, slot));
    expect(rolls(104729, 96)).toEqual(rolls(104729, 96));
    expect(rolls(104729, 96)).not.toEqual(rolls(104729, 97));
    expect(rolls(104729, 96)).not.toEqual(rolls(104730, 96));
    for (const roll of rolls(104729, 96)) {
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });
});
