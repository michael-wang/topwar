import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import gameConfig from '../public/game-data/game.json';
import { SeededRng } from '../src/core/Rng';
import { createEnemyFormation } from '../src/simulation/enemies/formation';
import { createEnemyStreamRow } from '../src/simulation/enemies/streamRow';

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
    expect(createEnemyFormation(8, 4, 0.7, 0, 104729)).toEqual(first);
  });

  it('makes a reproducible irregular swarm inside the authored grid envelope', () => {
    const regular = createEnemyFormation(240, 11, 0.43);
    const first = createEnemyFormation(240, 11, 0.43, 0.16, 104729);
    expect(first).toHaveLength(240);
    expect(createEnemyFormation(240, 11, 0.43, 0.16, 104729)).toEqual(first);
    expect(createEnemyFormation(240, 11, 0.43, 0.16, 104730)).not.toEqual(first);
    expect(first.some((offset, index) => offset.x !== regular[index].x)).toBe(true);
    expect(first.some((offset, index) => offset.z !== regular[index].z)).toBe(true);
    for (let index = 0; index < first.length; index++) {
      expect(Math.abs(first[index].x - regular[index].x)).toBeLessThanOrEqual(0.16 + 0.43 / 6);
      expect(Math.abs(first[index].z - regular[index].z)).toBeLessThanOrEqual(0.16);
    }
    const meanX = first.reduce((sum, offset) => sum + offset.x, 0) / first.length;
    const meanZ = first.reduce((sum, offset) => sum + offset.z, 0) / first.length;
    expect(Math.abs(meanX)).toBeLessThan(0.08);
    expect(Math.abs(meanZ)).toBeLessThan(0.08);
    const firstRowCenter = first.slice(0, 11).reduce((sum, offset) => sum + offset.x, 0) / 11;
    const secondRowCenter = first.slice(11, 22).reduce((sum, offset) => sum + offset.x, 0) / 11;
    expect(firstRowCenter).toBeLessThan(secondRowCenter);
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
    for (const jitter of [-1, Infinity, NaN, 0.4, 0.5]) {
      expect(() => createEnemyFormation(2, 2, 0.8, jitter, 1)).toThrow(/jitter/);
    }
    for (const seed of [-1, 1.5, 4294967296, NaN, Infinity]) {
      expect(() => createEnemyFormation(2, 2, 0.8, 0.1, seed)).toThrow();
    }
    expect(() => createEnemyFormation(2, 2, 0.8, 0.1, 0)).not.toThrow();
  });
});

describe('createEnemyStreamRow', () => {
  const stream = authoredLevel.enemyStream;
  const row = (index: number) => createEnemyStreamRow(index, stream.columns,
    stream.spacing, stream.jitter, stream.seed);

  it('generates an independent, centered irregular row inside the track envelope', () => {
    const first = row(0);
    const second = row(1);
    expect(first).toHaveLength(7);
    expect(row(0)).toEqual(first);
    expect(second).not.toEqual(first);
    expect(first.reduce((sum, offset) => sum + offset.x, 0) / first.length).toBeCloseTo(0, 0);
    expect(Math.max(...first.map((offset) => Math.abs(offset.x))) + gameConfig.tiers.normalEnemyRadius)
      .toBeLessThan(gameConfig.track.halfWidth);
    expect(first.every((offset) => Math.abs(offset.z) <= stream.jitter)).toBe(true);
    expect((stream.startZ + 1 * stream.spacing) - (stream.startZ + 0 * stream.spacing))
      .toBeCloseTo(stream.spacing);
    const gameplayRng = new SeededRng(17);
    row(100);
    expect(gameplayRng.getState()).toBe(17);
  });

  it('keeps regular centered rows when jitter is zero and rejects invalid input', () => {
    expect(createEnemyStreamRow(0, 3, 0.6, 0, 0)).toEqual([
      { x: -0.6, z: 0 }, { x: 0, z: 0 }, { x: 0.6, z: 0 },
    ]);
    for (const index of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => row(index)).toThrow();
    }
    for (const columns of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createEnemyStreamRow(0, columns, 0.6, 0.1, 0)).toThrow();
    }
    expect(() => createEnemyStreamRow(0, 7, 0.6, 0.3, 0)).toThrow();
    expect(() => createEnemyStreamRow(0, 7, 0.6, 0.1, -1)).toThrow();
  });
});
