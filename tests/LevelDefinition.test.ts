import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

function level() {
  return structuredClone(authoredLevel);
}

describe('LevelDefinitionSchema', () => {
  it('validates the authored first level and its deliberate small-group escalation', () => {
    const parsed = LevelDefinitionSchema.parse(authoredLevel);
    expect(parsed.id).toBe('level-001');
    expect(parsed.length).toBe(72);
    expect(parsed.enemyGroups.map((group) => [group.z, group.count])).toEqual([
      [12, 2], [24, 3], [39, 5], [56, 8],
    ]);
  });

  it('accepts one- and two-enemy groups without a crowd minimum', () => {
    const candidate = level();
    candidate.enemyGroups = [
      { id: 'one', z: 0, enemy: 'grunt', count: 1, formation: { columns: 1, spacing: 0.8 } },
      { id: 'two', z: 1, enemy: 'grunt', count: 2, formation: { columns: 2, spacing: 0.8 } },
    ];
    expect(LevelDefinitionSchema.parse(candidate).enemyGroups.map((group) => group.count)).toEqual([1, 2]);
  });

  it('rejects blank ids and invalid level lengths', () => {
    expect(() => LevelDefinitionSchema.parse({ ...level(), id: '  ' })).toThrow();
    for (const length of [0, -1, Infinity, NaN]) {
      expect(() => LevelDefinitionSchema.parse({ ...level(), length })).toThrow();
    }
    const candidate = level();
    candidate.enemyGroups[0].id = '';
    expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
  });

  it('rejects duplicate group ids and unordered or duplicate Z positions', () => {
    const duplicateId = level();
    duplicateId.enemyGroups[1].id = 'intro-1';
    expect(() => LevelDefinitionSchema.parse(duplicateId)).toThrow(/Duplicate enemy-group id/);

    const unordered = level();
    unordered.enemyGroups[1].z = 11;
    expect(() => LevelDefinitionSchema.parse(unordered)).toThrow(/strictly increasing Z order/);

    const duplicateZ = level();
    duplicateZ.enemyGroups[1].z = 12;
    expect(() => LevelDefinitionSchema.parse(duplicateZ)).toThrow(/strictly increasing Z order/);
  });

  it('keeps group Z non-negative and strictly inside level length', () => {
    for (const z of [-1, 72, 73, Infinity, NaN]) {
      const candidate = level();
      candidate.enemyGroups[3].z = z;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
  });

  it('requires positive safe integer counts and formation columns within count', () => {
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = level();
      candidate.enemyGroups[0].count = count;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const columns of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 3]) {
      const candidate = level();
      candidate.enemyGroups[0].formation.columns = columns;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
  });

  it('requires finite positive formation spacing', () => {
    for (const spacing of [0, -1, Infinity, NaN]) {
      const candidate = level();
      candidate.enemyGroups[0].formation.spacing = spacing;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
  });

  it('rejects unknown level, group, and formation fields', () => {
    expect(() => LevelDefinitionSchema.parse({ ...level(), extra: true })).toThrow(/extra/);
    const groupExtra = level();
    expect(() => LevelDefinitionSchema.parse({
      ...groupExtra,
      enemyGroups: [{ ...groupExtra.enemyGroups[0], hp: 10 }, ...groupExtra.enemyGroups.slice(1)],
    })).toThrow(/hp/);
    const formationExtra = level();
    expect(() => LevelDefinitionSchema.parse({
      ...formationExtra,
      enemyGroups: [
        { ...formationExtra.enemyGroups[0], formation: { ...formationExtra.enemyGroups[0].formation, rows: 1 } },
        ...formationExtra.enemyGroups.slice(1),
      ],
    })).toThrow(/rows/);
  });
});
