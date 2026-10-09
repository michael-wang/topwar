import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture, type DevReviewFixture } from '../src/app/DevReviewFixtures';
import { pilotTuning } from '../scripts/qa/p15Pilot';

const config = GameConfigSchema.parse(gameData);
const options = { seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1, startRocketCount: 0,
  tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
const make = (role: DevReviewFixture) => createDevReviewFixture(options, config.weapon.rifle.fireRate, role);
const entries = [['late', 6, 1], ['mg7', 7, 2], ['mg8', 8, 3]] as const;

it.each(entries)('%s starts at Lv%i with %i MG members and a valid deterministic playable state', (role, level, count) => {
  const sim = make(role), state = sim.getState();
  expect(state.progression).toEqual({ level, xp: 0 });
  expect(state.squad).toEqual({ count, rifleCounts: [count], rocketCount: 0, rifleRemainder: 0 });
  expect(state.weapons.rifleMemberCooldowns).toEqual(Array.from({ length: count }, (_, i) => i / (18 * count)));
  expect(state.player.selectedLane).toBe(2);
  expect(state.machineGunReleaseAtSeconds).toBe(0);
  expect(state.giantEncounter).toEqual({ scheduledAtSeconds: 0, spawned: true });
  expect(state.grenade).toMatchObject({ inventory: 3, acquiredAtSeconds: 0, supply: null, flight: null });
  expect(state.postCapSurvival).toEqual({ startedAtSeconds: 0, nextGiantAtSeconds: 24, nextGrenadeSupplyAtSeconds: 30 });
  expect(state.enemies).toHaveLength(3);
  expect(state.enemies.every(e => e.archetype === 'heavy' && e.hp === 15)).toBe(true);
  expect(state.enemyStream!.nextRowIndex).toBeLessThan(100);
  expect(state.reinforcement).toEqual({ startedAtSeconds: null, arrived: false });
  expect(state.landingAssault!.reinforcementActiveAtSeconds).toBeNull();
  const clone = make(role); clone.restoreState(JSON.parse(JSON.stringify(state)));
  expect(clone.getState()).toEqual(state);
  expect(createDevReviewFixture({ ...options, seed: 42 }, 3, role).getState()).toEqual(state);
});

it.each(entries)('%s preserves independent 18 Hz firing for its %i level / %i members', (role, _level, count) => {
  const sim = make(role);
  for (let i = 0; i < 60; i++) sim.step(1 / 60, { targetX: 0 }, pilotTuning);
  let nextId = sim.getFrameState().weapons.nextProjectileId;
  const shots = Array(count).fill(0) as number[];
  for (let i = 0; i < 600; i++) {
    sim.step(1 / 60, { targetX: 0 }, pilotTuning);
    const state = sim.getFrameState();
    for (const shot of state.projectiles.filter(p => p.id >= nextId)) {
      expect(shot.kind).toBe('machineGun'); expect(shot.lane).toBe(state.player.selectedLane);
      shots[shot.memberIndex!]++;
    }
    nextId = state.weapons.nextProjectileId;
  }
  expect(shots).toEqual(Array(count).fill(180));
});

it.each(entries)('%s runs normal waves, progression, Giants and recurring Supplies with snapshot replay', (role, initialLevel) => {
  const sim = make(role), initial = sim.getState(), clone = make(role);
  const milestones = new Set<number>([initialLevel]);
  let ordinaryGroups = 0, giants = 0, supplies = 0, acquisitions = 0, detonations = 0;
  for (let tick = 0; tick < 60 * 150; tick++) {
    const before = sim.getFrameState();
    if (tick % 12 === 0) {
      const nearest = [...before.enemies].sort((a, b) => a.z - b.z || a.id - b.id)[0];
      const giant = before.enemies.find(e => e.archetype === 'giant');
      const threat = giant && (!nearest || nearest.z - before.player.z > 10) ? giant : nearest;
      const lane = before.grenade!.supply?.lane ?? threat?.lane ?? before.player.selectedLane!;
      if (lane !== before.player.selectedLane) {
        const direction = lane < before.player.selectedLane! ? -1 : 1;
        sim.stepLane(direction); clone.stepLane(direction);
      }
    }
    const nextEnemyId = before.enemyStream!.nextEnemyId;
    const supplyWasPresent = !!before.grenade!.supply;
    const input = { targetX: 0, throwGrenade: tick % 600 === 0 };
    sim.step(1 / 60, input, pilotTuning); clone.step(1 / 60, input, pilotTuning);
    const after = sim.getFrameState(); milestones.add(after.progression!.level);
    const admitted = after.enemies.filter(e => e.id >= nextEnemyId);
    const ordinary = admitted.filter(e => e.archetype !== 'giant');
    if (ordinary.length) {
      ordinaryGroups++;
      expect(ordinary).toHaveLength(3); // A replayed 60-person release fails here.
      expect(ordinary.every(e => e.archetype === 'heavy')).toBe(true);
    }
    giants += admitted.filter(e => e.archetype === 'giant').length;
    if (!supplyWasPresent && after.grenade!.supply) {
      supplies++; expect(after.grenade!.supply.rewardAmount).toBe(1);
    }
    for (const event of sim.consumeGrenadeEvents()) {
      if (event.kind === 'grenadeAcquired') acquisitions++;
      else detonations++;
    }
    clone.consumeGrenadeEvents(); sim.consumePresentationEvents(); clone.consumePresentationEvents();
    expect(after.machineGunReleaseAtSeconds).toBe(0);
    expect(after.reinforcement!.startedAtSeconds).toBeNull();
    expect(after.landingAssault!.reinforcementActiveAtSeconds).toBeNull();
    if (tick === 60 * 29 || tick === 60 * 31) clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
    if (tick % 60 === 0) expect(clone.getState()).toEqual(sim.getState());
  }
  expect(sim.getState()).toEqual(clone.getState());
  expect([...milestones]).toEqual(initialLevel === 6 ? [6, 7, 8] : initialLevel === 7 ? [7, 8] : [8]);
  expect(sim.getState().squad.count).toBe(3);
  expect(sim.getState().progression).toEqual({ level: 8, xp: 0 });
  expect(ordinaryGroups).toBeGreaterThan(20); expect(giants).toBeGreaterThanOrEqual(3);
  expect(supplies).toBeGreaterThanOrEqual(3); expect(acquisitions).toBeGreaterThanOrEqual(3);
  expect(detonations).toBeGreaterThanOrEqual(3);
  expect(make(role).getState()).toEqual(initial); // Same adapter used by app Retry.
});

it('fails clearly for an incompatible late-game plan instead of entering legacy reinforcement', () => {
  const balance = structuredClone(config.catharsis!);
  balance.progression.levelPlan = balance.progression.levelPlan.slice(0, 6);
  balance.progression.xpRequirements = balance.progression.xpRequirements.slice(0, 5);
  expect(() => createDevReviewFixture({ ...options, catharsis: { ...options.catharsis, balance } }, 3, 'mg7'))
    .toThrow('authored Machine Gun squad stage');
});
