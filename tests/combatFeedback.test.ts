import { describe, expect, it } from 'vitest';
import { damageFeedback, squadDefenseValue } from '../src/app/combatFeedback';

describe('visual-only squad damage feedback', () => {
  it('counts physical Rifle and MG members independently of weapon stage', () => {
    for(const count of [0,1,2,3]) expect(squadDefenseValue({count,rifleCounts:count?[count]:[],rocketCount:0,rifleRemainder:0},10)).toBe(BigInt(count));
  });

  it('detects demotion as damage, ignores growth, and marks a zero-defense loss fatal', () => {
    expect(damageFeedback(10, 9)).toBe('normal');
    expect(damageFeedback(9, 10)).toBeNull();
    expect(damageFeedback(9, 9)).toBeNull();
    expect(damageFeedback(1, 0)).toBe('fatal');
  });


});
