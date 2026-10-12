import { teachingGrenadeGrant } from '../config/grenadeConfig';
import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { isolatedReviewOptions } from './DevReviewPolicy';
import { emptyCarnival } from '../simulation/carnival';
import { emptyDestroyer } from '../simulation/destroyer';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { effectivePrimaryFireRate, maxProgressionLevel, progressionStage } from '../simulation/progression';

// Temporary human comparison presets. Imported only through the DEV factory.
export const MG_TEST_PRESETS = {
  mg6: { level: 6, weaponStage: 1, soldiers: 1 },
  mg7: { level: 7, weaponStage: 2, soldiers: 1 },
  mg8: { level: 8, weaponStage: 3, soldiers: 1 },
  mg9: { level: 9, weaponStage: 3, soldiers: 2 },
  mg10: { level: 10, weaponStage: 3, soldiers: 3 },
} as const;
export type MachineGunReviewFixture = keyof typeof MG_TEST_PRESETS;

export function createMachineGunReview(options: SimulationOptions, baseFireRate: number,
  role: MachineGunReviewFixture): Simulation {
  options = isolatedReviewOptions(options);
  const preset = MG_TEST_PRESETS[role];
  const sim = new Simulation({ ...options, seed: 0x21b600, startSquad: 1, startRocketCount: 0,
    level: { ...options.level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } });
  const state = sim.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode || preset.level > maxProgressionLevel(balance.progression))
    throw Error('MG TEST requires the authored Defense MG progression');
  const stage = progressionStage(preset.level, balance.progression);
  if (stage.weaponFamily !== 'machineGun' || stage.fireRateStage !== preset.weaponStage
    || stage.squadStage !== preset.soldiers) throw Error('MG TEST preset must match its authored stage');
  // Isolate the same finite crowd in every preset; no independent encounters,
  // admissions or fake projectiles. Ordinary HP, movement, damage and XP apply.
  balance.carnival.enabled = false; state.carnival = emptyCarnival(true);
  balance.postCapSurvival.enabled = false;
  if (balance.destroyer) { balance.destroyer.enabled = false; state.destroyer = emptyDestroyer(true); }
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.machineGunReleaseAtSeconds = 0;
  state.progression = { level: preset.level, xp: 0 };
  state.squad = { count: stage.squadStage, rifleCounts: [stage.squadStage], rifleRemainder: 0, rocketCount: 0 };
  const lanes = attackLanePositions(balance.laneCount, state.catharsis!.trackHalfWidth, balance.edgeInset);
  const center = Math.floor(lanes.length / 2);
  state.player = { x: lanes[center], z: 0, selectedLane: center };
  state.enemies = Array.from({ length: 60 }, (_, index) => {
    const lane = index % lanes.length;
    return { id: index + 1, tier: 1, archetype: 'grunt' as const, lane, x: lanes[lane],
      z: 38 + ((index * 37 + lane * 11) % 81) / 10, hp: 1 };
  });
  for (const [lane, x] of lanes.entries()) state.enemies.push({ id: 61 + lane, tier: 1,
    archetype: 'heavy', lane, x, z: 42 + lane * .8, hp: balance.heavyHp });
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: teachingGrenadeGrant(balance.grenade), supply: null, flight: null };
  const interval = 1 / effectivePrimaryFireRate(baseFireRate, preset.level, balance);
  state.weapons.rifleCooldownRemainingSeconds = 0;
  state.weapons.rifleMemberCooldowns = Array.from({ length: stage.squadStage }, (_, i) => i * interval / stage.squadStage);
  sim.restoreState(state);
  return sim;
}
