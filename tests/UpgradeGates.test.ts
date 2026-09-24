import { describe, expect, it } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState, UpgradePickupSimulationState } from '../src/simulation/SimulationState';

const left = { id: 'left', x: -1, zOffset: 5, width: 1.5, hp: 6,
  reward: { mode: 'pickup' as const, kind: 'rifle' as const, amount: 1, intervalSeconds: 1, dropSpeed: 4 } };
const right = { id: 'right', x: 1, zOffset: 5, width: 1.5, hp: 9,
  reward: { mode: 'instant' as const, kind: 'rifle' as const, amount: 99 } };
const level: LevelDefinition = { id: 'armory-test', length: 30, enemyGroups: [], upgradeGates: [left, right] };
const tuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 2.5, defenseLineOffset: 1.5,
  formationSpacing: 0.45, memberRadius: 0.22, gruntRadius: 0.3, gruntContactDamage: 1,
  bruteRadius: 0.55, bruteContactDamage: 1,
  rifle: { damage: 3, fireRate: 1, projectileSpeed: 10, range: 20 },
  rocket: { damage: 15, fireRate: 0.6, projectileSpeed: 10, range: 20, blastRadius: 1.25 },
};
const create = (source = level) => new Simulation({ seed: 1, level: source, startSquad: 1, startRocketCount: 0, gruntHp: 3, bruteHp: 300 });
const rifle = (id: number, x: number, damage = 3): ProjectileSimulationState =>
  ({ id, kind: 'rifle', x, z: 0, speed: 10, damage, remainingRange: 20, blastRadius: 0 });
const rocket = (id: number, x: number): ProjectileSimulationState =>
  ({ id, kind: 'rocket', x, z: 0, speed: 10, damage: 15, remainingRange: 20, blastRadius: 1.25 });
