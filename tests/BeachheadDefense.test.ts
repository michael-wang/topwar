import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { CatharsisConfigSchema } from '../src/config/catharsisConfig';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { attackLanePositions, laneCompositionForRow, laneWave } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';

const config = GameConfigSchema.parse(data);
const balance = config.catharsis!;
const level = LevelDefinitionSchema.parse(levelData);
const empty = { id: 'defense-fixture', length: 1000, enemyGroups: [], upgradeGates: [] };
const make = (stream = false, seed = 17) => new Simulation({ seed, level: stream ? level : empty,
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: config.player.forwardSpeed, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket } };

it('uses five configurable corridors and a 3 Hz baseline without changing archetype health', () => {
  expect(balance.laneCount).toBe(5);
  expect(balance.groupSize).toBe(24);
  expect(balance.waveRows).toBe(6);
  expect(config.player.forwardSpeed).toBe(.6);
  expect(balance.gruntSpeed).toBe(.25);
  expect(balance.heavySpeed).toBe(.12);
  expect(balance.heavyHp).toBe(15);
  expect(config.weapon.rifle.fireRate).toBe(3);
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
  for (const enemy of enemies) expect(enemy.hp).toBe(enemy.archetype === 'grunt' ? 1 : 15);
});

it('uses a defense shoreline horizon while leaving the legacy stream horizon unchanged', () => {
  expect(balance.defenseSpawnAheadDistance).toBe(53);
  expect(balance.crowdDepthSpan).toBe(9);
  const defense = make(true);
  expect(defense.getState().enemies.every(enemy => enemy.z <= 53)).toBe(true);
  const custom = new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance: { ...balance, defenseSpawnAheadDistance: 42 }, trackHalfWidth: 3.2 } });
  expect(custom.getState().enemies.every(enemy => enemy.z <= 42)).toBe(true);
  expect(custom.getState().enemies.length).toBeLessThan(defense.getState().enemies.length);
  const legacy = new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0, tiers: config.tiers });
  expect(legacy.getState().enemyStream!.nextRowIndex).toBe(111);
  expect(Math.max(...legacy.getState().enemies.map(enemy => enemy.z))).toBeGreaterThan(90);
  // Advance the stream across a new entry boundary; every new member appears on the beach.
  const state = defense.getState();
  const nextId = state.enemyStream!.nextEnemyId;
  state.player.z = 2.2;
  defense.restoreState(state);
  defense.step(1 / 60, { targetX: 0 }, tuning);
  const advanced = defense.getState();
  const newEnemies = advanced.enemies.filter(enemy => enemy.id >= nextId);
  expect(newEnemies).toHaveLength(24);
  expect(newEnemies.every(enemy => enemy.z - advanced.player.z <= 53)).toBe(true);
  expect(newEnemies.every(enemy => enemy.z - advanced.player.z >= 44 - .02)).toBe(true);
});

