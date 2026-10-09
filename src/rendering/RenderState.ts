export interface GameRenderState {
  readonly artillery?: { readonly shells: readonly Readonly<import('../simulation/artillery').ArtilleryShell>[];
    readonly elapsedSeconds: number };
  readonly grenade?: {
    readonly supply: Readonly<NonNullable<import('../simulation/grenade').GrenadeState['supply']>> | null;
    readonly flight: Readonly<NonNullable<import('../simulation/grenade').GrenadeState['flight']>> | null;
    readonly elapsedSeconds: number; readonly originZ: number;
  };
  readonly defenseMode?: boolean;
  readonly landingAssaultAgeSeconds?: number;
  readonly player: {
    readonly selectedLane?: number;
    readonly x: number;
    readonly z: number;
  };
  readonly squad: {
    readonly weaponFamily?: 'rifle' | 'machineGun';
    readonly defenseFormation?: { reinforcementSpacing: number; reinforcementStagger: number };
    readonly reinforcement?: { progress: number; reinforcementSpacing: number; reinforcementStagger: number };
    readonly count: number;
    readonly rocketCount: number;
    readonly rifleCounts: readonly number[];
    readonly formationSpacing: number;
  };
  readonly track: {
    readonly lanePositions?: readonly number[];
    readonly halfWidth: number;
    readonly defenseLineZ: number;
  };
  readonly enemies: readonly EnemyRenderState[];
  readonly boss: BossRenderState | null;
  readonly streamRewards: readonly StreamRewardRenderState[];
  readonly gates: readonly UpgradeGateRenderState[];
  readonly pickups: readonly UpgradePickupRenderState[];
  readonly projectiles: readonly ProjectileRenderState[];
}

export interface BossRenderState {
  readonly id: number;
  readonly tier: number;
  readonly x: number;
  readonly z: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly visualScale: number;
  readonly engaged: boolean;
  readonly slamCooldownRemainingSeconds: number;
  readonly slamCount: number;
}

export interface StreamRewardRenderState {
  readonly id: number;
  readonly tier: number;
  readonly x: number;
  readonly z: number;
  readonly hitProgress: number;
  readonly hitsRequired: number;
}

export interface UpgradeGateRenderState {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly rewardKind: 'rifle' | 'tier2Rifle';
  readonly rewardAmount: number;
  readonly hitProgress: number;
  readonly hitsRequired: number;
}

export interface UpgradePickupRenderState {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly rewardAmount: number;
  readonly rewardKind: 'rifle' | 'tier2Rifle';
}

export interface ProjectileRenderState {
  readonly memberIndex?: number;
  readonly slopeX?: number;
  readonly id: number;
  readonly kind: 'rifle' | 'machineGun' | 'rocket';
  readonly tier: number;
  readonly x: number;
  readonly z: number;
  readonly hitRadiusBonus: number;
}

export interface EnemyRenderState {
  readonly gaitCycleMs?: number;
  readonly maxHp?: number;
  readonly archetype?: 'grunt' | 'heavy' | 'giant';
  readonly visualScale?: number;
  readonly visualScaleX?: number;
  readonly visualScaleY?: number;
  readonly visualScaleZ?: number;
  readonly id: number;
  readonly tier: number;
  readonly x: number;
  readonly z: number;
  readonly hp: number;
}
