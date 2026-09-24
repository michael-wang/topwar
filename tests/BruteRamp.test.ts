import { describe, expect, it } from 'vitest';
import { tier2ProbabilityForRow, tier2RollForSlot } from '../src/simulation/enemies/bruteRamp';

const ramp = { startRow: 96, fullRow: 480 };

describe('deterministic Tier-2 probability', () => {
  it('rises smoothly from zero to one and stays within bounds', () => {
    expect(tier2ProbabilityForRow(0, ramp)).toBe(0);
    expect(tier2ProbabilityForRow(95, ramp)).toBe(0);
    expect(tier2ProbabilityForRow(96, ramp)).toBe(0); // guaranteed reveal is separate
    expect(tier2ProbabilityForRow(160, ramp)).toBeCloseTo(1 / 6);
    expect(tier2ProbabilityForRow(288, ramp)).toBeCloseTo(1 / 2);
    expect(tier2ProbabilityForRow(384, ramp)).toBeCloseTo(3 / 4);
    expect(tier2ProbabilityForRow(480, ramp)).toBe(1);
    expect(tier2ProbabilityForRow(1000, ramp)).toBe(1);
    let previous = 0;
    for (let row = 0; row <= 600; row++) {
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
    expect(rolls(104729, 288)).toEqual(rolls(104729, 288));
    expect(rolls(104729, 288)).not.toEqual(rolls(104729, 289));
    expect(rolls(104729, 288)).not.toEqual(rolls(104730, 288));
    for (const roll of rolls(104729, 288)) {
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });
});
