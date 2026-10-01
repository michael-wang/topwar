import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { attackLanePositions, laneCompositionForRow } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';

const config = GameConfigSchema.parse(data);
const balance = config.catharsis!;
const level = LevelDefinitionSchema.parse(levelData);
const empty = { id: 'defense-fixture', length: 1000, enemyGroups: [], upgradeGates: [] };
const make = (stream = false, seed = 17) => new Simulation({ seed, level: stream ? level : empty,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: 2, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket } };

it('uses five configurable corridors and a 5 Hz baseline without changing archetype health', () => {
  expect(balance.laneCount).toBe(5);
  expect(config.weapon.rifle.fireRate).toBe(5);
  for (const count of [3, 4, 5]) {
    const positions = attackLanePositions(count, 3.2, balance.edgeInset);
    for (let row = 0; row < 240; row++) {
      for (const enemy of laneCompositionForRow(row, 17, { ...balance, laneCount: count }, 3.2)) {
        expect(Math.abs(enemy.x) + .3).toBeLessThanOrEqual(3.2);
        expect(Math.abs(enemy.x - positions[enemy.lane!])).toBeLessThan((positions[1] - positions[0]) / 2);
      }
    }
  }
  const enemies = make(true).getState().enemies;
  expect(enemies.some((enemy) => enemy.archetype === 'heavy')).toBe(true);
  for (const enemy of enemies) expect(enemy.hp).toBe(enemy.archetype === 'grunt' ? 1 : 5);
});

it('steps exactly one destination lane, clamps, and ignores analog target X', () => {
  const simulation = make();
  expect(simulation.getState().player.selectedLane).toBe(2);
  simulation.stepLane(-1);
  expect(simulation.getState().player.selectedLane).toBe(1);
  simulation.step(1 / 60, { targetX: 3.2 }, tuning);
  expect(simulation.getState().player.x).toBeLessThan(0);
  for (let index = 0; index < 10; index++) simulation.stepLane(-1);
  expect(simulation.getState().player.selectedLane).toBe(0);
  for (let index = 0; index < 10; index++) simulation.stepLane(1);
  expect(simulation.getState().player.selectedLane).toBe(4);
  simulation.step(.4, { targetX: -3.2 }, tuning);
  expect(simulation.getState().player.x).toBeCloseTo(2.8);
});

it('restores an in-progress switch and lane-tagged projectiles deterministically', () => {
  const original = make(true);
  original.stepLane(-1);
  original.step(1 / 60, { targetX: 0 }, tuning);
  const snapshot = JSON.parse(JSON.stringify(original.getState()));
  expect(snapshot.player.selectedLane).toBe(1);
  expect(snapshot.projectiles[0].lane).toBe(1);
  const restored = make(true, 99);
  restored.restoreState(snapshot);
  for (let tick = 0; tick < 100; tick++) {
    if (tick === 3) { original.stepLane(1); restored.stepLane(1); }
    original.step(1 / 60, { targetX: -3 }, tuning);
    restored.step(1 / 60, { targetX: 3 }, tuning);
  }
  expect(restored.getState()).toEqual(original.getState());
  const invalid = original.getState();
  invalid.player.selectedLane = 5;
  expect(() => original.restoreState(invalid)).toThrow();
});

it('generates reproducible loose clusters with explicit lane identity and bounded offsets', () => {
  const group = (seed: number) => laneCompositionForRow(0, seed, balance, 3.2);
  expect(group(17)).toEqual(group(17));
  expect(group(18)).not.toEqual(group(17));
  expect(group(17)).toHaveLength(4);
  expect(new Set(group(17).map((member) => member.x)).size).toBeGreaterThan(2);
  expect(new Set(group(17).map((member) => member.z)).size).toBeGreaterThan(2);
  expect(new Set(group(17).map((member) => member.lane)).size).toBeLessThanOrEqual(2);
});

it.each([['grunt', 1], ['heavy', 5]] as const)('lane fire hits offset %s in %i base rifle hits', (archetype, hits) => {
  const simulation = make();
  const state = simulation.getState();
  state.enemies = [{ id: 1, tier: 1, lane: 2, archetype, x: .36, z: 3, hp: hits },
    { id: 2, tier: 1, lane: 3, archetype: 'grunt', x: 0, z: 2, hp: 1 }];
  simulation.restoreState(state);
  for (let index = 0; index < hits; index++) {
    const current = simulation.getState();
    current.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(current);
    simulation.step(.06, { targetX: 0 }, { ...tuning, forwardSpeed: 0, rifle: { ...tuning.rifle, fireRate: .01 } });
    const enemies = simulation.getState().enemies;
    expect(enemies.find((enemy) => enemy.id === 2)?.hp).toBe(1);
    expect(enemies.find((enemy) => enemy.id === 1)?.hp).toBe(index === hits - 1 ? undefined : hits - index - 1);
  }
});

it('does not generate Bosses, rewards or tier escalation across distant stream handoffs', () => {
  const simulation = make(true);
  for (const z of [100, 500, 2000]) {
    const snapshot = simulation.getState();
    snapshot.enemies = [];
    snapshot.player.z = z;
    simulation.restoreState(snapshot);
    simulation.step(1 / 60, { targetX: 0 }, tuning);
    const state = simulation.getState();
    expect(state.boss).toBeNull();
    expect(state.streamRewards).toHaveLength(0);
    expect(state.enemyStream!.nextBossTier).toBe(1);
    expect(state.enemyStream!.nextRewardBlockIndex).toBe(0);
    expect(state.enemies.every((enemy) => enemy.tier === 1)).toBe(true);
    simulation.restoreState(JSON.parse(JSON.stringify(state)));
  }
});

it('projects standing defenders and relative enemy/projectile positions while simulation progresses', () => {
  const simulation = make(true);
  simulation.step(.1, { targetX: 0 }, tuning);
  const state = simulation.getFrameState();
  expect(state.player.z).toBeGreaterThan(0);
  const view = projectRenderState(state, { catharsis: state.catharsis, trackHalfWidth: 3.2,
    formationSpacing: .45, defenseLineOffset: 1.5, bossVisualScale: 7 });
  expect(view.player.z).toBe(0);
  expect(view.enemies[0].z).toBeCloseTo(state.enemies[0].z - state.player.z);
  expect(view.projectiles[0].z).toBeCloseTo(state.projectiles[0].z - state.player.z);
  expect(view.track.defenseLineZ).toBe(-1.5);
});
