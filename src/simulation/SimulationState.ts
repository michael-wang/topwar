export interface PlayerSimulationState {
  x: number;
  z: number;
}

export interface SquadSimulationState {
  count: number;
}

export interface EnemySimulationState {
  id: number;
  type: 'grunt';
  x: number;
  z: number;
  hp: number;
}

export interface ProjectileSimulationState {
  id: number;
  x: number;
  z: number;
  speed: number;
  damage: number;
  remainingRange: number;
}

export interface RifleSimulationState {
  cooldownRemainingSeconds: number;
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
  projectiles: ProjectileSimulationState[];
  rifle: RifleSimulationState;
}
