import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { grantXp } from '../src/simulation/progression';
import { pilotTuning } from '../scripts/qa/p15Pilot';

const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = (stream = false) => new Simulation({ seed: 17, startSquad: 1, startRocketCount: 0,
  tiers: config.tiers, catharsis: { balance, trackHalfWidth: config.track.halfWidth },
  level: stream ? LevelDefinitionSchema.parse(levelData) : { id: 'mg-progression', length: 1000, enemyGroups: [], upgradeGates: [] } });
const ticks = (sim: Simulation, count = 1) => {
  for (let i = 0; i < count; i++) sim.step(1 / 60, { targetX: 0 }, pilotTuning);
};
function atLevel(level: number, stream = false, living = level < 6 ? 3 : level - 5) {
  const sim = make(stream), state = sim.getState();
  state.progression = { level, xp: 0 };
  state.squad = { count: living, rifleCounts: [living], rocketCount: 0, rifleRemainder: 0 };
  state.weapons.rifleCooldownRemainingSeconds = .05;
  state.weapons.rifleMemberCooldowns = Array.from({ length: living }, (_, i) => .05 + i / (18 * living));
  state.enemies = [];
  sim.restoreState(state);
  return sim;
}
function killReward(sim: Simulation, xp: number) {
  const state = sim.getState();
  state.catharsis!.balance.progression.gruntKillXp = xp;
  const id = state.enemyStream ? state.enemyStream.nextEnemyId++ : 1;
  state.enemies = [{ id, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: state.player.z + 3, hp: 1 }];
  state.projectiles = [{ id: state.weapons.nextProjectileId++, kind: state.progression!.level >= 6 ? 'machineGun' : 'rifle',
    tier: 1, memberIndex: 0, lane: 2, slopeX: 0, x: 0, z: state.player.z + 2.5, speed: 60,
    damage: config.tiers.tier1Power, remainingRange: 80, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 }];
  sim.restoreState(state); ticks(sim);
}

it.each([[5, 220, 6, 1], [6, 200, 7, 2], [7, 300, 8, 3]])(
  'earns the exact Lv%i boundary with %i XP into Lv%i / %i MG members', (level, xp, next, count) => {
    const sim = atLevel(level);
    killReward(sim, xp - 1); expect(sim.getState().progression).toEqual({ level, xp: xp - 1 });
    killReward(sim, 1);
    const state = sim.getState();
    expect(state.progression).toEqual({ level: next, xp: 0 });
    expect(state.squad).toEqual({ count, rifleCounts: [count], rocketCount: 0, rifleRemainder: 0 });
    expect(state.weapons.rifleMemberCooldowns).toHaveLength(count);
    expect(new Set(state.weapons.rifleMemberCooldowns).size).toBe(count);
    expect(sim.consumePresentationEvents()).toEqual([]);
    ticks(sim, 1200);
    expect(sim.getState().squad.count).toBe(count);
    expect(sim.getState().reinforcement).toEqual({ startedAtSeconds: null, arrived: false });
    expect(sim.getState().landingAssault!.startedAtSeconds).toBeNull();
  });

it.each([6, 7, 8])('fires 18 Hz independently per Lv%i member on the selected lane', level => {
  const sim = atLevel(level), count = level - 5;
  ticks(sim, 60);
  let nextId = sim.getState().weapons.nextProjectileId;
  const shots = Array.from({ length: count }, () => [] as number[]);
  for (let tick = 0; tick < 600; tick++) {
    if (tick === 150 || tick === 300) sim.stepLane(1);
    ticks(sim);
    const frame = sim.getFrameState();
    for (const shot of frame.projectiles.filter(p => p.id >= nextId)) {
      expect(shot).toMatchObject({ kind: 'machineGun', lane: frame.player.selectedLane,
        speed: 60, damage: config.tiers.tier1Power, blastRadius: 0, penetrationRemaining: 0, hitRadiusBonus: 0 });
      shots[shot.memberIndex!].push(tick);
    }
    nextId = frame.weapons.nextProjectileId;
  }
  expect(shots.map(member => member.length)).toEqual(Array(count).fill(180));
  expect(shots.flat()).toHaveLength(count * 180);
  if (count > 1) expect(shots[0]).not.toEqual(shots[1]);
});

