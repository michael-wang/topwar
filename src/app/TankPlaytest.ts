import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { startDefenseTank, tankPhase } from '../simulation/defenseTank';
import { emptyCarnival } from '../simulation/carnival';
import { advanceLevelEncounters, emptyLevelEncounters } from '../simulation/levelEncounters';
import { effectivePrimaryFireRate, progressionStage } from '../simulation/progression';
import { teachingGrenadeGrant } from '../config/grenadeConfig';
import { admitDefenseGroup } from '../simulation/enemies/defenseGroup';
import { effectiveSeed } from '../simulation/enemies/effectiveSeed';
import { pressureWaveSettings } from '../simulation/enemies/latePressure';
import { postCapOrdinarySettings } from '../simulation/postCapSurvival';

// Closed-playtest sample results use the real finished Simulation and shipping presentation.
export function createVictoryReview(options: SimulationOptions, rate: number): Simulation {
  const sim = createTankPlaytest(options, rate, false, .02), s = sim.getState();
  s.elapsedSeconds = 216.6; s.tick = Math.round(s.elapsedSeconds * 60);
  Object.assign(s.defenseTank!, { status: 'defeated', entranceCleared: true, hp: 0, phase: 3,
    defeatedAtSeconds: s.elapsedSeconds, nextAttackAtSeconds: null, pendingImpactAtSeconds: null });
  s.enemies = []; s.projectiles = []; s.artillery = { version: 1, nextId: 1, shells: [] };
  s.combatStats = { gruntKills: 65, heavyKills: 234, giantKills: 6,
    shotsFired: 11410, shotsHit: 11024, grenadesUsed: 8 };
  sim.restoreState(s); return sim;
}

// Shared loadouts use shipping configuration and real attack/admission clocks.
export function createTankPlaytest(options: SimulationOptions, rate: number, intro: boolean, hpFraction = 1): Simulation {
  const balance = options.catharsis?.balance;
  if (!balance?.defenseTank || !balance.levelEncounters || !balance.destroyer || !options.level.enemyStream)
    throw Error('Tank playtest requires the authored Defense Tank encounter');
  const soldiers = progressionStage(9, balance.progression).squadStage;
  const sim = new Simulation({ ...options, seed: 17, startSquad: soldiers, startRocketCount: 0 });
  const s = sim.getState(), now = 60, tankConfig = balance.defenseTank;
  s.tick = now * 60; s.elapsedSeconds = now; s.machineGunReleaseAtSeconds = 0;
  s.progression = { level: 9, xp: 0 }; s.player = { x: 0, z: 0, selectedLane: 2 };
  s.carnival = emptyCarnival(true); s.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  s.destroyer = { status: 'complete', startedAtSeconds: 0, nextShotIndex: balance.destroyer.shotTimes.length };
  s.navalPresence = { version: 1, status: 'stationed', enteredAtSeconds: 0, retreatAtSeconds: null, retreatFromX: null };
  s.levelEncounters = advanceLevelEncounters(emptyLevelEncounters(balance.levelEncounters), balance.levelEncounters, now, 9, 0).state;
  s.levelEncounters.ordinaryEnabled = false; s.levelEncounters.survivalEnabled = true;
  s.postCapSurvival = { startedAtSeconds: now,
    nextGiantAtSeconds: now + balance.postCapSurvival.giantIntervalSeconds,
    nextGrenadeSupplyAtSeconds: now + balance.postCapSurvival.grenadeSupplyIntervalSeconds };
  s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: teachingGrenadeGrant(balance.grenade), supply: null, flight: null };
  s.enemies = []; s.projectiles = []; s.enemyStream!.nextEnemyId = 1;
  s.defenseWaves!.nextAtSeconds = now + balance.defenseWaves.intervalSeconds;
  const interval = 1 / effectivePrimaryFireRate(rate, 9, balance);
  s.weapons.rifleCooldownRemainingSeconds = 0;
  s.weapons.rifleMemberCooldowns = Array.from({ length: soldiers }, (_, i) => i * interval / soldiers);
  if (intro) {
    // One advancing Lv8 AHEAD wave, including its central lanes, remains in front of the landing tank.
    admitDefenseGroup(s.enemies, s.enemyStream!, 0, effectiveSeed(s.seed, options.level.enemyStream.seed),
      { ...balance, ...pressureWaveSettings(balance, { level: 8, xp: 245 }),
        ...postCapOrdinarySettings(balance, s.postCapSurvival, 8, 245) }, options.catharsis!.trackHalfWidth, 32);
    s.enemyStream!.nextRowIndex = 1;
  } else {
    s.defenseTank = startDefenseTank(now - tankConfig.entrySeconds, s.seed, tankConfig);
    Object.assign(s.defenseTank, { status: 'active', z: tankConfig.battleZ,
      hp: tankConfig.hp * hpFraction, phase: tankPhase(tankConfig.hp * hpFraction, tankConfig) });
  }
  sim.restoreState(s);
  return sim;
}
