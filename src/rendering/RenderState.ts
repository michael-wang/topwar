export interface GameRenderState {
  player: {
    x: number;
    z: number;
  };
  squad: {
    count: number;
    rocketCount: number;
    tier2RifleCount: number;
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
  rewardKind: 'rifle' | 'tier2Rifle';
  rewardAmount: number;
  hitProgress: number;
  hitsRequired: number;
}

export interface UpgradePickupRenderState {
  id: number;
  x: number;
  z: number;
  rewardAmount: number;
  rewardKind: 'rifle' | 'tier2Rifle';
}

export interface ProjectileRenderState {
  id: number;
  kind: 'rifle' | 'heavyRifle' | 'rocket';
  x: number;
  z: number;
}

export interface EnemyRenderState {
  id: number;
  type: 'grunt' | 'brute';
  x: number;
  z: number;
}
