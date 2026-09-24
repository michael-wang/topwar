import { describe, expect, it } from 'vitest';
import { addRifleSoldiers, afterCasualties, normalizeRifleSquad, tier1RifleCount } from '../src/simulation/squad/composition';

describe('squad composition', () => {
  it('loses rifle soldiers before rocket specialists', () => {
    const start = { count: 4, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 };
    expect(afterCasualties(start, 1)).toEqual({ count: 3, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties(start, 3)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties(start, 4)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(start).toEqual({ count: 4, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
  });

  it('removes rockets once only rockets remain and clamps at zero', () => {
    expect(afterCasualties({ count: 2, rocketCount: 2, tier2RifleCount: 0, tier3RifleCount: 0 }, 1)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties({ count: 2, rocketCount: 2, tier2RifleCount: 0, tier3RifleCount: 0 }, 99)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 });
  });

  it('rejects invalid composition and casualty counts', () => {
    expect(() => afterCasualties({ count: 1, rocketCount: 2, tier2RifleCount: 0, tier3RifleCount: 0 }, 1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 }, -1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 }, 0.5)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 1, tier2RifleCount: 1, tier3RifleCount: 0 }, 1)).toThrow();
  });

  it('compresses complete tens of Tier-1 rifles and leaves other roles alone', () => {
    const squad = (count: number, rocketCount = 0) =>
      normalizeRifleSquad({ count, rocketCount, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(squad(9)).toEqual({ count: 9, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(squad(10)).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(squad(11)).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(squad(19)).toEqual({ count: 10, rocketCount: 0, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(squad(20)).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 2, tier3RifleCount: 0 });
    expect(squad(29)).toEqual({ count: 11, rocketCount: 0, tier2RifleCount: 2, tier3RifleCount: 0 });
    expect(squad(100)).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 1 });
    expect(squad(11, 1)).toEqual({ count: 2, rocketCount: 1, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(tier1RifleCount(squad(29))).toBe(9);
    expect(addRifleSoldiers(squad(9), 1, 1)).toEqual(squad(10));
    expect(addRifleSoldiers(squad(20), 1, 2)).toEqual({ count: 3, rocketCount: 0,
      tier2RifleCount: 3, tier3RifleCount: 0 });
  });

  it('spends Tier-1 defense first, demotes Tier-2, and keeps rockets last', () => {
    const mixed = { count: 4, rocketCount: 1, tier2RifleCount: 1, tier3RifleCount: 0 };
    expect(afterCasualties(mixed, 1)).toEqual({ count: 3, rocketCount: 1, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(afterCasualties(mixed, 2)).toEqual({ count: 2, rocketCount: 1, tier2RifleCount: 1, tier3RifleCount: 0 });
    expect(afterCasualties(mixed, 3)).toEqual({ count: 10, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties(mixed, 4)).toEqual({ count: 9, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties(mixed, 12)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0, tier3RifleCount: 0 });
    expect(afterCasualties(mixed, 13)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0, tier3RifleCount: 0 });
  });

  it('rejects reward growth beyond safe integer squad counts', () => {
    const full = { count: Number.MAX_SAFE_INTEGER, rocketCount: 0,
      tier2RifleCount: Number.MAX_SAFE_INTEGER, tier3RifleCount: 0 };
    expect(() => addRifleSoldiers(full, 1, 1)).toThrow(/supported range/);
    expect(() => addRifleSoldiers(full, 1, 2)).toThrow(/supported range/);
  });
});
