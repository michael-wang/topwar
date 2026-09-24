import { describe, expect, it } from 'vitest';
import { damageFeedback, squadDefenseValue } from '../src/app/combatFeedback';

describe('visual-only squad damage feedback', () => {
  it('counts Tier-1, Tier-2, and rocket defensive value', () => {
    expect(squadDefenseValue({ count: 1, tier2RifleCount: 0, tier3RifleCount: 0, rocketCount: 0 })).toBe(1);
    expect(squadDefenseValue({ count: 1, tier2RifleCount: 1, tier3RifleCount: 0, rocketCount: 0 })).toBe(10);
    expect(squadDefenseValue({ count: 9, tier2RifleCount: 0, tier3RifleCount: 0, rocketCount: 0 })).toBe(9);
    expect(squadDefenseValue({ count: 5, tier2RifleCount: 2, tier3RifleCount: 0, rocketCount: 1 })).toBe(23);
  });

  it('detects demotion as damage, ignores growth, and marks a zero-defense loss fatal', () => {
    expect(damageFeedback(10, 9)).toBe('normal');
    expect(damageFeedback(9, 10)).toBeNull();
    expect(damageFeedback(9, 9)).toBeNull();
    expect(damageFeedback(1, 0)).toBe('fatal');
  });
});
