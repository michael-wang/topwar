import type { GameRenderState } from '../rendering/RenderState';
import type { SimulationFrameState } from '../simulation/SimulationState';

export interface RenderProjectionConfig {
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
      defenseLineZ: state.player.z - config.defenseLineOffset },
    enemies: state.enemies,
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
