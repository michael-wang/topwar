import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from '../src/simulation/SimulationState';

const left = { id: 'left', x: -1, zOffset: 5, width: 1.5, hp: 6,
  reward: { mode: 'periodic' as const, kind: 'rifle' as const, amount: 1, intervalSeconds: 2 } };
const right = { id: 'right', x: 1, zOffset: 5, width: 1.5, hp: 9,
  reward: { mode: 'instant' as const, kind: 'rifle' as const, amount: 99 } };
const level: LevelDefinition = { id: 'armory-test', length: 30, enemyGroups: [], upgradeGates: [left, right] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3, gruntContactDamage: 1,
  rifle: { damage: 3, fireRate: 1, projectileSpeed: 10, range: 20 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 10, range: 20, blastRadius: 1.25 },
};
const create = (source = level) => new Simulation({ seed: 1, level: source, startSquad: 1, startRocketCount: 0, gruntHp: 3 });
const rifle = (id: number, x: number, damage = 3): ProjectileSimulationState =>
  ({ id, kind: 'rifle', x, z: 0, speed: 10, damage, remainingRange: 20, blastRadius: 0 });
const rocket = (id: number, x: number): ProjectileSimulationState =>
  ({ id, kind: 'rocket', x, z: 0, speed: 10, damage: 15, remainingRange: 20, blastRadius: 1.25 });
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });

function setProjectiles(simulation: Simulation, projectiles: ProjectileSimulationState[],
  enemies?: EnemySimulationState[]): void {
  const state = simulation.getState();
  if (enemies) state.enemies = enemies;
  state.projectiles = projectiles;
  state.weapons.rifleCooldownRemainingSeconds = 10;
  state.weapons.rocketCooldownRemainingSeconds = 10;
  state.weapons.nextProjectileId = Math.max(state.weapons.nextProjectileId,
    1, ...projectiles.map((projectile) => projectile.id + 1));
  simulation.restoreState(state);
}

const step = (simulation: Simulation, dt = 1, overrides: Partial<SimulationTuning> = {}) =>
  simulation.step(dt, { targetX: 0 }, { ...tuning, ...overrides });

