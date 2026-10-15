import type { SimulationOptions, Simulation } from '../simulation/Simulation';
import { createAirSupportPlaytest } from './TankPlaytest';
import { effectivePrimaryFireRate, progressionStage } from '../simulation/progression';
import { supportBossHpThreshold } from '../simulation/commanderSupport';
import { tankPhase } from '../simulation/defenseTank';
import { attackLanePositions } from '../simulation/enemies/laneComposition';

export const AIR_SUPPORT_THRESHOLD_COUNTS = [2, 3, 4, 5] as const;
export type AirSupportThresholdFixture = `air-threshold-${typeof AIR_SUPPORT_THRESHOLD_COUNTS[number]}`;

// DEV review only: ordinary gunfire must cross the new policy's threshold.
export function createAirSupportThresholdReview(options: SimulationOptions, rate: number,
  role: AirSupportThresholdFixture): Simulation {
  const count = Number(role.at(-1)), level = count + 7, balance = options.catharsis?.balance;
  if (!AIR_SUPPORT_THRESHOLD_COUNTS.some(n => n === count) || !balance?.commanderSupport
    || balance.commanderSupport.heavyRaid?.lastStand?.triggerPolicy !== 'bossHpBySquad'
    || progressionStage(level, balance.progression).weaponFamily !== 'machineGun'
    || progressionStage(level, balance.progression).squadStage !== count)
    throw Error('Air threshold review requires the authored MG stages and dynamic policy');
  const threshold = supportBossHpThreshold(balance.commanderSupport, count)!;
  const sim = createAirSupportPlaytest(options, rate), s = sim.getState(), c = balance.defenseTank!;
  s.progression = { level, xp: 0 };
  s.squad = { count, rifleCounts: [count], rifleRemainder: 0, rocketCount: 0 };
  s.defenseTank!.hp = threshold + 20; s.defenseTank!.phase = tankPhase(threshold + 20, c);
  if (s.defenseTank!.phase !== 3) throw Error('Air threshold review must start in Phase 3');
  const lanes = attackLanePositions(balance.laneCount, options.catharsis!.trackHalfWidth, balance.edgeInset);
  s.player.x = lanes[2]; s.player.selectedLane = 2;
  const interval = 1 / effectivePrimaryFireRate(rate, level, balance);
  s.weapons.rifleCooldownRemainingSeconds = 0;
  s.weapons.rifleMemberCooldowns = Array.from({ length: count }, (_, i) => i * interval / count);
  s.enemies = []; s.enemyStream!.nextEnemyId = 1;
  // Representative outer flanks leave the armor shooting corridor open.
  for (const lane of [0,4]) for (let i = 0; i < 4; i++) {
    const archetype = i < 2 ? 'heavy' : 'grunt';
    s.enemies.push({ id: s.enemyStream!.nextEnemyId++, tier: 1, lane, archetype, x: lanes[lane], z: 28 + i * 2,
      hp: archetype === 'heavy' ? balance.heavyHp : 1,
      ...(archetype === 'heavy' ? { bossFlankSpeedUnitsPerSecond: c.phases[2].heavySpeedUnitsPerSecond } : {}) });
  }
  sim.restoreState(s); return sim;
}
