import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { createEnemyStreamRow } from '../src/simulation/enemies/streamRow';
import type { SimulationState } from '../src/simulation/SimulationState';

const authored = LevelDefinitionSchema.parse(authoredLevel);
const smallLevel: LevelDefinition = { id: 'short-endless', length: 3, enemyGroups: [], upgradeGates: [],
  enemyStream: { enemy: 'grunt', startZ: 2, spawnAheadDistance: 5,
    columns: 2, spacing: 1, jitter: 0.2, seed: 42,
    bruteRamp: { startRow: 1000, fullRow: 1100, curvePower: 2 } } };
const tuning: SimulationTuning = { moveSpeed: 5, forwardSpeed: 1, trackHalfWidth: 2.5,
  defenseLineOffset: 1.5, formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3,
  gruntContactDamage: 1,
  bruteRadius: 0.55, bruteContactDamage: 1,
  rifle: { damage: 3, fireRate: 0.1, projectileSpeed: 1, range: 1 },
  rocket: { damage: 15, fireRate: 0.1, projectileSpeed: 1, range: 1, blastRadius: 1.25 } };
const create = (level = smallLevel, count = 20) => new Simulation({ seed: 17, level,
  startSquad: count, startRocketCount: 0, gruntHp: 3, bruteHp: 300 });
const advance = (simulation: Simulation, dt = 1, forwardSpeed = 1) =>
  simulation.step(dt, { targetX: 2.5 }, { ...tuning, forwardSpeed });

