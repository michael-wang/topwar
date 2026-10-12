export interface GameRenderState {
  readonly defenseTank?: { readonly state: Readonly<import('../simulation/defenseTank').DefenseTankState>;
    readonly config: import('../config/defenseTankConfig').DefenseTankSettings; readonly elapsedSeconds: number };
  readonly destroyer?: { readonly state: Readonly<import('../simulation/destroyer').DestroyerState>;
    readonly presence?: Readonly<import('../simulation/navalPresence').NavalPresenceState>;
    readonly config: import('../config/destroyerConfig').DestroyerSettings; readonly elapsedSeconds: number };
  readonly artillery?: { readonly shells: readonly Readonly<import('../simulation/artillery').ArtilleryShell>[];
    readonly elapsedSeconds: number; readonly warningPresentation?: 'overheadLanes' };
  readonly grenade?: {
    readonly supply: Readonly<NonNullable<import('../simulation/grenade').GrenadeState['supply']>> | null;
    readonly flight: Readonly<NonNullable<import('../simulation/grenade').GrenadeState['flight']>> | null;
    readonly elapsedSeconds: number; readonly originZ: number;
  };
  readonly defenseMode?: boolean;
  readonly player: {
    readonly selectedLane?: number;
    readonly x: number;
    readonly z: number;
  };
  readonly squad: {
    readonly weaponFamily?: 'rifle' | 'machineGun';
    readonly defenseFormation?: { reinforcementSpacing: number; reinforcementStagger: number };
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
  readonly projectiles: readonly ProjectileRenderState[];
}

export interface ProjectileRenderState {
  readonly memberIndex?: number;
  readonly slopeX?: number;
  readonly id: number;
  readonly kind: 'rifle' | 'machineGun';
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