it.each([[421, 7, 1, 2], [900, 8, 0, 3]])(
  'preserves one exact 60-enemy release when %i XP skips Lv6', (xp, level, overflow, count) => {
    const sim = atLevel(5, true); killReward(sim, xp);
    const state = sim.getState();
    expect(state.progression).toEqual({ level, xp: overflow });
    expect(state.squad.count).toBe(count);
    expect(state.enemies).toHaveLength(60);
    expect(state.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(1);
    expect(new Set(state.enemies.map(e => e.lane)).size).toBe(3);
    expect(state.machineGunReleaseAtSeconds).toBe(state.elapsedSeconds);
    expect(state.postCapSurvival!.startedAtSeconds).toBeNull();
    expect(state.carnival).toMatchObject({ status: 'active', startedAtSeconds: state.elapsedSeconds });
    const nextId = state.enemyStream!.nextEnemyId;
    const clone = make(true); clone.restoreState(JSON.parse(JSON.stringify(state)));
    ticks(sim, 180); ticks(clone, 180);
    expect(sim.getState()).toEqual(clone.getState());
    expect(sim.getState().machineGunReleaseAtSeconds).toBe(state.machineGunReleaseAtSeconds);
    const admitted = sim.getState().enemyStream!.nextEnemyId - nextId;
    expect(admitted).toBeGreaterThan(0);expect(admitted).toBeLessThanOrEqual(balance.carnival.groupSize);
    expect(sim.getState().enemies.length).toBeLessThanOrEqual(balance.carnival.activeEnemyLimit);
    expect(sim.getState().carnival!.nextWaveIndex).toBe(1);
    expect(sim.getState().landingAssault!.reinforcementActiveAtSeconds).toBeNull();
  });

it('retains XP overflow through Lv7 and discards it only at Lv8', () => {
  expect(grantXp({ level: 6, xp: 199 }, 10, balance.progression)).toEqual({ level: 7, xp: 9 });
  expect(grantXp({ level: 7, xp: 299 }, 120, balance.progression)).toEqual({ level: 8, xp: 0 });
  const sim = atLevel(8); killReward(sim, 120);
  expect(sim.getState().progression).toEqual({ level: 8, xp: 0 });
  expect(sim.getState().squad.count).toBe(3);
});

it('loses MG members without changing their family, restores survivor clocks, and grants only the next reward delta', () => {
  const sim = atLevel(7), state = sim.getState();
  state.weapons.rifleCooldownRemainingSeconds = .04;
  state.weapons.rifleMemberCooldowns = [.04, .05];
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -2.8, z: -2, hp: 1 }];
  sim.restoreState(state); ticks(sim);
  const damaged = sim.getState();
  expect(damaged.squad.count).toBe(1);
  expect(damaged.weapons.rifleMemberCooldowns).toEqual([.05 - 1 / 60]);
  expect(damaged.weapons.rifleCooldownRemainingSeconds).toBe(.05 - 1 / 60);
  const clone = make(); clone.restoreState(JSON.parse(JSON.stringify(damaged)));
  ticks(sim, 60); ticks(clone, 60); expect(sim.getState()).toEqual(clone.getState());
  expect(sim.getState().projectiles.every(p => p.kind === 'machineGun')).toBe(true);
  killReward(sim, 300); expect(sim.getState().squad.count).toBe(2);
  expect(sim.getState().progression!.level).toBe(8);
  const fatal = sim.getState(); fatal.projectiles = [];
  fatal.enemies = [1, 2].map(id => ({ id, tier: 1, archetype: 'grunt' as const, lane: 0, x: -2.8, z: -2, hp: 1 }));
  sim.restoreState(fatal); ticks(sim);
  expect(sim.getState().squad.count).toBe(0);
  expect(sim.getState().weapons.rifleMemberCooldowns).toEqual([]);
  clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  const dead = clone.getState(); ticks(clone, 60); expect(clone.getState()).toEqual(dead);
  const retry = make().getState();
  expect(retry.progression).toEqual({ level: 1, xp: 0 });
  expect(retry.squad.count).toBe(1); expect(retry.machineGunReleaseAtSeconds).toBeNull();
});

it.each([6, 7, 8])('round-trips Lv%i and rejects excess members, invalid stages and clocks', level => {
  const sim = atLevel(level); ticks(sim, 17);
  const snapshot = sim.getState(), clone = make(); clone.restoreState(JSON.parse(JSON.stringify(snapshot)));
  ticks(sim, 120); ticks(clone, 120); expect(sim.getState()).toEqual(clone.getState());
  const bad = structuredClone(snapshot); bad.squad.count++; bad.squad.rifleCounts[0]++;
  bad.weapons.rifleMemberCooldowns!.push(0); expect(() => clone.restoreState(bad)).toThrow(/Machine Gun/);
  const clock = structuredClone(snapshot); clock.weapons.rifleMemberCooldowns!.pop();
  expect(() => clone.restoreState(clock)).toThrow(/clocks/);
});

it('restores accepted six-level snapshots with their original cap, future stream, and consumed release migration', () => {
  const sim = atLevel(6, true), state = sim.getState();
  state.catharsis!.balance.progression.levelPlan = state.catharsis!.balance.progression.levelPlan.slice(0, 6);
  state.catharsis!.balance.progression.xpRequirements = state.catharsis!.balance.progression.xpRequirements.slice(0, 5);
  delete state.machineGunReleaseAtSeconds;
  sim.restoreState(JSON.parse(JSON.stringify(state)));
  expect(sim.getState().machineGunReleaseAtSeconds).toBe(0);
  killReward(sim, 1000);
  expect(sim.getState().progression).toEqual({ level: 6, xp: 0 });
  expect(sim.getState().squad.count).toBe(1);
  const clone = make(true); clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  ticks(sim, 600); ticks(clone, 600); expect(sim.getState()).toEqual(clone.getState());
  expect(sim.getState().reinforcement!.arrived).toBe(false);
});

it('keeps live threshold edits coherent when they cross MG squad boundaries', () => {
  const sim = atLevel(5), state = sim.getState(); state.progression!.xp = 219; sim.restoreState(state);
  sim.setCatharsisBalance({ ...balance, progression: { ...balance.progression, xpRequirements: [28, 60, 110, 180, 10, 10, 300] } });
  expect(sim.getState().progression).toEqual({ level: 7, xp: 199 });
  expect(sim.getState().squad.count).toBe(2);
  sim.setCatharsisBalance({ ...balance, progression: { ...balance.progression, xpRequirements: [28, 60, 110, 180, 10, 10, 100] } });
  expect(sim.getState().squad.count).toBe(3);
  expect(sim.getState().weapons.rifleMemberCooldowns).toHaveLength(3);
  expect(() => sim.restoreState(JSON.parse(JSON.stringify(sim.getState())))).not.toThrow();
});
