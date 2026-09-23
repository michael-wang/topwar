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
  gates: UpgradeGateRenderState[];
  projectiles: ProjectileRenderState[];
}

export interface UpgradeGateRenderState {
  id: string;
  x: number;
  z: number;
  width: number;
  hp: number;
  maxHp: number;
  rewardMode: 'periodic' | 'instant';
  rewardKind: 'rifle';
  rewardAmount: number;
  rewardIntervalSeconds: number | null;
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
