export interface PlayerSimulationState {
  x: number;
  z: number;
}

export interface SquadSimulationState {
  count: number;
  rocketCount: number;
  tier2RifleCount: number;
}

export interface EnemySimulationState {
  id: number;
  type: 'grunt' | 'brute';
  x: number;
  z: number;
  hp: number;
}

export interface EnemyStreamSimulationState {
  nextRowIndex: number;
  nextEnemyId: number;
}

interface UpgradeGateBaseState {
  id: string;
  x: number;
  zOffset: number;
  width: number;
  hp: number;
  maxHp: number;
}

export interface UpgradeGateSimulationState extends UpgradeGateBaseState {
  reward: { mode: 'pickup'; kind: 'rifle' | 'tier2Rifle'; amount: number; intervalSeconds: number; dropSpeed: number }
    | { mode: 'instant'; kind: 'rifle'; amount: number };
  // Present only for pickup armories; null until their wall breaks.
  rewardCooldownRemainingSeconds?: number | null;
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
  kind: 'rifle' | 'heavyRifle' | 'rocket';
  x: number;
  z: number;
  speed: number;
  damage: number;
  remainingRange: number;
  blastRadius: number;
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
  enemyStream: EnemyStreamSimulationState | null;
  gates: UpgradeGateSimulationState[];
  pickups: UpgradePickupSimulationState[];
  nextPickupId: number;
  projectiles: ProjectileSimulationState[];
  weapons: WeaponSimulationState;
}
