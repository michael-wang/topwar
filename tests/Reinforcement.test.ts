import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation } from '../src/simulation/Simulation';
import { effectiveRifleFireRate, requiredXp } from '../src/simulation/progression';
import { createDefenseSquadFormation } from '../src/simulation/squad/formation';
import { projectRenderState } from '../src/app/projectRenderState';
import { reinforcementArrivalPose } from '../src/presentation/ReinforcementArrival';
const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = (seed = 17) => new Simulation({ seed, level: { id: 'reinforcement', length: 1000, enemyGroups: [], upgradeGates: [] },
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: .6, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: config.weapon.rifle, rocket: config.weapon.rocket };
const step = (sim: Simulation, ticks: number) => { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning); };
function twoSoldiers(seed = 17): Simulation {
  const sim = make(seed), state = sim.getState();
  state.progression = { level: 7, xp: 0 };
  state.reinforcement = { startedAtSeconds: 0, arrived: true };
  state.squad = { ...state.squad, count: 2, rifleCounts: [2] };
  state.weapons.rifleMemberCooldowns = [0, .5 / 6.9];
  sim.restoreState(state); return sim;
}
it('holds LV7 per-soldier rate at LV6, then resumes taper without changing thresholds or enemies', () => {
  expect([1,2,3,4,5,6,7,8,9].map(level => effectiveRifleFireRate(3, level, balance.progression)))
    .toEqual([3,4,5,6,6.5,6.9,6.9,7.22,7.476]);
  expect(effectiveRifleFireRate(2.5, 7, balance.progression)).toBe(6.4);
  expect(requiredXp(6, balance.progression)).toBe(420);
  expect(balance.giant.hp).toBe(172); expect(balance.giant.xp).toBe(120);
  expect(balance.heavyHp).toBe(15); expect(balance.pressureMultipliers).toEqual([1,1,1,1,1.25,1.35,1.45,1.55,1.6,1.65]);
});
it('grants one soldier after the nonblocking arrival, survives snapshots and never grants twice', () => {
  const sim = make(), state = sim.getState(); state.progression = { level: 6, xp: 419 };
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 3, hp: 1 }];
  sim.restoreState(state); step(sim, 4);
  expect(sim.getState().progression).toEqual({ level: 7, xp: 0 });
  expect(sim.getState().squad.count).toBe(1); expect(sim.getState().reinforcement!.startedAtSeconds).not.toBeNull();
  step(sim, 30); const pending = sim.getState(), clone = make(); clone.restoreState(JSON.parse(JSON.stringify(pending)));
  expect(pending.elapsedSeconds).toBeGreaterThan(.5);
  step(sim, 60); step(clone, 60); expect(sim.getState()).toEqual(clone.getState());
  expect(sim.getState().squad.rifleCounts).toEqual([2]); expect(sim.getState().reinforcement!.arrived).toBe(true);
  step(sim, 1000); expect(sim.getState().squad.count).toBe(2);
  const retry = make().getState(); expect(retry.progression).toEqual({ level: 1, xp: 0 });
  expect(retry.reinforcement).toEqual({ startedAtSeconds: null, arrived: false }); expect(retry.squad.count).toBe(1);
});
it('fires identical damage at twice the rate in alternating half-interval phases on one selected lane', () => {
  const sim = twoSoldiers(), shots: { member: number; time: number; lane: number }[] = [];
  let nextId = 1;
  for (let tick = 0; tick < 600; tick++) {
    if (tick === 150 || tick === 300) sim.stepLane(1);
    step(sim, 1); const state = sim.getFrameState();
    for (const shot of state.projectiles.filter(s => s.id >= nextId)) {
      expect(shot.damage).toBe(config.tiers.tier1Power); expect(shot.lane).toBe(state.player.selectedLane);
      shots.push({ member: shot.memberIndex!, time: state.elapsedSeconds, lane: shot.lane! });
    }
    nextId = state.weapons.nextProjectileId;
  }
  expect(shots.filter(s => s.member === 0)).toHaveLength(69);
  expect(shots.filter(s => s.member === 1)).toHaveLength(69);
  for (let i = 1; i < shots.length; i++) {
    expect(shots[i].member).not.toBe(shots[i - 1].member);
    expect(shots[i].time - shots[i - 1].time).toBeCloseTo(.5 / 6.9, 1);
  }
  const saved = sim.getState(), clone = twoSoldiers(); clone.restoreState(JSON.parse(JSON.stringify(saved)));
  saved.weapons.rifleMemberCooldowns![0] = 10;
  step(sim, 120); step(clone, 120); expect(sim.getState()).toEqual(clone.getState());
  const bad = sim.getState(); bad.weapons.rifleMemberCooldowns = [0]; expect(() => sim.restoreState(bad)).toThrow(/clocks/);
});
it.each([1,17,42])('kills the same authored Giant in 12–13 seconds at LV7 (seed %i)', seed => {
  const sim = twoSoldiers(seed), state = sim.getState(); state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 38, hp: balance.giant.hp }];
  sim.restoreState(state); let firstHit: number | undefined;
  while (sim.getFrameState().enemies.length && sim.getFrameState().elapsedSeconds < 25) {
    step(sim, 1); const frame = sim.getFrameState();
    if (firstHit === undefined && frame.enemies[0]?.hp < balance.giant.hp) firstHit = frame.elapsedSeconds;
  }
  const result = sim.getState(); expect(result.squad.count).toBe(2); expect(result.progression).toEqual({ level: 7, xp: 120 });
  expect(result.elapsedSeconds - firstHit!).toBeGreaterThanOrEqual(12);
  expect(result.elapsedSeconds - firstHit!).toBeLessThanOrEqual(13);
});
it('projects the pending entrance from simulation time and settles both members within one corridor', () => {
  const sim = make(), state = sim.getState(); state.progression = { level: 7, xp: 0 };
  state.elapsedSeconds = .55; state.reinforcement = { startedAtSeconds: 0, arrived: false };
  sim.restoreState(state);
  const view = projectRenderState(sim.getFrameState(), { catharsis: state.catharsis, formationSpacing: .45,
    trackHalfWidth: 3.2, defenseLineOffset: 1.5, bossVisualScale: 7 });
  expect(view.squad.reinforcement!.progress).toBe(.5);
  const pose = reinforcementArrivalPose(.5); expect(pose.backOffset).toBeLessThan(0); expect(pose.weaponLower).toBeGreaterThan(0);
  expect(reinforcementArrivalPose(1)).toEqual({ backOffset: -0, sideOffset: 0, bob: 0, lean: 0, weaponLower: 0 });
  const pair = createDefenseSquadFormation(2, .45, balance.progression);
  expect(pair[1].x - pair[0].x).toBe(.72); expect(pair.every(p => Math.abs(p.x) < .7)).toBe(true);
  const invalid = sim.getState(); invalid.reinforcement!.startedAtSeconds = 100;
  expect(() => sim.restoreState(invalid)).toThrow(/reinforcement/);
});



it('a Giant reward can cross into LV7 with truthful overflow, but never awards twice', () => {
  const sim = make(), state = sim.getState(); state.progression = { level: 6, xp: 350 };
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 3, hp: 1 }];
  sim.restoreState(state); step(sim, 4);
  expect(sim.getState().progression).toEqual({ level: 7, xp: 50 });
  expect(sim.getState().reinforcement!.arrived).toBe(false); expect(sim.getState().squad.count).toBe(1);
  step(sim, 120); expect(sim.getState().progression).toEqual({ level: 7, xp: 50 });
  expect(sim.getState().squad.rifleCounts).toEqual([2]);
});