describe('persistent advertisement-style armories', () => {
  it('materializes the authored 840-enemy stream and two independent walls; retry restores both', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const run = create(authored);
    const first = run.getState();
    expect(first.enemies).toHaveLength(840);
    expect(first.gates.map((gate) => [gate.id, gate.zOffset, gate.hp, gate.maxHp, gate.reward.mode])).toEqual([
      ['rifle-generator', 8, 100, 100, 'periodic'], ['rifle-jackpot', 8, 1000, 1000, 'instant'],
    ]);
    expect(first.gates[0]).toHaveProperty('rewardCooldownRemainingSeconds', null);
    setProjectiles(run, [rifle(1, -2.5)]);
    step(run);
    expect(run.getState().gates[0].hp).toBe(97);
    expect(create(authored).getState().gates).toEqual(first.gates);
    expect(create(authored).getState().enemies).toEqual(first.enemies);
  });

  it('owns serializable gate state and rejects obsolete or invalid timers transactionally', () => {
    const simulation = create();
    const exposed = simulation.getState();
    exposed.gates[0].hp = 1;
    exposed.gates[0].reward.amount = 9;
    expect(simulation.getState().gates[0].hp).toBe(6);
    const active = simulation.getState();
    active.gates[0].hp = 0;
    if (active.gates[0].reward.mode !== 'periodic') throw new Error('expected periodic gate');
    active.gates[0].rewardCooldownRemainingSeconds = 1.25;
    simulation.restoreState(JSON.parse(JSON.stringify(active)) as SimulationState);
    const before = simulation.getState();
    for (const corrupt of [
      (s: SimulationState) => { Object.assign(s.gates[0], { rewardsRemaining: 5 }); },
      (s: SimulationState) => { Object.assign(s.gates[0].reward, { count: 5 }); },
      (s: SimulationState) => { Object.assign(s.gates[0], { rewardCooldownRemainingSeconds: -1 }); },
      (s: SimulationState) => { Object.assign(s.gates[0], { rewardCooldownRemainingSeconds: 3 }); },
      (s: SimulationState) => { s.gates[0].hp = -1; },
      (s: SimulationState) => { s.gates[1].id = s.gates[0].id; },
      (s: SimulationState) => { Object.assign(s.gates[1], { rewardCooldownRemainingSeconds: 1 }); },
    ]) {
      const invalid = structuredClone(before);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('keeps both walls beside the player as forward position advances', () => {
    const simulation = create();
    for (let index = 0; index < 10; index++) step(simulation, 1, { forwardSpeed: 10,
      rifle: { ...tuning.rifle, projectileSpeed: 1, range: 1 } });
    const state = simulation.getState();
    expect(state.player.z).toBe(100);
    expect(state.gates.map((gate) => state.player.z + gate.zOffset)).toEqual([105, 105]);
  });

  it('sweeps intact walls and chooses the earliest enemy or wall hit', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1)]);
    step(simulation, 1, { forwardSpeed: 2 });
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([3, 9]);
    expect(simulation.getState().projectiles).toEqual([]);
    const miss = create();
    setProjectiles(miss, [rifle(1, 0)]);
    step(miss);
    expect(miss.getState().gates.map((gate) => gate.hp)).toEqual([6, 9]);
    const fast = create();
    setProjectiles(fast, [{ ...rifle(1, -1), speed: 100 }]);
    step(fast, 0.1, { forwardSpeed: 2 });
    expect(fast.getState().gates[0].hp).toBe(3);
    const nearerEnemy = create();
    setProjectiles(nearerEnemy, [rifle(1, -1)], [grunt(1, -1, 5.8)]);
    step(nearerEnemy, 1, { forwardSpeed: 2 });
    expect(nearerEnemy.getState().enemies).toEqual([]);
    expect(nearerEnemy.getState().gates[0].hp).toBe(6);
    const nearerWall = create();
    setProjectiles(nearerWall, [rifle(1, -1)], [grunt(1, -1, 6.8)]);
    step(nearerWall, 1, { forwardSpeed: 2 });
    expect(nearerWall.getState().enemies).toEqual([grunt(1, -1, 6.8)]);
    expect(nearerWall.getState().gates[0].hp).toBe(3);
  });

  it('does not recruit while the generator wall still has HP', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1)]);
    step(simulation);
    step(simulation, 5);
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 3,
      rewardCooldownRemainingSeconds: null });
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
  });

  it('breaks the left wall without an immediate reward, then recruits every two seconds', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 0,
      rewardCooldownRemainingSeconds: 2 });
    step(simulation, 1);
    expect(simulation.getState().squad.count).toBe(1);
    step(simulation, 1);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0 });
    step(simulation, 6);
    expect(simulation.getState().squad).toEqual({ count: 5, rocketCount: 0 });
    expect(simulation.getState().gates[0].hp).toBe(0);
    expect(simulation.getState().gates[1].hp).toBe(9);
  });

  it('lets projectiles pass through an active generator and new recruits fire next step', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    setProjectiles(simulation, [{ ...rifle(2, -1), speed: 4 }]);
    step(simulation, 2);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().projectiles.map((projectile) => projectile.id)).toContain(2);
    expect(simulation.getState().weapons.nextProjectileId).toBe(3);
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    step(simulation, 0.1);
    expect(simulation.getState().weapons.nextProjectileId).toBe(5);
  });

  it('restores partial timer progress and deterministic future recruitment', () => {
    const first = create();
    setProjectiles(first, [rifle(1, -1, 6)]);
    step(first);
    step(first, 0.75);
    const second = create();
    second.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    step(first, 1.25);
    step(second, 1.25);
    expect(second.getState()).toEqual(first.getState());
    expect(first.getState().squad.count).toBe(2);
    step(first, 20);
    expect(first.getState().squad.count).toBe(12);
  });

  it('pays at the two-second boundary with 60 Hz fixed steps', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    for (let tick = 0; tick < 120; tick++) step(simulation, 1 / 60);
    expect(simulation.getState().squad.count).toBe(2);
  });

  it('freezes generator rewards at zero squad and retry resets the wall', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    const lost = simulation.getState();
    lost.squad.count = 0;
    simulation.restoreState(lost);
    step(simulation, 10);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().gates[0]).toEqual(lost.gates[0]);
    expect(create().getState().gates[0]).toMatchObject({ hp: 6, rewardCooldownRemainingSeconds: null });
  });

  it('retains right-wall damage, then grants +99 exactly once on destruction', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, 1)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([6, 6]);
    setProjectiles(simulation, [rifle(2, 1, 9)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 100, rocketCount: 0 });
    expect(simulation.getState().gates.map((gate) => gate.id)).toEqual(['left']);
    expect(simulation.getState().weapons.nextProjectileId).toBe(3);
    const state = simulation.getState();
    state.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(state);
    step(simulation, 0.1);
    expect(simulation.getState().weapons.nextProjectileId).toBe(103);
    expect(simulation.getState().squad.count).toBe(100);
  });

  it('cannot pay the jackpot twice when two projectiles cross it in one step', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, 1, 9), rifle(2, 1, 9)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 100, rocketCount: 0 });
    expect(simulation.getState().gates.map((gate) => gate.id)).toEqual(['left']);
  });

  it('continues automatic left recruitment after the right jackpot pays out', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6), rifle(2, 1, 9)]);
    step(simulation);
    expect(simulation.getState().squad.count).toBe(100);
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 0,
      rewardCooldownRemainingSeconds: 2 });
    step(simulation, 2);
    expect(simulation.getState().squad).toEqual({ count: 101, rocketCount: 0 });
  });

  it('requires all 1000 authored jackpot HP and keeps left investment independent', () => {
    const simulation = create(LevelDefinitionSchema.parse(authoredLevel));
    setProjectiles(simulation, [rifle(1, 2.5, 999)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([100, 1]);
    setProjectiles(simulation, [rifle(2, 2.5, 1)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 100, rocketCount: 0 });
    expect(simulation.getState().gates.map((gate) => gate.id)).toEqual(['rifle-generator']);
    expect(create(LevelDefinitionSchema.parse(authoredLevel)).getState().gates[1].hp).toBe(1000);
  });

  it('rocket direct hits damage walls and splash only nearby enemies', () => {
    const simulation = create();
    setProjectiles(simulation, [rocket(1, -1)], [grunt(1, -1, 5.4), grunt(2, 2, 5)]);
    step(simulation);
    expect(simulation.getState().gates.map((gate) => gate.hp)).toEqual([0, 9]);
    expect(simulation.getState().enemies).toEqual([grunt(2, 2, 5)]);
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().gates[0]).toHaveProperty('rewardCooldownRemainingSeconds', 2);
    const jackpot = create();
    setProjectiles(jackpot, [rocket(1, 1)]);
    step(jackpot);
    expect(jackpot.getState().squad.count).toBe(100);
    expect(jackpot.getState().gates.map((gate) => gate.hp)).toEqual([6]);
  });

  it('rejects unsafe periodic and instant growth without partially committing', () => {
    for (const mode of ['periodic', 'instant'] as const) {
      const simulation = create();
      const state = simulation.getState();
      const gate = state.gates.find((candidate) => candidate.reward.mode === mode)!;
      gate.reward.amount = Number.MAX_SAFE_INTEGER;
      if (mode === 'periodic') {
        gate.hp = 0;
        if (gate.reward.mode !== 'periodic') throw new Error('expected periodic gate');
        gate.rewardCooldownRemainingSeconds = 1;
      } else {
        state.projectiles = [rifle(1, 1, 9)];
        state.weapons.nextProjectileId = 2;
      }
      state.weapons.rifleCooldownRemainingSeconds = 10;
      simulation.restoreState(state);
      const before = simulation.getState();
      expect(() => step(simulation)).toThrow(/reward exceeds/);
      expect(simulation.getState()).toEqual(before);
    }
  });
});
