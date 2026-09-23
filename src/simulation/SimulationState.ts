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

export interface UpgradeGateSimulationState {
  id: string;
  x: number;
  zOffset: number;
  width: number;
  hp: number;
  maxHp: number;
  reward: { kind: 'rifle' | 'rocket'; amount: number; count: number };
  rewardsRemaining: number;
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
