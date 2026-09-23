import { describe, expect, it } from 'vitest';
import { createEnemyFormation } from '../src/simulation/enemies/formation';

describe('createEnemyFormation', () => {
  it('centers complete and partial rows horizontally and the whole group along Z', () => {
    expect(createEnemyFormation(1, 1, 0.8)).toEqual([{ x: 0, z: 0 }]);
    expect(createEnemyFormation(2, 2, 0.8)).toEqual([
      { x: -0.4, z: 0 }, { x: 0.4, z: 0 },
    ]);
    expect(createEnemyFormation(5, 3, 0.8)).toEqual([
      { x: -0.8, z: 0.4 }, { x: 0, z: 0.4 }, { x: 0.8, z: 0.4 },
      { x: -0.4, z: -0.4 }, { x: 0.4, z: -0.4 },
    ]);
  });

  it('uses authored columns and spacing, with deterministic length and output', () => {
    expect(createEnemyFormation(3, 2, 1)).toEqual([
      { x: -0.5, z: 0.5 }, { x: 0.5, z: 0.5 }, { x: 0, z: -0.5 },
    ]);
    const first = createEnemyFormation(8, 4, 0.7);
    expect(first).toHaveLength(8);
    expect(createEnemyFormation(8, 4, 0.7)).toEqual(first);
  });

  it('rejects invalid counts, columns, and spacing', () => {
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createEnemyFormation(count, 1, 0.8)).toThrow();
    }
    for (const columns of [0, -1, 1.5, 3, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createEnemyFormation(2, columns, 0.8)).toThrow();
    }
    for (const spacing of [0, -1, Infinity, NaN]) {
      expect(() => createEnemyFormation(2, 2, spacing)).toThrow();
    }
  });
});
