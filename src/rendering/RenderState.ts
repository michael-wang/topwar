export interface GameRenderState {
  player: {
    x: number;
    z: number;
  };
  squad: {
    count: number;
    formationSpacing: number;
  };
  track: {
    halfWidth: number;
  };
  enemies: EnemyRenderState[];
  projectiles: ProjectileRenderState[];
}

export interface ProjectileRenderState {
  id: number;
  x: number;
  z: number;
}

export interface EnemyRenderState {
  id: number;
  type: 'grunt';
  x: number;
  z: number;
}