it('projects Heavy proportions while leaving Grunts and all simulation outcomes unchanged', () => {
  const old = new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0, tiers: config.tiers,
    catharsis: { balance: { ...balance, heavyWidthMultiplier: 1, heavyHeightMultiplier: 1, heavyDepthMultiplier: 1 }, trackHalfWidth: 3.2 } });
  const current = make(true);
  const view = projectRenderState(current.getFrameState(), { catharsis: current.getFrameState().catharsis,
    trackHalfWidth: 3.2, defenseLineOffset: 1.5, formationSpacing: .45, bossVisualScale: 7 });
  const heavy = view.enemies.find(enemy => enemy.archetype === 'heavy')!;
  const grunt = view.enemies.find(enemy => enemy.archetype === 'grunt')!;
  expect(heavy.hp).toBe(15);
  expect(heavy.visualScaleX).toBeCloseTo(1.9845);
  expect(heavy.visualScaleY).toBeCloseTo(2.1735);
  expect(heavy.visualScaleZ).toBeCloseTo(2.1735);
  expect(grunt.visualScale).toBe(1.4);
  expect(grunt.visualScaleX).toBeUndefined();
  expect(config.tiers.normalEnemyRadius).toBe(.3);
  expect([balance.groupSize, balance.pressureLaneCount, balance.crowdDepthSpan,
    balance.lateralSpreadFraction, balance.defenseSpawnAheadDistance, config.weapon.rifle.fireRate,
    balance.heavyHp, config.player.forwardSpeed, balance.gruntSpeed, balance.heavySpeed,
    balance.waveRows, balance.heavyChance, balance.laneCount, balance.laneSwitchSeconds])
    .toEqual([24, 3, 9, .42, 53, 3, 15, .6, .25, .12, 6, .25, 5, .15]);
  for (let tick = 0; tick < 1800; tick++) {
    if (tick === 120 || tick === 700) { current.stepLane(-1); old.stepLane(-1); }
    current.step(1 / 60, { targetX: 0 }, tuning);
    old.step(1 / 60, { targetX: 0 }, tuning);
  }
  const { catharsis: currentVisuals, ...currentGameplay } = current.getState();
  const { catharsis: oldVisuals, ...oldGameplay } = old.getState();
  expect(currentGameplay).toEqual(oldGameplay);
  const restored = make(true, 99);
  restored.restoreState(JSON.parse(JSON.stringify(current.getState())));
  expect(restored.getState()).toEqual(current.getState());
  for (const key of ['heavyWidthMultiplier', 'heavyHeightMultiplier', 'heavyDepthMultiplier']) {
    expect(() => CatharsisConfigSchema.parse({ ...balance, [key]: 0 })).toThrow();
    expect(() => CatharsisConfigSchema.parse({ ...balance, [key]: Infinity })).toThrow();
    expect(() => CatharsisConfigSchema.parse({ ...balance, [key]: 3 })).toThrow();
  }
  const { heavyWidthMultiplier, heavyHeightMultiplier, heavyDepthMultiplier, ...legacyBalance } = balance;
  const legacy = CatharsisConfigSchema.parse(legacyBalance);
  expect([legacy.heavyWidthMultiplier, legacy.heavyHeightMultiplier, legacy.heavyDepthMultiplier]).toEqual([1, 1, 1]);
});

it('chooses three distinct seeded fronts per priority block and distributes 24 members as 8/8/8', () => {
  expect(balance.pressureLaneCount).toBe(3);
  expect(balance.lateralSpreadFraction).toBe(.42);
  for (let block = 0; block < 30; block++) {
    const wave = block * balance.priorityWaves;
    const fronts = laneWave(wave, 17, balance).lanes;
    expect(new Set(fronts).size).toBe(3);
    expect(laneWave(wave, 17, balance).lanes).toEqual(fronts);
    for (let index = 0; index < balance.priorityWaves; index++) {
      expect(laneWave(wave + index, 17, balance).lanes).toEqual(fronts);
      const group = laneCompositionForRow((wave + index) * balance.waveRows, 17, balance, 3.2);
      expect(group).toHaveLength(24);
      for (const lane of fronts) expect(group.filter(enemy => enemy.lane === lane)).toHaveLength(8);
    }
  }
  const frontsForSeed = (seed: number) => Array.from({ length: 30 }, (_, wave) => laneWave(wave, seed, balance).lanes);
  expect(frontsForSeed(18)).not.toEqual(frontsForSeed(17));
  for (const count of [1, 2, 3, 4, 5]) {
    expect(laneWave(0, 17, { ...balance, pressureLaneCount: count }).lanes).toHaveLength(count);
  }
  for (const groupSize of [10, 25, 60]) {
    const group = laneCompositionForRow(0, 17, { ...balance, groupSize }, 3.2);
    const counts = laneWave(0, 17, balance).lanes.map(lane => group.filter(enemy => enemy.lane === lane).length);
    expect(group).toHaveLength(groupSize);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  }
  expect(() => CatharsisConfigSchema.parse({ ...balance, pressureLaneCount: 6 })).toThrow();
  expect(make(true).getState().enemies).toHaveLength(168);
});

it('preserves legacy one/two-front selection outside defense mode', () => {
  const legacy = { ...balance, defenseMode: false };
  for (let wave = 0; wave < 30; wave++) {
    expect(laneWave(wave, 17, legacy)).toEqual(laneWave(wave, 17, { ...legacy, pressureLaneCount: undefined }));
  }
});

