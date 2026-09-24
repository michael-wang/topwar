import { describe, expect, it } from 'vitest';
import { damageFeedback, squadDefenseValue } from '../src/app/combatFeedback';

describe('visual-only squad damage feedback', () => {
  it('counts Tier-1, Tier-2, and rocket defensive value', () => {
    expect(squadDefenseValue({ count: 1, rifleCounts: [1], rocketCount: 0 }, 10)).toBe(1);
    expect(squadDefenseValue({ count: 1, rifleCounts: [0, 1], rocketCount: 0 }, 10)).toBe(10);
    expect(squadDefenseValue({ count: 9, rifleCounts: [9], rocketCount: 0 }, 10)).toBe(9);
    expect(squadDefenseValue({ count: 5, rifleCounts: [2, 2], rocketCount: 1 }, 10)).toBe(23);
    expect(squadDefenseValue({ count: 1, rifleCounts: [0, 0, 0, 1], rocketCount: 0 }, 10)).toBe(1000);
  });

  it('detects demotion as damage, ignores growth, and marks a zero-defense loss fatal', () => {
    expect(damageFeedback(10, 9)).toBe('normal');
    expect(damageFeedback(9, 10)).toBeNull();
    expect(damageFeedback(9, 9)).toBeNull();
    expect(damageFeedback(1, 0)).toBe('fatal');
  });
});
