import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

const finiteGroup = { id: 'opening-stream', z: 60, enemy: 'grunt', count: 840,
  formation: { columns: 7, spacing: 0.60, jitter: 0.16, seed: 104729 } };
const testGates = [
  { id: 'left', x: -2.7, zOffset: 8, width: 0.9,
    reward: { mode: 'hitPickup', kind: 'rifle', amount: 1, hitsRequired: 10, dropSpeed: 4 } },
  { id: 'right', x: 2.7, zOffset: 8, width: 0.9,
    reward: { mode: 'hitPickup', kind: 'tier2Rifle', amount: 1, hitsRequired: 100, dropSpeed: 4 } },
];

function level() {
  return { ...structuredClone(authoredLevel), enemyGroups: [structuredClone(finiteGroup)],
    upgradeGates: structuredClone(testGates) };
}

function twoGroups() {
  const candidate = level();
  candidate.enemyGroups.push({ ...candidate.enemyGroups[0], id: 'second', z: 80 });
  return candidate;
}

describe('LevelDefinitionSchema', () => {
  it('validates the authored endless stream and inactive side armories', () => {
    const parsed = LevelDefinitionSchema.parse(authoredLevel);
    expect(parsed.id).toBe('level-001');
    expect(parsed.length).toBe(112);
    expect(parsed.enemyGroups).toEqual([]);
    expect(parsed.enemyStream).toEqual({ enemy: 'grunt', startZ: 24, spawnAheadDistance: 96,
      columns: 7, spacing: 0.60, jitter: 0.16, seed: 104729,
      bruteRamp: { startRow: 48, fullRow: 960, curvePower: 2 },
      rewards: { rowsPerReward: 8, spawnAheadDistance: 30,
        hitsRequired: 10, seed: 271828, sideX: 2.2 } });
    expect(parsed.upgradeGates).toEqual([]);
  });

  it('accepts finite levels without a stream and validates stream fields strictly', () => {
    const finite = level();
    const { enemyStream: _stream, ...finiteOnly } = finite;
    expect(LevelDefinitionSchema.parse(finiteOnly).enemyStream).toBeUndefined();
    for (const columns of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = structuredClone(authoredLevel);
      Object.assign(candidate.enemyStream, { columns });
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const spacing of [0, -1, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.spacing = spacing;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const jitter of [-1, 0.30, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.jitter = jitter;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const seed of [-1, 1.5, 4294967296, NaN, Infinity]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.seed = seed;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const seed of [0, 4294967295]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.seed = seed;
      expect(LevelDefinitionSchema.parse(candidate).enemyStream?.seed).toBe(seed);
    }
    for (const spawnAheadDistance of [0, 24, -1, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.spawnAheadDistance = spawnAheadDistance;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const startZ of [-1, 96, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.startZ = startZ;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
      enemyStream: { ...authoredLevel.enemyStream, extra: true } })).toThrow(/extra/);
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
      enemyStream: { ...authoredLevel.enemyStream, firstBruteRow: 96 } })).toThrow(/firstBruteRow/);
    const { bruteRamp: _ramp, ...withoutRamp } = authoredLevel.enemyStream;
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
      enemyStream: withoutRamp })).toThrow(/bruteRamp/);
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
      enemyStream: { ...authoredLevel.enemyStream,
        bruteRamp: { startRow: 48, fullRow: 960, curvePower: 2, chance: 0.5 } } })).toThrow(/chance/);
    for (const startRow of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
        enemyStream: { ...authoredLevel.enemyStream, bruteRamp: { startRow, fullRow: 960, curvePower: 2 } } }))
        .toThrow(/startRow/);
    }
    for (const fullRow of [-1, 48, 47, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
        enemyStream: { ...authoredLevel.enemyStream, bruteRamp: { startRow: 48, fullRow, curvePower: 2 } } }))
        .toThrow(/fullRow/);
    }
    for (const curvePower of [0, -1, Infinity, NaN]) {
      expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
        enemyStream: { ...authoredLevel.enemyStream,
          bruteRamp: { startRow: 48, fullRow: 960, curvePower } } })).toThrow(/curvePower/);
    }
  });

  it('validates strict deterministic stream reward authoring', () => {
    for (const spawnAheadDistance of [undefined, 0, -1, 96.1, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      Object.assign(candidate.enemyStream.rewards, { spawnAheadDistance });
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const rowsPerReward of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      const candidate = structuredClone(authoredLevel);
      Object.assign(candidate.enemyStream.rewards, { rowsPerReward });
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const key of ['baseChancePerRow', 'fullTierChancePerRow']) {
      expect(() => LevelDefinitionSchema.parse({ ...authoredLevel, enemyStream: {
        ...authoredLevel.enemyStream, rewards: { ...authoredLevel.enemyStream.rewards, [key]: 0.1 },
      } })).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel, enemyStream: {
      ...authoredLevel.enemyStream, rewards: { ...authoredLevel.enemyStream.rewards,
        chancePerRow: 0.025 },
    } })).toThrow(/chancePerRow/);
    for (const hitsRequired of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.rewards.hitsRequired = hitsRequired;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const seed of [-1, 1.5, 4294967296, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.rewards.seed = seed;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const seed of [0, 4294967295]) {
      const candidate = structuredClone(authoredLevel);
      candidate.enemyStream.rewards.seed = seed;
      expect(LevelDefinitionSchema.parse(candidate).enemyStream?.rewards?.seed).toBe(seed);
    }
    for (const sideX of [undefined, 0, -1, Infinity, NaN]) {
      const candidate = structuredClone(authoredLevel);
      Object.assign(candidate.enemyStream.rewards, { sideX });
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...authoredLevel, enemyStream: {
      ...authoredLevel.enemyStream, rewards: { ...authoredLevel.enemyStream.rewards, extra: true },
    } })).toThrow(/extra/);
  });

  it('validates gate IDs, positions, width, and strict hit rewards', () => {
    const duplicate = level();
    duplicate.upgradeGates[1].id = duplicate.upgradeGates[0].id;
    expect(() => LevelDefinitionSchema.parse(duplicate)).toThrow(/Duplicate upgrade-gate id/);
    for (const z of [-1, 0, Infinity, NaN]) {
      const candidate = level();
      candidate.upgradeGates[0].zOffset = z;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const value of [0, -1, Infinity]) {
      const candidate = level();
      candidate.upgradeGates[0].width = value;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const candidate = level();
      candidate.upgradeGates[0].reward.amount = amount;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const hitsRequired of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
      const candidate = level();
      candidate.upgradeGates[0].reward.hitsRequired = hitsRequired;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    for (const dropSpeed of [0, -1, Infinity, NaN]) {
      const candidate = level();
      candidate.upgradeGates[0].reward.dropSpeed = dropSpeed;
      expect(() => LevelDefinitionSchema.parse(candidate)).toThrow();
    }
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], reward: { mode: 'pickup', kind: 'rifle', amount: 1, intervalSeconds: 1 } },
    ] })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], reward: { mode: 'laser', kind: 'rifle', amount: 1 } },
    ] })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[1], reward: { ...level().upgradeGates[1].reward, intervalSeconds: 1 } },
    ] })).toThrow(/intervalSeconds/);
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[1], reward: { mode: 'instant', kind: 'rifle', amount: 99 } },
    ] })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], reward: { ...level().upgradeGates[0].reward, count: 5 } },
    ] })).toThrow(/count/);
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], reward: { mode: 'instant', kind: 'rocket', amount: 1 } },
    ] })).toThrow();
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], surprise: 1 },
    ] })).toThrow(/surprise/);
    expect(() => LevelDefinitionSchema.parse({ ...level(), upgradeGates: [
      { ...level().upgradeGates[0], choiceGroup: 'obsolete' },
    ] })).toThrow(/choiceGroup/);
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
    for (const columns of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 841]) {
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
