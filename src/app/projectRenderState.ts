import type { GameRenderState } from '../rendering/RenderState';
import type { SimulationFrameState } from '../simulation/SimulationState';
import { attackLanePositions } from '../simulation/enemies/laneComposition';

export interface RenderProjectionConfig {
  readonly catharsis?: SimulationFrameState['catharsis'];
  readonly formationSpacing: number;
  readonly trackHalfWidth: number;
  readonly defenseLineOffset: number;
  readonly bossVisualScale: number;
}

// Entity arrays already have renderer-compatible, readonly fields. Only values that
// change coordinate space or add presentation data are projected here.
export function projectRenderState(state: SimulationFrameState,
  config: RenderProjectionConfig): GameRenderState {
  return {
    player: state.player,
    squad: { count: state.squad.count, rocketCount: state.squad.rocketCount,
      rifleCounts: state.squad.rifleCounts, formationSpacing: config.formationSpacing },
    track: { halfWidth: config.trackHalfWidth,
      ...(config.catharsis ? { lanePositions: attackLanePositions(config.catharsis.balance.laneCount,
        config.catharsis.trackHalfWidth, config.catharsis.balance.edgeInset) } : {}),
      defenseLineZ: state.player.z - config.defenseLineOffset },
    enemies: config.catharsis ? state.enemies.map((enemy) => ({ ...enemy,
      visualScale: config.catharsis!.balance.enemyVisualScale
        * (enemy.archetype === 'heavy' ? config.catharsis!.balance.heavyVisualScale : 1) })) : state.enemies,
    boss: state.boss ? { ...state.boss, visualScale: config.bossVisualScale } : null,
    streamRewards: state.streamRewards,
    gates: state.gates.map((gate) => ({ id: gate.id, x: gate.x,
      z: state.player.z + gate.zOffset, width: gate.width,
      rewardKind: gate.reward.kind, rewardAmount: gate.reward.amount,
      hitProgress: gate.hitProgress, hitsRequired: gate.reward.hitsRequired })),
    pickups: state.pickups.map((pickup) => ({ id: pickup.id, x: pickup.x,
      z: state.player.z + pickup.zOffset, rewardAmount: pickup.rewardAmount,
      rewardKind: pickup.rewardKind })),
    projectiles: state.projectiles,
  };
}
