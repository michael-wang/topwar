import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { createEnemyStreamRow } from '../src/simulation/enemies/streamRow';
import type { SimulationState } from '../src/simulation/SimulationState';

const authored = LevelDefinitionSchema.parse(authoredLevel);
const smallLevel: LevelDefinition = { id: 'short-endless', length: 3, enemyGroups: [], upgradeGates: [],
  enemyStream: { enemy: 'grunt', startZ: 2, spawnAheadDistance: 5,
    columns: 2, spacing: 1, jitter: 0.2, seed: 42 } };
const tuning: SimulationTuning = { moveSpeed: 5, forwardSpeed: 1, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3,
  gruntContactDamage: 1,
  bruteRadius: 0.55, bruteContactDamage: 1,
  rifle: { damage: 3, fireRate: 0.1, projectileSpeed: 1, range: 1 },
  rocket: { damage: 15, fireRate: 0.1, projectileSpeed: 1, range: 1, blastRadius: 1.25 } };
const create = (level = smallLevel, count = 20) => new Simulation({ seed: 17, level,
  startSquad: count, startRocketCount: 0, gruntHp: 3, bruteHp: 100 });
const advance = (simulation: Simulation, dt = 1, forwardSpeed = 1) =>
  simulation.step(dt, { targetX: 2.5 }, { ...tuning, forwardSpeed });

