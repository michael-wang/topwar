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
  pickups: UpgradePickupRenderState[];
  projectiles: ProjectileRenderState[];
}

export interface UpgradeGateRenderState {
  id: string;
  x: number;
  z: number;
  width: number;
  hp: number;
  maxHp: number;
  rewardMode: 'pickup' | 'instant';
  rewardKind: 'rifle';
  rewardAmount: number;
  rewardIntervalSeconds: number | null;
}

export interface UpgradePickupRenderState {
  id: number;
  x: number;
  z: number;
  rewardAmount: number;
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
