import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';

const level: LevelDefinition = { id: 'test', length: 30, enemyGroups: [] };
const gameConfig = GameConfigSchema.parse(gameData);
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, formationSpacing: 0.45,
  memberRadius: 0.22, gruntRadius: 0.3, gruntContactDamage: 1,
  rifle: { damage: 3, fireRate: 2, projectileSpeed: 10, range: 18 },
};
const create = (count = 1, gruntHp = 10, authored = level) =>
  new Simulation({ seed: 17, level: authored, startSquad: count, gruntHp });
const step = (simulation: Simulation, dt = 0.1, override: SimulationTuning = tuning) =>
  simulation.step(dt, { targetX: 0 }, override);

function restoreCombat(simulation: Simulation, enemies: EnemySimulationState[], projectiles: ProjectileSimulationState[]) {
  const state = simulation.getState();
  state.enemies = enemies;
  state.projectiles = projectiles;
  state.rifle = { cooldownRemainingSeconds: 10, nextProjectileId: Math.max(1, ...projectiles.map((p) => p.id + 1)) };
  simulation.restoreState(state);
}

const bullet = (id: number, x = 0, z = 0, damage = 3): ProjectileSimulationState =>
  ({ id, x, z, damage, speed: 10, remainingRange: 18 });
const enemy = (id: number, x: number, z: number, hp = 10): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp });

