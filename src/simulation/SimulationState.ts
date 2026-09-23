export interface PlayerSimulationState {
  x: number;
  z: number;
}

export interface SquadSimulationState {
  count: number;
  rocketCount: number;
}

export interface EnemySimulationState {
  id: number;
  type: 'grunt';
  x: number;
  z: number;
  hp: number;
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
  reward: { mode: 'periodic'; kind: 'rifle'; amount: number; intervalSeconds: number }
    | { mode: 'instant'; kind: 'rifle'; amount: number };
  // Present only for periodic armories; null until their wall breaks.
  rewardCooldownRemainingSeconds?: number | null;
}

export interface ProjectileSimulationState {
  id: number;
  kind: 'rifle' | 'rocket';
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
  gates: UpgradeGateSimulationState[];
  projectiles: ProjectileSimulationState[];
  weapons: WeaponSimulationState;
}