const grunt = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, type: 'grunt', x, z, hp: 3 });
const pickup = (id: number, zOffset = 2): UpgradePickupSimulationState =>
  ({ id, sourceGateId: 'left', x: -1, zOffset, width: 1.5,
    rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 4 });

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
  it('materializes the opening stream horizon and two independent walls; retry restores both', () => {
    const authored = LevelDefinitionSchema.parse(authoredLevel);
    const run = create(authored);
    const first = run.getState();
    expect(first.enemies.length).toBeGreaterThan(700);
    expect(first.enemyStream?.nextEnemyId).toBe(first.enemies.length + 1);
    expect(first.gates.map((gate) => [gate.id, gate.zOffset, gate.hp, gate.maxHp, gate.reward.mode])).toEqual([
      ['rifle-generator', 8, 100, 100, 'pickup'], ['rifle-jackpot', 8, 1000, 1000, 'instant'],
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
    if (active.gates[0].reward.mode !== 'pickup') throw new Error('expected pickup gate');
    active.gates[0].rewardCooldownRemainingSeconds = 0.75;
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

  it('can hit the authored left armory from the legal left track edge', () => {
    const simulation = create(LevelDefinitionSchema.parse(authoredLevel));
    const live = { ...tuning, moveSpeed: 5, forwardSpeed: 1.5,
      rifle: { damage: 3, fireRate: 7, projectileSpeed: 28, range: 40 } };
    for (let tick = 0; tick < 120; tick++) simulation.step(1 / 60, { targetX: -2.5 }, live);
    expect(simulation.getState().gates[0].hp).toBeLessThan(100);
  });

  it('emits no pickups while the generator wall still has HP', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1)]);
    step(simulation);
    step(simulation, 5);
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 3,
      rewardCooldownRemainingSeconds: null });
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    expect(simulation.getState().pickups).toEqual([]);
  });

  it('breaks the wall without a reward and emits one plaque per full interval', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    expect(simulation.getState().squad).toEqual({ count: 1, rocketCount: 0 });
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 0,
      rewardCooldownRemainingSeconds: 1 });
    expect(simulation.getState().pickups).toEqual([]);
    step(simulation, 0.5);
    expect(simulation.getState().pickups).toEqual([]);
    step(simulation, 0.5);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, sourceGateId: 'left',
      x: -1, zOffset: 5, width: 1.5, rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 4 }]);
    expect(simulation.getState().squad.count).toBe(1);
    step(simulation, 1);
    expect(simulation.getState().pickups.map((pickup) => pickup.id)).toEqual([1, 2]);
    expect(simulation.getState().pickups[0].zOffset).toBe(1);
    expect(simulation.getState().gates[0].hp).toBe(0);
    expect(simulation.getState().gates[1].hp).toBe(9);
  });

  it('lets projectiles pass through an active generator; missed plaques grant nothing', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    setProjectiles(simulation, [{ ...rifle(2, -1), speed: 4 }]);
    step(simulation, 2);
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().projectiles.map((projectile) => projectile.id)).toContain(2);
    expect(simulation.getState().weapons.nextProjectileId).toBe(3);
    step(simulation, 1);
    expect(simulation.getState().pickups.map((pickup) => pickup.id)).toEqual([2, 3]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('restores timer, pickup IDs, and positions for deterministic future emissions', () => {
    const first = create();
    setProjectiles(first, [rifle(1, -1, 6)]);
    step(first);
    step(first, 0.75);
    const second = create();
    second.restoreState(JSON.parse(JSON.stringify(first.getState())) as SimulationState);
    step(first, 1.25);
    step(second, 1.25);
    expect(second.getState()).toEqual(first.getState());
    expect(first.getState().pickups.map((pickup) => pickup.id)).toEqual([1, 2]);
    expect(first.getState().nextPickupId).toBe(3);
    const exposed = first.getState();
    exposed.pickups[0].x = 999;
    expect(first.getState().pickups[0].x).toBe(-1);
  });

  it('emits at the one-second boundary with 60 Hz fixed steps', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    for (let tick = 0; tick < 60; tick++) step(simulation, 1 / 60);
    expect(simulation.getState().pickups).toHaveLength(1);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('collects only a horizontal crossing and lets the new rifle fire next step', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [pickup(1)];
    state.nextPickupId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 10;
    simulation.restoreState(state);
    simulation.step(1, { targetX: -2 }, { ...tuning, moveSpeed: 2 });
    expect(simulation.getState().pickups).toEqual([]);
    expect(simulation.getState().squad).toEqual({ count: 2, rocketCount: 0 });
    expect(simulation.getState().weapons.nextProjectileId).toBe(1);
    const afterCollection = simulation.getState();
    afterCollection.weapons.rifleCooldownRemainingSeconds = 0;
    simulation.restoreState(afterCollection);
    step(simulation, 0.1);
    expect(simulation.getState().weapons.nextProjectileId).toBe(3);
  });

  it('moves an uncollected plaque by its captured relative speed', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [pickup(1, 5)];
    state.nextPickupId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 10;
    simulation.restoreState(state);
    step(simulation, 0.25);
    expect(simulation.getState().pickups[0].zOffset).toBe(4);
    expect(simulation.getState().pickups[0].dropSpeed).toBe(4);
  });

  it('does not collide projectiles or rocket splash with pickups', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [pickup(1, 5)];
    state.nextPickupId = 2;
    simulation.restoreState(state);
    setProjectiles(simulation, [rocket(1, -1)], [grunt(1, -1, 4)]);
    step(simulation, 0.5);
    expect(simulation.getState().enemies).toEqual([]);
    expect(simulation.getState().pickups).toMatchObject([{ id: 1, zOffset: 3 }]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('removes missed fast pickups and resolves multiple crossings in ID order', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [pickup(2, 1), { ...pickup(1, 1), x: 1 }];
    state.nextPickupId = 3;
    state.weapons.rifleCooldownRemainingSeconds = 10;
    simulation.restoreState(state);
    simulation.step(1, { targetX: -1 }, { ...tuning, moveSpeed: 4 });
    expect(simulation.getState().pickups).toEqual([]);
    expect(simulation.getState().squad.count).toBe(2);
    expect(simulation.getState().nextPickupId).toBe(3);
  });

  it('catches up emissions during a large step without skipping IDs', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    step(simulation, 3.25);
    expect(simulation.getState().nextPickupId).toBe(4);
    expect(simulation.getState().pickups.map((item) => [item.id, item.zOffset])).toEqual([[3, 4]]);
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('rejects invalid pickup restore transactionally', () => {
    const simulation = create();
    const state = simulation.getState();
    state.pickups = [pickup(1)];
    state.nextPickupId = 2;
    simulation.restoreState(state);
    const before = simulation.getState();
    for (const corrupt of [
      (s: SimulationState) => { s.pickups.push({ ...pickup(1) }); },
      (s: SimulationState) => { s.pickups[0].dropSpeed = 0; },
      (s: SimulationState) => { s.pickups[0].zOffset = -1; },
      (s: SimulationState) => { s.nextPickupId = 1; },
      (s: SimulationState) => { Object.assign(s.pickups[0], { extra: true }); },
    ]) {
      const invalid = structuredClone(before);
      corrupt(invalid);
      expect(() => simulation.restoreState(invalid)).toThrow();
      expect(simulation.getState()).toEqual(before);
    }
  });

  it('freezes pickup emissions at zero squad and retry resets the wall', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6)]);
    step(simulation);
    const lost = simulation.getState();
    lost.squad.count = 0;
    simulation.restoreState(lost);
    step(simulation, 10);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().pickups).toEqual([]);
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

  it('continues emitting left pickups after the right jackpot pays out', () => {
    const simulation = create();
    setProjectiles(simulation, [rifle(1, -1, 6), rifle(2, 1, 9)]);
    step(simulation);
    expect(simulation.getState().squad.count).toBe(100);
    expect(simulation.getState().gates[0]).toMatchObject({ hp: 0,
      rewardCooldownRemainingSeconds: 1 });
    step(simulation, 2);
    expect(simulation.getState().squad).toEqual({ count: 100, rocketCount: 0 });
    expect(simulation.getState().pickups).toHaveLength(2);
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
    expect(simulation.getState().gates[0]).toHaveProperty('rewardCooldownRemainingSeconds', 1);
    const jackpot = create();
    setProjectiles(jackpot, [rocket(1, 1)]);
    step(jackpot);
    expect(jackpot.getState().squad.count).toBe(100);
    expect(jackpot.getState().gates.map((gate) => gate.hp)).toEqual([6]);
  });

  it('rejects unsafe pickup and instant growth without partially committing', () => {
    for (const mode of ['pickup', 'instant'] as const) {
      const simulation = create();
      const state = simulation.getState();
      const gate = state.gates.find((candidate) => candidate.reward.mode === mode)!;
      gate.reward.amount = Number.MAX_SAFE_INTEGER;
      if (mode === 'pickup') {
        gate.hp = 0;
        if (gate.reward.mode !== 'pickup') throw new Error('expected pickup gate');
        gate.rewardCooldownRemainingSeconds = 1;
        state.pickups = [{ ...pickup(1), x: 0, rewardAmount: Number.MAX_SAFE_INTEGER }];
        state.nextPickupId = 2;
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