describe('deterministic endless enemy stream', () => {
  it('replaces only the center-nearest grunt in row 96 and resumes grunts afterward', () => {
    const state = create(authored, 1).getState();
    const stream = authored.enemyStream!;
    const row = (index: number) => state.enemies.filter((enemy) =>
      enemy.id >= index * stream.columns + 1 && enemy.id <= (index + 1) * stream.columns);
    expect(row(95).every((enemy) => enemy.type === 'grunt')).toBe(true);
    expect(row(96)).toHaveLength(7);
    expect(row(96).filter((enemy) => enemy.type === 'brute')).toHaveLength(1);
    expect(row(97).every((enemy) => enemy.type === 'grunt')).toBe(true);
    const offsets = createEnemyStreamRow(96, stream.columns, stream.spacing, stream.jitter, stream.seed);
    const closest = offsets.reduce((best, offset, index) =>
      Math.abs(offset.x) < Math.abs(offsets[best].x) ? index : best, 0);
    const brute = row(96)[closest];
    expect(brute).toMatchObject({ type: 'brute', hp: 100, id: 96 * 7 + closest + 1,
      x: offsets[closest].x, z: stream.startZ + 96 * stream.spacing + offsets[closest].z });
    expect(brute.z).toBeCloseTo(81.6, 0);
    expect(row(96).map(({ x, z }) => ({ x, z }))).toEqual(offsets.map((offset) =>
      ({ x: offset.x, z: stream.startZ + 96 * stream.spacing + offset.z })));
    expect(state.enemies.filter((enemy) => enemy.type === 'brute')).toHaveLength(1);
    expect(create(authored, 1).getState().enemies).toEqual(state.enemies);
  });

  it('does not add another brute in later rows or change row geometry', () => {
    const simulation = create(authored, 1);
    advance(simulation, 100);
    const state = simulation.getState();
    const stream = authored.enemyStream!;
    for (let index = 97; index <= 160; index++) {
      const row = state.enemies.filter((enemy) =>
        enemy.id >= index * stream.columns + 1 && enemy.id <= (index + 1) * stream.columns);
      expect(row).toHaveLength(7);
      expect(row.every((enemy) => enemy.type === 'grunt')).toBe(true);
      expect(row.map(({ x, z }) => ({ x, z }))).toEqual(createEnemyStreamRow(index,
        stream.columns, stream.spacing, stream.jitter, stream.seed).map((offset) =>
        ({ x: offset.x, z: stream.startZ + index * stream.spacing + offset.z })));
    }
    expect(state.enemies.filter((enemy) => enemy.type === 'brute')).toHaveLength(1);
  });

  it('reproduces the milestone after restore despite earlier enemy deaths and on Retry', () => {
    const futureLevel = { ...smallLevel, enemyStream: { ...smallLevel.enemyStream!, firstBruteRow: 6 } };
    const first = create(futureLevel);
    const second = create(futureLevel);
    const altered = second.getState();
    altered.enemies = [];
    second.restoreState(JSON.parse(JSON.stringify(altered)) as SimulationState);
    advance(first, 3);
    advance(second, 3);
    const brute = (simulation: Simulation) => simulation.getState().enemies.find((enemy) => enemy.type === 'brute');
    expect(brute(first)).toEqual(brute(second));
    expect(brute(first)?.id).toBeGreaterThan(0);
    const saved = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const restored = create(futureLevel);
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(first.getState());
    const retry = create(futureLevel);
    advance(retry, 3);
    expect(brute(retry)).toEqual(brute(first));
  });

  it('starts at the authored horizon with unique IDs and no session RNG use', () => {
    const state = create(authored, 1).getState();
    expect(state.enemies.length).toBeGreaterThan(700);
    expect(state.enemies.length).toBeLessThan(950);
    expect(new Set(state.enemies.map((enemy) => enemy.id)).size).toBe(state.enemies.length);
    expect(state.enemyStream?.nextEnemyId).toBe(state.enemies.length + 1);
    expect(state.enemyStream?.nextRowIndex).toBe(state.enemies.length / 7);
    expect(Math.min(...state.enemies.map((enemy) => enemy.z))).toBeGreaterThan(23);
    expect(Math.max(...state.enemies.map((enemy) => enemy.z))).toBeGreaterThan(95);
    expect(state.rngState).toBe(17);
  });

  it('extends only when the moving horizon reaches another row and catches up after a large step', () => {
    const simulation = create();
    expect(simulation.getState().enemyStream).toEqual({ nextRowIndex: 4, nextEnemyId: 9 });
    advance(simulation, 0.5);
    expect(simulation.getState().enemyStream?.nextRowIndex).toBe(4);
    advance(simulation, 0.5);
    expect(simulation.getState().enemyStream?.nextRowIndex).toBe(5);
    const oldCursor = simulation.getState().enemyStream!;
    advance(simulation, 3);
    const state = simulation.getState();
    expect(state.enemyStream?.nextRowIndex).toBe(oldCursor.nextRowIndex + 3);
    expect(state.enemyStream?.nextEnemyId).toBe(oldCursor.nextEnemyId + 6);
    expect(Math.max(...state.enemies.map((enemy) => enemy.z))).toBeCloseTo(state.player.z + 5, 0);
    expect(state.rngState).toBe(17);
  });

  it('generates the same future rows after restore regardless of prior enemy deaths', () => {
    const first = create();
    const second = create();
    const altered = second.getState();
    altered.enemies.splice(0, 2);
    second.restoreState(altered);
    const firstFutureId = first.getState().enemyStream!.nextEnemyId;
    advance(first, 2);
    advance(second, 2);
    const future = (simulation: Simulation) => simulation.getState().enemies
      .filter((enemy) => enemy.id >= firstFutureId);
    expect(future(first)).toEqual(future(second));
    const restored = create();
    restored.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    expect(restored.getState()).toEqual(first.getState());
    advance(first);
    advance(restored);
    expect(restored.getState()).toEqual(first.getState());
  });

  it('crosses level length without a win and naturally removes leaked enemies', () => {
    const simulation = create();
    const initial = simulation.getState();
    for (let index = 0; index < 8; index++) advance(simulation);
    const state = simulation.getState();
    expect(state.player.z).toBeGreaterThan(smallLevel.length);
    expect(state.enemyStream!.nextRowIndex).toBeGreaterThan(initial.enemyStream!.nextRowIndex);
    expect(state.enemyStream!.nextEnemyId).toBeGreaterThan(initial.enemyStream!.nextEnemyId);
    expect(state.enemies.length).toBeLessThan(initial.enemies.length + 16);
    expect(state.squad.count).toBeLessThan(initial.squad.count);
    expect(state.squad.count).toBeGreaterThan(0);
    expect(state.enemies.every((enemy) => enemy.z > state.player.z - tuning.defenseLineOffset)).toBe(true);
  });

  it('freezes row generation at Game Over and retries the same initial layout', () => {
    const first = create();
    advance(first, 2);
    const lost = first.getState();
    lost.squad.count = 0;
    first.restoreState(lost);
    const before = first.getState();
    advance(first, 10);
    expect(first.getState().enemyStream).toEqual(before.enemyStream);
    expect(first.getState().enemies).toEqual(before.enemies);
    expect(first.getState().player).toEqual(before.player);
    const retry = create();
    const original = create().getState();
    expect(retry.getState().enemyStream).toEqual(original.enemyStream);
    expect(retry.getState().enemies).toEqual(original.enemies);
  });

  it('owns the cursor and rejects invalid restored cursors transactionally', () => {
    const simulation = create();
    const exposed = simulation.getState();
    exposed.enemyStream!.nextRowIndex = 999;
    expect(simulation.getState().enemyStream!.nextRowIndex).toBe(4);
    const before = simulation.getState();
    for (const corrupt of [
      (state: SimulationState) => { state.enemyStream!.nextRowIndex = -1; },
      (state: SimulationState) => { state.enemyStream!.nextRowIndex = 1.5; },
      (state: SimulationState) => { state.enemyStream!.nextEnemyId = state.enemies[0].id; },
      (state: SimulationState) => { Object.assign(state.enemyStream!, { extra: true }); },
      (state: SimulationState) => { state.enemyStream = null; },
    ]) {
      const candidate = structuredClone(before);
      corrupt(candidate);
      expect(() => simulation.restoreState(candidate)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });
});
