export interface GameRenderState {
  player: {
    x: number;
    z: number;
  };
  squad: {
    count: number;
    rocketCount: number;
    formationSpacing: number;
  };
  track: {
    halfWidth: number;
    defenseLineZ: number;
  };
  enemies: EnemyRenderState[];
  projectiles: ProjectileRenderState[];
}

export interface ProjectileRenderState {
  id: number;
  kind: 'rifle' | 'rocket';
  x: number;
  z: number;
}

export interface EnemyRenderState {
  id: number;
  type: 'grunt';
  x: number;
  z: number;
}
