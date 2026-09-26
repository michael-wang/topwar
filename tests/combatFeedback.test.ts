import { describe, expect, it } from 'vitest';
import { damageFeedback, squadDefenseValue } from '../src/app/combatFeedback';
import { compactRifleValue } from '../src/simulation/squad/composition';

describe('visual-only squad damage feedback', () => {
  it('counts Tier-1, Tier-2, and rocket defensive value', () => {
    expect(squadDefenseValue({ count: 1, rifleCounts: [1], rocketCount: 0, rifleRemainder: 0 }, 10)).toBe(1n);
    expect(squadDefenseValue({ count: 1, rifleCounts: [0, 1], rocketCount: 0, rifleRemainder: 0 }, 10)).toBe(10n);
    expect(squadDefenseValue({ count: 9, rifleCounts: [9], rocketCount: 0, rifleRemainder: 0 }, 10)).toBe(9n);
    expect(squadDefenseValue({ count: 5, rifleCounts: [2, 2], rocketCount: 1, rifleRemainder: 0 }, 10)).toBe(23n);
    expect(squadDefenseValue({ count: 1, rifleCounts: [0, 0, 0, 1], rocketCount: 0, rifleRemainder: 6 }, 10)).toBe(1006n);
    expect(squadDefenseValue({ count: 10, rifleCounts: [0, 9, 1], rocketCount: 0, rifleRemainder: 9 }, 10)).toBe(199n);
  });

  it('detects demotion as damage, ignores growth, and marks a zero-defense loss fatal', () => {
    expect(damageFeedback(10, 9)).toBe('normal');
    expect(damageFeedback(9, 10)).toBeNull();
    expect(damageFeedback(9, 9)).toBeNull();
    expect(damageFeedback(1, 0)).toBe('fatal');
  });

  it('compares defense above the safe-number boundary exactly', () => {
    const high = squadDefenseValue(compactRifleValue(10n ** 19n + 1n, 10), 10);
    expect(high).toBe(10n ** 19n + 1n);
    expect(damageFeedback(high, high - 1n)).toBe('normal');
    expect(damageFeedback(high - 1n, high)).toBeNull();
  });
});