it.each([1, 17, 42, 99])('holds a continuously defended Grunt front while unattended fronts overwhelm seed %i', seed => {
  const simulation = new Simulation({ seed, level, startSquad: 1, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance: { ...balance, heavyChance: 0 }, trackHalfWidth: 3.2 } });
  const start = simulation.getState();
  const heldLane = start.enemies.reduce((nearest, enemy) => enemy.z < nearest.z ? enemy : nearest).lane!;
  start.player.selectedLane = heldLane;
  start.player.x = attackLanePositions(5, 3.2, balance.edgeInset)[heldLane];
  simulation.restoreState(start);
  const initialUnattended = start.enemies.filter(enemy => enemy.lane !== heldLane).length;
  let maxUnattended = initialUnattended;
  let fatalLane: number | undefined;
  for (let tick = 0; tick < 3600 && simulation.getFrameState().squad.count; tick++) {
    const before = simulation.getFrameState();
    const lanesById = new Map(before.enemies.map(enemy => [enemy.id, enemy.lane]));
    simulation.step(1 / 60, { targetX: 0 }, tuning);
    for (const event of simulation.consumePresentationEvents()) {
      if (event.kind === 'normalEnemyContact') fatalLane = lanesById.get(event.enemyId);
    }
    maxUnattended = Math.max(maxUnattended, simulation.getFrameState().enemies.filter(enemy => enemy.lane !== heldLane).length);
  }
  expect(simulation.getState().squad.count).toBe(0);
  expect(simulation.getState().elapsedSeconds).toBeGreaterThan(20);
  expect(fatalLane).toBeDefined();
  expect(fatalLane).not.toBe(heldLane);
  expect(maxUnattended).toBeGreaterThan(initialUnattended);
  // Authored incoming budget: one front is below rifle capacity, all fronts exceed it.
  const waveSeconds = level.enemyStream!.spacing * balance.waveRows / config.player.forwardSpeed;
  expect(balance.groupSize / balance.pressureLaneCount! / waveSeconds).toBeLessThan(config.weapon.rifle.fireRate);
  expect(balance.groupSize / waveSeconds).toBeGreaterThan(config.weapon.rifle.fireRate);
});

it.each([10, 24, 60, 100])('samples %i members deterministically within the same bounded crowd volume', (groupSize) => {
  const layout = { ...balance, groupSize };
  for (let row = 0; row < 120; row += balance.waveRows) {
    const group = laneCompositionForRow(row, 17, layout, 3.2);
    expect(group).toEqual(laneCompositionForRow(row, 17, layout, 3.2));
    expect(group).not.toEqual(laneCompositionForRow(row, 18, layout, 3.2));
    expect(group).toHaveLength(groupSize);
    const positions = attackLanePositions(balance.laneCount, 3.2, balance.edgeInset);
    for (const enemy of group) {
      expect(enemy.z).toBeGreaterThanOrEqual(-9);
      expect(enemy.z).toBeLessThanOrEqual(0);
      expect(Math.abs(enemy.x) + .3).toBeLessThanOrEqual(3.2);
      expect(Math.abs(enemy.x - positions[enemy.lane!])).toBeLessThanOrEqual(1.4 * balance.lateralSpreadFraction);
    }
  }
});