describe('deterministic endless enemy stream', () => {
  const rampLevel: LevelDefinition = { ...authored,
    enemyStream: { ...authored.enemyStream!, spawnAheadDistance: 630 } };
  const rampState = create(rampLevel, 1).getState();
  const row = (index: number) => rampState.enemies.slice(index * 7, (index + 1) * 7);

  it('keeps seven original positions and IDs per row while the long ramp eventually saturates', () => {
    const stream = authored.enemyStream!;
    expect(row(47).filter((enemy) => enemy.type === 'brute')).toHaveLength(0);
    expect(row(48).filter((enemy) => enemy.type === 'brute')).toHaveLength(1);
    for (const index of [47, 48, 49, 96, 160, 288, 504, 732, 900, 960, 1000]) {
      const enemies = row(index);
      expect(enemies).toHaveLength(7);
      const offsets = createEnemyStreamRow(index, stream.columns, stream.spacing,
        stream.jitter, stream.seed);
      expect(enemies.map(({ x, z }) => ({ x, z }))).toEqual(offsets.map((offset) =>
        ({ x: offset.x, z: stream.startZ + index * stream.spacing + offset.z })));
      expect(enemies.map((enemy) => enemy.id)).toEqual(Array.from({ length: 7 }, (_, column) =>
        index * 7 + column + 1));
    }
    for (let index = 960; index <= 1000; index++) {
      expect(row(index).every((enemy) => enemy.type === 'brute')).toBe(true);
    }
    expect(rampState.enemies.every((enemy) => enemy.hp === (enemy.type === 'brute' ? 300 : 3))).toBe(true);
  });

  it('keeps the first reveal center-most, then scatters brutes instead of forming bands', () => {
    const stream = authored.enemyStream!;
    const reveal = row(48);
    const nearest = reveal.reduce((best, enemy, column) =>
      Math.abs(enemy.x) < Math.abs(reveal[best].x) ? column : best, 0);
    expect(reveal[nearest].type).toBe('brute');
    expect(reveal.filter((enemy) => enemy.type === 'brute')).toHaveLength(1);
    expect(reveal[nearest].z).toBeCloseTo(stream.startZ + 48 * stream.spacing, 0);
    const counts = Array.from({ length: 912 }, (_, offset) => row(48 + offset)
      .filter((enemy) => enemy.type === 'brute').length);
    expect(counts.slice(1, 40)).toContain(0);
    expect(counts.some((count, index) => index > 0 && count < counts[index - 1])).toBe(true);
    expect(create(rampLevel, 1).getState().enemies).toEqual(rampState.enemies);
  });

  it('raises the statistical brute share across broad bands without per-row monotonicity', () => {
    const ratio = (start: number, end: number) => {
      let brutes = 0;
      for (let index = start; index <= end; index++) {
        brutes += row(index).filter((enemy) => enemy.type === 'brute').length;
      }
      return brutes / ((end - start + 1) * 7);
    };
    const early = ratio(49, 160);
    const middle = ratio(400, 550);
    const late = ratio(800, 959);
    expect(early).toBeLessThan(0.05);
    expect(middle).toBeGreaterThan(0.1);
    expect(middle).toBeLessThan(0.4);
    expect(late).toBeGreaterThan(0.6);
    expect(early).toBeLessThan(middle);
    expect(middle).toBeLessThan(late);
  });

  it('repeats slot types for a seed and varies transition patterns with a new content seed', () => {
    const alternate: LevelDefinition = { ...rampLevel,
      enemyStream: { ...rampLevel.enemyStream!, seed: 104730 } };
    const changed = create(alternate, 1).getState().enemies;
    const types = (enemies: SimulationState['enemies']) => enemies.slice(500 * 7, 601 * 7)
      .map((enemy) => enemy.type);
    expect(types(changed)).not.toEqual(types(rampState.enemies));
    expect(create(rampLevel, 1).getState().enemies).toEqual(rampState.enemies);
    expect(create(alternate, 1).getState().enemies).toEqual(changed);
    expect(rampState.rngState).toBe(17);
  });

  it('breaks equal-distance center ties by the lower column index', () => {
    const regular: LevelDefinition = { ...smallLevel, enemyStream: { ...smallLevel.enemyStream!,
      columns: 4, jitter: 0, bruteRamp: { startRow: 0, fullRow: 3, curvePower: 2 } } };
    expect(create(regular, 1).getState().enemies.slice(0, 4).map((enemy) => enemy.type))
      .toEqual(['grunt', 'brute', 'grunt', 'grunt']);
  });

  it('reproduces the ramp before, during, and after transition despite earlier deaths', () => {
    const futureLevel = { ...smallLevel, enemyStream: { ...smallLevel.enemyStream!,
      bruteRamp: { startRow: 6, fullRow: 10, curvePower: 2 } } };
    const first = create(futureLevel);
    const second = create(futureLevel);
    const before = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const altered = second.getState();
    altered.enemies = [];
    second.restoreState(JSON.parse(JSON.stringify(altered)) as SimulationState);
    advance(first, 3);
    advance(second, 3);
    const afterId = before.enemyStream!.nextEnemyId;
    const future = (simulation: Simulation) => simulation.getState().enemies
      .filter((enemy) => enemy.id >= afterId);
    expect(future(first)).toEqual(future(second));
    const during = JSON.parse(JSON.stringify(first.getState())) as SimulationState;
    const resumed = create(futureLevel);
    resumed.restoreState(during);
    advance(first, 5);
    advance(resumed, 5);
    expect(resumed.getState()).toEqual(first.getState());
    const fullRows = first.getState().enemies.filter((enemy) => enemy.id >= 21);
    expect(fullRows.length).toBeGreaterThan(0);
    expect(fullRows.every((enemy) => enemy.type === 'brute')).toBe(true);
    const saturated = create(futureLevel);
    saturated.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    advance(first, 3);
    advance(saturated, 3);
    expect(saturated.getState()).toEqual(first.getState());
    const laterRows = first.getState().enemies.filter((enemy) => enemy.id >= 25);
    expect(laterRows.length).toBeGreaterThan(0);
    expect(laterRows.every((enemy) => enemy.type === 'brute')).toBe(true);
    const retry = create(futureLevel);
    expect(retry.getState()).toEqual(before);
    advance(retry, 3);
    expect(future(retry)).toEqual(future(second));
    expect(first.getState().rngState).toBe(before.rngState);
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
