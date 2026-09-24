import { describe, expect, it } from 'vitest';
import { createSquadFormation } from '../src/simulation/squad/formation';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('createSquadFormation', () => {
  it('handles zero and one member', () => {
    expect(createSquadFormation(0, 1)).toEqual([]);
    expect(createSquadFormation(1, 1)).toEqual([{ x: 0, z: 0 }]);
  });

  it('separates two members, gives three a triangular footprint, and avoids a four-member grid', () => {
    const two = createSquadFormation(2, 1);
    expect(distance(two[0], two[1])).toBeGreaterThan(0.7);
    expect(two[0].x + two[1].x).toBeCloseTo(0);
    expect(two[0].z + two[1].z).toBeCloseTo(0);

    const three = createSquadFormation(3, 1);
    const distances = [distance(three[0], three[1]), distance(three[0], three[2]),
      distance(three[1], three[2])];
    expect(Math.min(...distances)).toBeGreaterThan(0.6);
    expect(Math.max(...distances) / Math.min(...distances)).toBeLessThan(2);

    const four = createSquadFormation(4, 1);
    expect(new Set(four.map((member) => member.x)).size).toBe(4);
    expect(new Set(four.map((member) => member.z)).size).toBe(4);
  });

  it('stays centered, compact, deterministic, and grows gradually', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 12, 101]) {
      const formation = createSquadFormation(count, 0.45);
      expect(formation).toHaveLength(count);
      expect(formation).toEqual(createSquadFormation(count, 0.45));
      expect(formation.reduce((sum, member) => sum + member.x, 0) / count).toBeCloseTo(0);
      expect(formation.reduce((sum, member) => sum + member.z, 0) / count).toBeCloseTo(0);
      if (count <= 9) {
        const radius = Math.max(...formation.map((member) => Math.hypot(member.x, member.z)));
        expect(radius).toBeLessThan(0.45 * 2.3);
      }
    }
    const radius = (count: number) => Math.max(...createSquadFormation(count, 0.45)
      .map((member) => Math.hypot(member.x, member.z)));
    expect(radius(9)).toBeGreaterThan(radius(4));
    expect(radius(9)).toBeLessThan(radius(4) * 2);
    expect(radius(5)).toBeGreaterThan(radius(2));
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