describe('Automatic rifle and projectile state', () => {
  it('captures the runtime rifle range on creation without changing bullets already in flight', () => {
    const simulation = create();
    const configured = { ...tuning, rifle: { ...gameConfig.weapon.rifle } };
    step(simulation, 0.1, configured);
    const first = simulation.getState().projectiles[0];
    expect(first.z + first.remainingRange).toBeCloseTo(40);

    step(simulation, 0.05, { ...configured, rifle: { ...configured.rifle, range: 5 } });
    const [existing, newBullet] = simulation.getState().projectiles;
    expect(existing.z + existing.remainingRange).toBeCloseTo(40);
    expect(newBullet.z + newBullet.remainingRange).toBeCloseTo(5);
  });

  it('initializes grunt HP from session config and fires immediately, then at the configured cadence', () => {
    const authored: LevelDefinition = { id: 'one', length: 30, enemyGroups: [
      { id: 'g', z: 10, enemy: 'grunt', count: 1, formation: { columns: 1, spacing: 0.8 } },
    ] };
    const simulation = create(1, 12, authored);
    expect(simulation.getState().enemies[0].hp).toBe(12);
    step(simulation, 0.1);
    expect(simulation.getState().projectiles.map((p) => p.id)).toEqual([1]);
    expect(simulation.getState().rifle.nextProjectileId).toBe(2);
    step(simulation, 0.3);
    expect(simulation.getState().projectiles.map((p) => p.id)).toEqual([1]);
    step(simulation, 0.11);
    expect(simulation.getState().projectiles.map((p) => p.id)).toEqual([1, 2]);
    expect(simulation.getState().enemies[0].hp).toBe(12);
  });

  it('uses one shot per member and squad formation X positions without spread or RNG', () => {
    const simulation = create(3);
    step(simulation);
    expect(simulation.getState().projectiles.map((p) => p.x)).toEqual([-0.225, 0.225, 0]);
    expect(simulation.getState().projectiles.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(simulation.getState().rngState).toBe(17);
    const empty = create(0);
    step(empty);
    expect(empty.getState().projectiles).toEqual([]);
  });

  it('moves only forward, expires at range, and owns serializable projectile data', () => {
    const simulation = create();
    step(simulation);
    expect(simulation.getState().projectiles[0]).toMatchObject({ z: 1, remainingRange: 17 });
    const exposed = simulation.getState();
    exposed.projectiles[0].x = 999;
    exposed.rifle.nextProjectileId = 999;
    expect(simulation.getState().projectiles[0].x).toBe(0);
    expect(simulation.getState().rifle.nextProjectileId).toBe(2);
    const saved = JSON.parse(JSON.stringify(simulation.getState()));
    const restored = create();
    restored.restoreState(saved);
    expect(restored.getState()).toEqual(simulation.getState());
    step(restored, 2, { ...tuning, rifle: { ...tuning.rifle, fireRate: 0.1 } });
    expect(restored.getState().projectiles).toEqual([]);
    expect(restored.getState().rifle.nextProjectileId).toBe(3);
  });

  it('captures shot tuning at creation; later tuning affects only new bullets', () => {
    const simulation = create();
    step(simulation);
    const changed = { ...tuning, rifle: { damage: 7, fireRate: 2, projectileSpeed: 20, range: 9 } };
    step(simulation, 0.4, changed);
    expect(simulation.getState().projectiles[0]).toMatchObject({ damage: 3, speed: 10, remainingRange: 13 });
    expect(simulation.getState().projectiles[1]).toMatchObject({ damage: 7, speed: 20 });
    expect(simulation.getState().projectiles[1].remainingRange).toBe(1);
  });

  it('restores allocator state after old bullets disappear and reproduces future IDs', () => {
    const first = create();
    step(first);
    const state = first.getState();
    state.projectiles = [];
    state.rifle.cooldownRemainingSeconds = 0;
    const second = create();
    second.restoreState(JSON.parse(JSON.stringify(state)));
    step(second);
    expect(second.getState().projectiles.map((p) => p.id)).toEqual([2]);
    first.restoreState(state);
    step(first);
    expect(second.getState()).toEqual(first.getState());
  });
});

describe('Swept hits and enemy death', () => {
  it('removes a base grunt on one aligned shot using the runtime damage and HP', () => {
    const oneGrunt: LevelDefinition = { id: 'fodder', length: 20, enemyGroups: [
      { id: 'first', z: 2, enemy: 'grunt', count: 1, formation: { columns: 1, spacing: 0.8 } },
    ] };
    const simulation = create(1, gameConfig.enemies.grunt.hp, oneGrunt);
    expect(simulation.getState().enemies[0].hp).toBe(3);
    step(simulation, 0.1, { ...tuning, gruntRadius: gameConfig.enemies.grunt.radius,
      rifle: { ...gameConfig.weapon.rifle } });
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it.each([
    ['center', 0, true],
    ['just inside radius', gameConfig.enemies.grunt.radius - 0.001, true],
    ['exact radius boundary', gameConfig.enemies.grunt.radius, true],
    ['outside radius', gameConfig.enemies.grunt.radius + 0.001, false],
  ] as const)('%s collision behaves deterministically', (_label, x, shouldHit) => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(1, 0, 5, 3)], [bullet(1, x)]);
    step(simulation, 1, { ...tuning, gruntRadius: gameConfig.enemies.grunt.radius });
    expect(simulation.getState().enemies.length).toBe(shouldHit ? 0 : 1);
  });

  it('sweeps a high-speed shot across an enemy without tunneling', () => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(1, 0, 5, 3)], [{ ...bullet(1), speed: 1000 }]);
    step(simulation, 0.01);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('keeps higher-HP enemies alive until enough individual hits land', () => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(1, 0, 5, 6)], [bullet(1)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([enemy(1, 0, 5, 3)]);
    const state = simulation.getState();
    state.projectiles = [bullet(2)];
    state.rifle.nextProjectileId = 3;
    simulation.restoreState(state);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([]);
  });

  it('erodes the authored opening pair with three aligned rifle streams', () => {
    const simulation = create(3, 10, LevelDefinitionSchema.parse(authoredLevel));
    const configured = { ...tuning, forwardSpeed: 3,
      rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 18 } };
    for (let tick = 0; tick < 120; tick++) simulation.step(1 / 60, { targetX: 0 }, configured);
    expect(simulation.getState().enemies.map((enemy) => enemy.id)).not.toContain(1);
    expect(simulation.getState().enemies.map((enemy) => enemy.id)).not.toContain(2);
  });
  it('hits an enemy between endpoints, damages it, and leaves enemies static', () => {
    const simulation = create();
    restoreCombat(simulation, [enemy(1, 0, 5)], [bullet(1)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([enemy(1, 0, 5, 7)]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('does not auto-aim, hit behind travel, or modify a missed enemy', () => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(1, 0.4, 5), enemy(2, 0, -2)], [bullet(1)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([enemy(1, 0.4, 5), enemy(2, 0, -2)]);
  });

  it('hits only the earliest enemy, breaking exact ties by ID', () => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(9, 0, 7), enemy(5, 0, 5), enemy(2, 0, 5)], [bullet(1)]);
    step(simulation, 1);
    expect(simulation.getState().enemies.map((e) => [e.id, e.hp])).toEqual([[9, 10], [5, 10], [2, 7]]);
  });

  it('removes a killed enemy before later projectiles in the same tick can hit it', () => {
    const simulation = create(1);
    restoreCombat(simulation, [enemy(1, 0, 5, 3), enemy(2, 0, 7, 3)], [bullet(1), bullet(2)]);
    step(simulation, 1);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().projectiles).toEqual([]);
  });

  it('rejects invalid combat restore without changing state or RNG', () => {
    const simulation = create();
    step(simulation);
    const before = simulation.getState();
    for (const damage of [
      (s: typeof before) => { s.projectiles[0].remainingRange = 0; },
      (s: typeof before) => { s.projectiles.push({ ...s.projectiles[0] }); },
      (s: typeof before) => { s.rifle.nextProjectileId = 1; },
      (s: typeof before) => { s.rifle.cooldownRemainingSeconds = Infinity; },
      (s: typeof before) => { (s.projectiles[0] as unknown as Record<string, unknown>).extra = 1; },
    ]) {
      const invalid = JSON.parse(JSON.stringify(before)) as typeof before;
      damage(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('replays the same movement and tuning sequence exactly', () => {
    const a = create(3);
    const b = create(3);
    for (const dt of [0.1, 0.15, 0.4, 0.1]) {
      a.step(dt, { targetX: 0.5 }, tuning);
      b.step(dt, { targetX: 0.5 }, tuning);
    }
    expect(a.getState()).toEqual(b.getState());
    expect(a.getState().rngState).toBe(17);
  });
});
