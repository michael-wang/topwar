import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

describe('LevelDefinitionSchema', () => {
  it('validates the authored Defense wave cursor and absent retired armories', () => {
    const parsed = LevelDefinitionSchema.parse(authoredLevel);
    expect(parsed.id).toBe('level-001');
    expect(parsed.length).toBe(112);
    expect(parsed.enemyGroups).toEqual([]);
    expect(parsed.enemyStream).toEqual({ enemy: 'grunt', startZ: 30, spawnAheadDistance: 96,
      columns: 7, spacing: .6, columnSpacing: .72, jitter: .16, seed: 104729 });
    expect(parsed.upgradeGates).toEqual([]);
  });

  it('validates Defense stream fields and historical optional column spacing strictly', () => {
    const legacyStream = structuredClone(authoredLevel.enemyStream) as Partial<typeof authoredLevel.enemyStream>;
    delete legacyStream.columnSpacing;
    expect(LevelDefinitionSchema.parse({ ...authoredLevel, enemyStream: legacyStream })
      .enemyStream?.columnSpacing).toBeUndefined();
    for (const columnSpacing of [0, -1, Infinity, NaN]) {
      expect(() => LevelDefinitionSchema.parse({ ...authoredLevel,
        enemyStream: { ...authoredLevel.enemyStream, columnSpacing } })).toThrow();
    }
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
    for (const jitter of [-1, 0.36, Infinity, NaN]) {
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

  });

  it('rejects blank IDs, invalid lengths, unknown keys and retired finite/gate levels', () => {
    expect(() => LevelDefinitionSchema.parse({...authoredLevel,id:' '})).toThrow();
    for (const length of [0,-1,Infinity,NaN]) expect(() => LevelDefinitionSchema.parse({...authoredLevel,length})).toThrow();
    for (const extra of ['extra','startGraceSeconds']) expect(() => LevelDefinitionSchema.parse({...authoredLevel,[extra]:true})).toThrow();
    expect(() => LevelDefinitionSchema.parse({...authoredLevel,enemyGroups:[{id:'bridge',z:10,count:1}]})).toThrow();
    expect(() => LevelDefinitionSchema.parse({...authoredLevel,upgradeGates:[{id:'gate'}]})).toThrow();
  });
});
