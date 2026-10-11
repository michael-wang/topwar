import presets from '../config/survivalExperiment.json';
import { PostCapSurvivalConfigSchema } from '../config/postCapSurvivalConfig';
import type { CatharsisConfig } from '../config/catharsisConfig';
import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { emptyCarnival } from '../simulation/carnival';
import { emptyDestroyer } from '../simulation/destroyer';
import { advancePostCapSurvival, postCapOrdinarySettings } from '../simulation/postCapSurvival';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { admitDefenseGroup } from '../simulation/enemies/defenseGroup';
import { effectiveSeed } from '../simulation/enemies/effectiveSeed';
import { effectivePrimaryFireRate, maxProgressionLevel, progressionStage } from '../simulation/progression';

export type SurvivalReviewMode = 'baseline' | 'experimental' | 'staged' | 'ahead';
export type SurvivalReviewLevel = 7 | 8 | 9 | 10;
export type SurvivalReviewFixture = `survival${SurvivalReviewLevel}-${SurvivalReviewMode}`;

// DEV-only authored comparison data; saved snapshots carry the complete config.
export function survivalReviewConfig(current: CatharsisConfig['postCapSurvival'], mode: SurvivalReviewMode) {
  const { advancedProfile: _advanced, capProfile: _cap, levelProfiles: _profiles, xpLookahead: _ahead, ...shared } = current;
  return PostCapSurvivalConfigSchema.parse({ ...shared, ...presets[mode], enabled: true });
}

export function createSurvivalReview(options: SimulationOptions, baseFireRate: number, role: SurvivalReviewFixture): Simulation {
  const [levelText, modeText] = role.split('-');
  const level = Number(levelText.slice(8)), mode = modeText as SurvivalReviewMode;
  const sim = new Simulation({ ...options, seed: 17, startSquad: 1, startRocketCount: 0 });
  const state = sim.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode || !state.enemyStream || !options.level.enemyStream
    || ![7, 8, 9, 10].includes(level) || level > maxProgressionLevel(balance.progression)
    || !Object.hasOwn(presets, mode)) throw Error('Invalid SURVIVAL TEST preset');
  const stage = progressionStage(level, balance.progression);
  if (stage.weaponFamily !== 'machineGun') throw Error('SURVIVAL TEST requires authored MG progression');
  balance.postCapSurvival = survivalReviewConfig(balance.postCapSurvival, mode);
  balance.carnival.enabled = false; state.carnival = emptyCarnival(true);
  if (balance.destroyer) { balance.destroyer.enabled = false; state.destroyer = emptyDestroyer(true); }
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.machineGunReleaseAtSeconds = 0;
  state.progression = { level, xp: 0 };
  state.squad = { count: stage.squadStage, rifleCounts: [stage.squadStage], rifleRemainder: 0, rocketCount: 0 };
  const lanes = attackLanePositions(balance.laneCount, state.catharsis!.trackHalfWidth, balance.edgeInset);
  const lane = Math.floor(lanes.length / 2);
  state.player = { x: lanes[lane], z: 0, selectedLane: lane };
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: balance.grenade.capacity, supply: null, flight: null };
  state.postCapSurvival = advancePostCapSurvival(state.postCapSurvival, state);
  state.enemies = []; state.enemyStream.nextEnemyId = 1;
  const stream = options.level.enemyStream;
  const row = Math.max(0, Math.floor((balance.defenseSpawnAheadDistance - stream.startZ)
    / (stream.spacing * balance.waveRows)) * balance.waveRows);
  const settings = postCapOrdinarySettings(balance, state.postCapSurvival, level)!;
  admitDefenseGroup(state.enemies, state.enemyStream, row, effectiveSeed(state.seed, stream.seed),
    { ...balance, ...settings }, state.catharsis!.trackHalfWidth, stream.startZ + row * stream.spacing);
  state.enemyStream.nextRowIndex = row + 1;
  state.projectiles = []; state.streamRewards = []; state.gates = []; state.pickups = [];
  const interval = 1 / effectivePrimaryFireRate(baseFireRate, level, balance);
  state.weapons.rifleMemberCooldowns = Array.from({ length: stage.squadStage }, (_, i) => i * interval / stage.squadStage);
  // The review shows one immediate group; normal post-NAVAL activation still waits one second.
  state.defenseWaves!.nextAtSeconds = settings.waveIntervalSeconds ?? balance.postCapSurvival.waveIntervalSeconds!;
  sim.restoreState(state);
  return sim;
}
