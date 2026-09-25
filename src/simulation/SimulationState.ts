export interface PlayerSimulationState {
  x: number;
  z: number;
}

export interface SquadSimulationState {
  count: number;
  rocketCount: number;
  rifleCounts: number[];
  rifleRemainder: number;
}

export interface EnemySimulationState {
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

export interface BossSimulationState {
  id: number;
  tier: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
}

export interface StreamRewardSimulationState {
  id: number;
  tier: number;
  x: number;
  z: number;
  hitProgress: number;
  hitsRequired: number;
}

export interface UpgradeGateSimulationState {
  id: string;
  x: number;
  zOffset: number;
  width: number;
  reward: { mode: 'hitPickup'; kind: 'rifle' | 'tier2Rifle'; amount: number;
    hitsRequired: number; dropSpeed: number };
  hitProgress: number;
}

export interface UpgradePickupSimulationState {
  id: number;
  sourceGateId: string;
  x: number;
  zOffset: number;
  width: number;
  rewardKind: 'rifle' | 'tier2Rifle';
  rewardAmount: number;
  dropSpeed: number;
}

export interface ProjectileSimulationState {
  id: number;
  kind: 'rifle' | 'rocket';
  tier: number;
  x: number;
  z: number;
  speed: number;
  damage: number;
  remainingRange: number;
  blastRadius: number;
  penetrationRemaining: number;
}

export interface WeaponSimulationState {
  rifleCooldownRemainingSeconds: number;
  rocketCooldownRemainingSeconds: number;
  nextProjectileId: number;
}

export interface SimulationState {
  tick: number;
  elapsedSeconds: number;
  levelId: string;
  seed: number;
  rngState: number;
  player: PlayerSimulationState;
  squad: SquadSimulationState;
  enemies: EnemySimulationState[];
  boss: BossSimulationState | null;
  enemyStream: EnemyStreamSimulationState | null;
  streamRewards: StreamRewardSimulationState[];
  gates: UpgradeGateSimulationState[];
  pickups: UpgradePickupSimulationState[];
  nextPickupId: number;
  projectiles: ProjectileSimulationState[];
  weapons: WeaponSimulationState;
}