it('tunes density for future groups and restores its balance and stream continuation', () => {
  const original = make(true);
  const existing = original.getState().enemies;
  original.setCatharsisBalance({ ...balance, groupSize: 100, pressureLaneCount: 4, crowdDepthSpan: 4, defenseSpawnAheadDistance: 54 });
  expect(original.getState().enemies).toEqual(existing);
  const saved = JSON.parse(JSON.stringify(original.getState()));
  const restored = make(true, 99);
  restored.restoreState(saved);
  expect(restored.getState().catharsis!.balance.groupSize).toBe(100);
  expect(restored.getState().catharsis!.balance.pressureLaneCount).toBe(4);
  const newIds = saved.enemyStream.nextEnemyId;
  for (let tick = 0; tick < 1200; tick++) {
    original.step(1 / 60, { targetX: 0 }, tuning);
    restored.step(1 / 60, { targetX: 0 }, tuning);
  }
  const after = original.getState();
  expect(after.enemies.filter(enemy => enemy.id >= newIds).length).toBeGreaterThanOrEqual(100);
  expect(after.enemyStream!.nextEnemyId - newIds).toBe(300);
  expect(restored.getState()).toEqual(after);
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

it.each([-1, 1] as const)('reports when direction %i reaches an edge so keyboard repeat stops immediately', (direction) => {
  const simulation = make();
  expect(simulation.stepLane(direction)).toBe(true);
  expect(simulation.stepLane(direction)).toBe(false);
  const edge = simulation.getState().player.selectedLane;
  expect(edge).toBe(direction === -1 ? 0 : 4);
  expect(simulation.stepLane(direction)).toBe(false);
  expect(simulation.getState().player.selectedLane).toBe(edge);
  expect(simulation.stepLane(direction === -1 ? 1 : -1)).toBe(true);
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
  for (let tick = 0; tick < 600; tick++) {
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
  expect(group(17)).toHaveLength(24);
  expect(new Set(group(17).map((member) => member.x)).size).toBeGreaterThan(2);
  expect(new Set(group(17).map((member) => member.z)).size).toBeGreaterThan(2);
  expect(new Set(group(17).map((member) => member.lane)).size).toBe(3);
});

it('permits twenty-four overlapping members per six-row wave without reducing the total budget', () => {
  expect(CatharsisConfigSchema.parse(balance)).toEqual(balance);
  expect(() => CatharsisConfigSchema.parse({ ...balance, defenseMode: false })).toThrow();
  const previous = new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance: { ...balance, groupSize: 10 }, trackHalfWidth: 3.2 } });
  expect(make(true).getState().enemies.length).toBe(previous.getState().enemies.length * 2.4);
  let overlappingPairs = 0;
  for (let wave = 0; wave < 100; wave++) {
    const group = Array.from({ length: balance.waveRows }, (_, slot) =>
      laneCompositionForRow(wave * balance.waveRows + slot, 17, balance, 3.2)).flat();
    expect(group).toHaveLength(24);
    for (let a = 0; a < group.length; a++) for (let b = a + 1; b < group.length; b++) {
      if (group[a].lane === group[b].lane && Math.hypot(group[a].x - group[b].x, group[a].z - group[b].z) < .6)
        overlappingPairs++;
    }
  }
  expect(overlappingPairs).toBeGreaterThan(100);
});

it.each([['grunt', 1], ['heavy', 15]] as const)('lane fire hits offset %s in %i base rifle hits', (archetype, hits) => {
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

it.each([3, 5, 10])('keeps Heavy durability fixed at 15 hits with a %i Hz Rifle', (fireRate) => {
  const simulation = make();
  const state = simulation.getState();
  state.enemies = [{ id: 1, tier: 1, lane: 2, archetype: 'heavy', x: .3, z: 15, hp: balance.heavyHp }];
  simulation.restoreState(state);
  const live = { ...tuning, forwardSpeed: 0, rifle: { ...tuning.rifle, fireRate } };
  // Record health changes to count actual hits, independently of cooldown timing.
  let hits = 0;
  let previousHp = 15;
  while (simulation.getState().enemies.length) {
    simulation.step(1 / 60, { targetX: 0 }, live);
    const enemy = simulation.getState().enemies[0];
    const hp = enemy?.hp ?? 0;
    if (hp < previousHp) { hits += previousHp - hp; previousHp = hp; }
    expect(simulation.getState().elapsedSeconds).toBeLessThan(6);
  }
  expect(hits).toBe(15);
  expect(simulation.getState().elapsedSeconds).toBeCloseTo(14 / fireRate + 15 / 60, 1);
});

it('applies explicit Heavy live tuning above 15 without changing Grunt health', () => {
  const simulation = make(true);
  const before = simulation.getState().enemies;
  simulation.setCatharsisBalance({ ...balance, heavyHp: 40 });
  for (const enemy of simulation.getState().enemies) {
    expect(enemy.hp).toBe(enemy.archetype === 'heavy' ? 40 : 1);
  }
  expect(before.filter(enemy => enemy.archetype === 'heavy').every(enemy => enemy.hp === 15)).toBe(true);
  const restored = make(true, 99);
  restored.restoreState(JSON.parse(JSON.stringify(simulation.getState())));
  expect(restored.getState()).toEqual(simulation.getState());
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
