import { describe, expect, it } from 'vitest';
import { createSquadFormation } from '../src/simulation/squad/formation';

describe('createSquadFormation', () => {
  it('handles zero and one member', () => {
    expect(createSquadFormation(0, 1)).toEqual([]);
    expect(createSquadFormation(1, 1)).toEqual([{ x: 0, z: 0 }]);
  });

  it('centers complete and partial rows for small squads', () => {
    expect(createSquadFormation(2, 1)).toEqual([
      { x: -0.5, z: 0 }, { x: 0.5, z: 0 },
    ]);
    expect(createSquadFormation(3, 1)).toEqual([
      { x: -0.5, z: 0.5 }, { x: 0.5, z: 0.5 },
      { x: 0, z: -0.5 },
    ]);
    expect(createSquadFormation(4, 1)).toEqual([
      { x: -0.5, z: 0.5 }, { x: 0.5, z: 0.5 },
      { x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 },
    ]);
    expect(createSquadFormation(5, 1)).toEqual([
      { x: -1, z: 0.5 }, { x: 0, z: 0.5 }, { x: 1, z: 0.5 },
      { x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 },
    ]);
    expect(createSquadFormation(6, 1)).toEqual([
      { x: -1, z: 0.5 }, { x: 0, z: 0.5 }, { x: 1, z: 0.5 },
      { x: -1, z: -0.5 }, { x: 0, z: -0.5 }, { x: 1, z: -0.5 },
    ]);
  });

  it('applies spacing to both axes and stays deterministic', () => {
    const expected = [
      { x: -2, z: 1 }, { x: 0, z: 1 }, { x: 2, z: 1 },
      { x: -1, z: -1 }, { x: 1, z: -1 },
    ];
    expect(createSquadFormation(5, 2)).toEqual(expected);
    expect(createSquadFormation(5, 2)).toEqual(expected);
    for (const count of [0, 1, 2, 3, 4, 5, 6, 12, 101]) {
      expect(createSquadFormation(count, 0.45)).toHaveLength(count);
    }
  });

  it.each([-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid count %s',
    (count) => expect(() => createSquadFormation(count, 1)).toThrow(/count/),
  );

  it.each([0, -1, Number.NaN, Infinity, -Infinity, '1'])(
    'rejects invalid spacing %s',
    (spacing) => expect(() => createSquadFormation(1, spacing as number)).toThrow(/spacing/),
  );
});
