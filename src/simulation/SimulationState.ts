export interface PlayerSimulationState {
  selectedLane?: number;
  x: number;
  z: number;
}

import type { CatharsisConfig } from '../config/catharsisConfig';

export interface SquadSimulationState {
  count: number;
  rocketCount: number;
  rifleCounts: number[];
  rifleRemainder: number;
}

export interface EnemySimulationState {
  // Admission-time ordinary Survival speed. Absent in historical/pre-NAVAL enemies.
  survivalSpeedMultiplier?: number;
  lane?: number;
  archetype?: 'grunt' | 'heavy' | 'giant';
  id: number;
  tier: number;
  x: number;
  z: number;
  hp: number;
}

export interface EnemyStreamSimulationState {
  nextRowIndex: number;
  nextEnemyId: number;
  nextRewardBlockIndex: number;
  nextRewardId: number;
  nextBossTier: number;
}

export interface ProjectileSimulationState {
  memberIndex?: number;
  lane?: number;
  slopeX?: number;
  id: number;
  kind: 'rifle' | 'machineGun';
  tier: number;
  x: number;
  z: number;
  speed: number;
  damage: number;
  remainingRange: number;
  blastRadius: number;
  hitRadiusBonus: number;
  penetrationRemaining: number;
}

export interface WeaponSimulationState {
  rifleMemberCooldowns?: number[];
  rifleCooldownRemainingSeconds: number;
  rocketCooldownRemainingSeconds: number;
  nextProjectileId: number;
}

export interface LandingAssaultState {
  reinforcementActiveAtSeconds: number | null;
  startedAtSeconds: number | null;
  nextWaveAtSeconds: number | null;
  waveIndex: number;
  secondGiantSpawned: boolean;
  nextGiantAtSeconds?: number | null;
}

export interface SimulationState {
  defenseTank?: import('./defenseTank').DefenseTankState;
  combatStats?: import('./combatStats').CombatStats;
  destroyer?: import('./destroyer').DestroyerState;
  levelEncounters?: import('./levelEncounters').LevelEncounterState;
  navalPresence?: import('./navalPresence').NavalPresenceState;
  navalBarrage?: import('./navalBarrage').NavalBarrageState;
  artillery?: import('./artillery').ArtilleryState;
  postCapSurvival?: import('./postCapSurvival').PostCapSurvivalState;
  carnival?: import('./carnival').CarnivalState;
  defenseWaves?: import('./enemies/defenseWaves').DefenseWaveState;
  grenade?: import('./grenade').GrenadeState;
  landingAssault?: LandingAssaultState;
  reinforcement?: { startedAtSeconds: number | null; arrived: boolean };
  giantEncounter?: { scheduledAtSeconds: number | null; spawned: boolean };
  machineGunReleaseAtSeconds?: number | null;
  progression?: { level: number; xp: number };
  catharsis?: { balance: CatharsisConfig; trackHalfWidth: number; rewardRowsPerReward?: number };
  tick: number;
  elapsedSeconds: number;
  levelId: string;
  seed: number;
  rngState: number;
  player: PlayerSimulationState;
  squad: SquadSimulationState;
  enemies: EnemySimulationState[];
  boss: null;
  enemyStream: EnemyStreamSimulationState | null;
  streamRewards: never[];
  gates: never[];
  pickups: never[];
  nextPickupId: number;
  projectiles: ProjectileSimulationState[];
  weapons: WeaponSimulationState;
}

type DeepReadonly<T> = T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[]
  : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;

// Ephemeral view for synchronous presentation only. Never mutate or retain as a snapshot.
export type SimulationFrameState = DeepReadonly<SimulationState>;
