import { describe, expect, it } from 'vitest';
import { afterCasualties } from '../src/simulation/squad/composition';

describe('squad composition', () => {
  it('loses rifle soldiers before rocket specialists', () => {
    const start = { count: 4, rocketCount: 1 };
    expect(afterCasualties(start, 1)).toEqual({ count: 3, rocketCount: 1 });
    expect(afterCasualties(start, 3)).toEqual({ count: 1, rocketCount: 1 });
    expect(afterCasualties(start, 4)).toEqual({ count: 0, rocketCount: 0 });
    expect(start).toEqual({ count: 4, rocketCount: 1 });
  });

  it('removes rockets once only rockets remain and clamps at zero', () => {
    expect(afterCasualties({ count: 2, rocketCount: 2 }, 1)).toEqual({ count: 1, rocketCount: 1 });
    expect(afterCasualties({ count: 2, rocketCount: 2 }, 99)).toEqual({ count: 0, rocketCount: 0 });
  });

  it('rejects invalid composition and casualty counts', () => {
    expect(() => afterCasualties({ count: 1, rocketCount: 2 }, 1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0 }, -1)).toThrow();
    expect(() => afterCasualties({ count: 1, rocketCount: 0 }, 0.5)).toThrow();
  });
});
