import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

function level() {
  return structuredClone(authoredLevel);
}

function twoGroups() {
  const candidate = level();
  candidate.enemyGroups.push({ ...candidate.enemyGroups[0], id: 'second', z: 80 });
  return candidate;
}

describe('LevelDefinitionSchema', () => {
  it('validates the single authored opening stream', () => {
    const parsed = LevelDefinitionSchema.parse(authoredLevel);
    expect(parsed.id).toBe('level-001');
    expect(parsed.length).toBe(112);
    expect(parsed.enemyGroups).toEqual([{ id: 'opening-stream', z: 60, enemy: 'grunt', count: 600,
      formation: { columns: 6, spacing: 0.72, jitter: 0.20, seed: 104729 } }]);
    expect(parsed.upgradeGates).toEqual([
      { id: 'opening-rifle', choiceGroup: 'opening-choice', x: -1.25, z: 14, width: 2.1, hp: 36,
        reward: { kind: 'rifle', amount: 1 } },
      { id: 'opening-rocket', choiceGroup: 'opening-choice', x: 1.25, z: 14, width: 2.1, hp: 72,
        reward: { kind: 'rocket', amount: 1 } },
    ]);
  });

  it('validates gate IDs, positions, HP, width, and strict rewards', () => {
    const duplicate = level();
    duplicate.upgradeGates[1].id = duplicate.upgradeGates[0].id;
    expect(() => LevelDefinitionSchema.parse(duplicate)).toThrow(/Duplicate upgrade-gate id/);
    for (const z of [-1, 112, Infinity]) {
      const candidate = level();
      candidate.upgradeGates[0].z = z;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const field of ['hp', 'width'] as const) {
      for (const value of [0, -1, Infinity]) {
        const candidate = level();
        candidate.upgradeGates[0][field] = value;
        expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
      }
    }
    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = level();
      candidate.upgradeGates[0].reward.amount = amount;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], reward: { kind: 'laser', amount: 1 } },
    ] })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], surprise: 1 },
    ] })).toThrow(/surprise/);
  });

  it('accepts one- and two-enemy groups without a crowd minimum', () => {
    const candidate = level();
    candidate.enemyGroups = [
      { id: 'one', z: 0, enemy: 'grunt', count: 1, formation: { columns: 1, spacing: 0.8, jitter: 0, seed: 0 } },
      { id: 'two', z: 1, enemy: 'grunt', count: 2, formation: { columns: 2, spacing: 0.8, jitter: 0, seed: 0 } },
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

  it('rejects obsolete opening-grace level data', () => {
    expect(() => LevelDefinitionSchema.parse({ ...level(), startGraceSeconds: 1.5 })).toThrow(/startGraceSeconds/);
  });

  it('rejects duplicate group ids and unordered or duplicate Z positions', () => {
    const duplicateId = twoGroups();
    duplicateId.enemyGroups[1].id = 'opening-stream';
    expect(() => LevelDefinitionSchema.parse(duplicateId)).toThrow(/Duplicate enemy-group id/);

    const unordered = twoGroups();
    unordered.enemyGroups[1].z = 59;
    expect(() => LevelDefinitionSchema.parse(unordered)).toThrow(/strictly increasing Z order/);

    const duplicateZ = twoGroups();
    duplicateZ.enemyGroups[1].z = 60;
    expect(() => LevelDefinitionSchema.parse(duplicateZ)).toThrow(/strictly increasing Z order/);
  });

  it('keeps group Z non-negative and strictly inside level length', () => {
    for (const z of [-1, 112, 113, Infinity, NaN]) {
      const candidate = level();
      candidate.enemyGroups[0].z = z;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
  });

  it('requires positive safe integer counts and formation columns within count', () => {
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = level();
      candidate.enemyGroups[0].count = count;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const columns of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 601]) {
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

  it('validates authored jitter relative to spacing and uint32 seeds', () => {
    for (const jitter of [-1, Infinity, NaN, 0.36, 0.4]) {
      const candidate = level();
      candidate.enemyGroups[0].formation.jitter = jitter;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow(/jitter/i);
    }
    for (const seed of [-1, 1.5, 4294967296, NaN, Infinity]) {
      const candidate = level();
      candidate.enemyGroups[0].formation.seed = seed;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow(/seed/i);
    }
    for (const seed of [0, 4294967295]) {
      const candidate = level();
      candidate.enemyGroups[0].formation.seed = seed;
      expect(LevelDefinitionSchema.parse(candidate).enemyGroups[0].formation.seed).toBe(seed);
    }
    const regular = level();
    regular.enemyGroups[0].formation.jitter = 0;
    expect(() => LevelDefinitionSchema.parse(regular)).not.toThrow();
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
