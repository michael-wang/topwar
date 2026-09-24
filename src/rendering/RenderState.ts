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
  boss: BossRenderState | null;
  streamRewards: StreamRewardRenderState[];
  gates: UpgradeGateRenderState[];
  pickups: UpgradePickupRenderState[];
  projectiles: ProjectileRenderState[];
}

export interface BossRenderState {
  id: number;
  tier: 1;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  visualScale: number;
}

export interface StreamRewardRenderState {
  id: number;
  tier: 1 | 2;
  x: number;
  z: number;
  hitProgress: number;
  hitsRequired: number;
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
  type: 'grunt' | 'brute' | 'tier3';
  x: number;
  z: number;
  hp: number;
}
