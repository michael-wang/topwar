import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { effectivePrimaryFireRate, progressionStage } from '../src/simulation/progression';
import { pilotTuning } from '../scripts/qa/p15Pilot';

const config = GameConfigSchema.parse(gameData);
const options = { seed: 19, level: LevelDefinitionSchema.parse(levelData),
  startSquad: config.player.startSquad, startRocketCount: config.player.startRocketCount,
  tiers: config.tiers, catharsis: { trackHalfWidth: config.track.halfWidth, balance: config.catharsis! } };
const make = (role: 'crate3' | 'crate8') => createDevReviewFixture(options, config.weapon.rifle.fireRate, role);
const step = (sim: ReturnType<typeof make>, ticks = 1) => {
  for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, pilotTuning);
};

it.each(['crate3', 'crate8'] as const)('%s starts an intact, aligned real Supply and isolated authoritative loadout', role => {
  const initial = make(role).getState(), recurring = role === 'crate8', members = recurring ? 3 : 1;
  expect(initial.progression).toEqual({ level: recurring ? 8 : 3, xp: 0 });
  expect(initial.squad).toMatchObject({ count: members, rifleCounts: [members], rocketCount: 0 });
  const stage = progressionStage(initial.progression!.level, initial.catharsis!.balance.progression);
  expect(stage.weaponFamily).toBe(recurring ? 'machineGun' : 'rifle');
  expect(effectivePrimaryFireRate(config.weapon.rifle.fireRate, initial.progression!.level, initial.catharsis!.balance)).toBe(recurring ? 18 : 4.5);
  expect(initial.weapons.rifleMemberCooldowns).toHaveLength(members);
  expect(new Set(initial.weapons.rifleMemberCooldowns).size).toBe(members);
  expect(initial.enemies).toEqual([]); expect(initial.enemyStream).toBeNull(); expect(initial.defenseWaves).toBeUndefined();
  expect(initial.catharsis!.balance.postCapSurvival.enabled).toBe(false);
  expect(initial.catharsis!.balance.carnival.enabled).toBe(false);
  expect(initial.grenade).toMatchObject({ inventory: recurring ? 1 : 0, supplySpawnedAtSeconds: 0,
    acquiredAtSeconds: recurring ? 0 : null, flight: null, supply: {
      lane: initial.player.selectedLane, x: initial.player.x,
      destruction: { mode: 'staged', stage: 0, recoverySeconds: .7, recoverAtSeconds: 0 } } });
  expect(initial.grenade!.supply!.depth).toBeLessThan(config.weapon.rifle.range);
  expect(initial.grenade!.supply!.rewardAmount).toBe(recurring ? 1 : undefined);
  expect(make(role).getState()).toEqual(initial);
  expect(createDevReviewFixture({ ...options, seed: 42 }, config.weapon.rifle.fireRate, role).getState()).toEqual(initial);
});

it.each(['crate3', 'crate8'] as const)('%s uses three real damage events with recovery, restores partial damage and never refills', role => {
  const sim = make(role), initial = sim.getState(), times: number[] = [], events: string[] = [];
  let clone: ReturnType<typeof make> | undefined;
  for (let tick = 0; tick < 360; tick++) {
    step(sim); if (clone) step(clone);
    if (clone) expect(clone.getState()).toEqual(sim.getState());
    const state = sim.getState(), emitted = sim.consumeGrenadeEvents();
    if (clone) expect(clone.consumeGrenadeEvents()).toEqual(emitted);
    for (const event of emitted) {
      events.push(event.kind); times.push(state.elapsedSeconds);
      if (event.kind === 'grenadeSupplyDamaged') {
        expect(state.grenade!.supply!.destruction!.stage).toBe(times.length);
        expect(state.grenade!.supply!.destruction!.recoverAtSeconds).toBeCloseTo(state.elapsedSeconds + .7, 10);
      } else expect(event).toMatchObject({ kind: 'grenadeSupplyOpened', amount: role === 'crate3' ? 3 : 1 });
    }
    // Snapshot midway through the first recovery, not at an event boundary.
    if (!clone && times.length === 1 && state.elapsedSeconds > times[0] + .2) {
      clone = make(role); clone.restoreState(JSON.parse(JSON.stringify(state)));
      expect(clone.consumeGrenadeEvents()).toEqual([]);
    }
  }
  expect(events).toEqual(['grenadeSupplyDamaged', 'grenadeSupplyDamaged', 'grenadeSupplyOpened']);
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(.7 - 1e-8);
  expect(times[2] - times[1]).toBeGreaterThanOrEqual(.7 - 1e-8);
  expect(times[2] - times[0]).toBeLessThanOrEqual(2);
  expect(sim.getState().grenade!.inventory).toBe(role === 'crate3' ? 3 : 2);
  const shots = sim.getState().weapons.nextProjectileId - initial.weapons.nextProjectileId;
  const nominal = (role === 'crate3' ? 4.5 : 54) * 6;
  expect(shots).toBeGreaterThanOrEqual(nominal); expect(shots).toBeLessThanOrEqual(nominal + (role === 'crate3' ? 1 : 3));
  expect(new Set(sim.getState().projectiles.map(p => p.memberIndex)).size).toBe(role === 'crate3' ? 1 : 3);
  const later = sim.getState(); later.elapsedSeconds = 1200; later.tick = 72000;
  sim.restoreState(later); step(sim, 180);
  expect(sim.getState().enemies).toEqual([]); expect(sim.getState().grenade!.supply).toBeNull();
  expect(sim.getState().progression).toEqual(initial.progression); expect(sim.consumeGrenadeEvents()).toEqual([]);
  expect(make(role).getState()).toEqual(initial);
});
