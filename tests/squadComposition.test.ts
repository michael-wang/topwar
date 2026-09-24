import { describe, expect, it } from 'vitest';
import { addRifleSoldiers, afterCasualties, normalizeRifleSquad, tier1RifleCount } from '../src/simulation/squad/composition';

describe('squad composition', () => {
  it('loses rifle soldiers before rocket specialists', () => {
    const start = { count: 4, rocketCount: 1, tier2RifleCount: 0 };
    expect(afterCasualties(start, 1)).toEqual({ count: 3, rocketCount: 1, tier2RifleCount: 0 });
    expect(afterCasualties(start, 3)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0 });
    expect(afterCasualties(start, 4)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0 });
    expect(start).toEqual({ count: 4, rocketCount: 1, tier2RifleCount: 0 });
  });

  it('removes rockets once only rockets remain and clamps at zero', () => {
    expect(afterCasualties({ count: 2, rocketCount: 2, tier2RifleCount: 0 }, 1)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0 });
    expect(afterCasualties({ count: 2, rocketCount: 2, tier2RifleCount: 0 }, 99)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0 });
  });

  it('rejects invalid composition and casualty counts', () => {
    expect(() => afterCasualties({ count: 1, rocketCount: 2, tier2RifleCount: 0 }, 1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0, tier2RifleCount: 0 }, -1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0, tier2RifleCount: 0 }, 0.5)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 1, tier2RifleCount: 1 }, 1)).toThrow();
  });

  it('compresses complete hundreds of Tier-1 rifles and leaves other roles alone', () => {
    const squad = (count: number, rocketCount = 0) =>
      normalizeRifleSquad({ count, rocketCount, tier2RifleCount: 0 });
    expect(squad(99)).toEqual({ count: 99, rocketCount: 0, tier2RifleCount: 0 });
    expect(squad(100)).toEqual({ count: 1, rocketCount: 0, tier2RifleCount: 1 });
    expect(squad(101)).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 1 });
    expect(squad(200)).toEqual({ count: 2, rocketCount: 0, tier2RifleCount: 2 });
    expect(squad(250)).toEqual({ count: 52, rocketCount: 0, tier2RifleCount: 2 });
    expect(squad(101, 1)).toEqual({ count: 2, rocketCount: 1, tier2RifleCount: 1 });
    expect(tier1RifleCount(squad(250))).toBe(50);
    expect(addRifleSoldiers(squad(99), 1, 1)).toEqual(squad(100));
    expect(addRifleSoldiers(squad(200), 1, 2)).toEqual({ count: 3, rocketCount: 0,
      tier2RifleCount: 3 });
  });

  it('takes Tier-1 lives, then Tier-2 lives, then rocket lives', () => {
    const mixed = { count: 4, rocketCount: 1, tier2RifleCount: 1 };
    expect(afterCasualties(mixed, 1)).toEqual({ count: 3, rocketCount: 1, tier2RifleCount: 1 });
    expect(afterCasualties(mixed, 2)).toEqual({ count: 2, rocketCount: 1, tier2RifleCount: 1 });
    expect(afterCasualties(mixed, 3)).toEqual({ count: 1, rocketCount: 1, tier2RifleCount: 0 });
    expect(afterCasualties(mixed, 4)).toEqual({ count: 0, rocketCount: 0, tier2RifleCount: 0 });
  });
});
