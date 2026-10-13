import type { GameRenderState } from '../rendering/RenderState';
import type { SimulationFrameState } from '../simulation/SimulationState';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { progressionStage } from '../simulation/progression';

export interface RenderProjectionConfig {
  readonly catharsis?: SimulationFrameState['catharsis'];
  readonly formationSpacing: number;
  readonly trackHalfWidth: number;
  readonly defenseLineOffset: number;
}

// Entity arrays already have renderer-compatible, readonly fields. Only values that
// change coordinate space or add presentation data are projected here.
export function projectRenderState(state: SimulationFrameState,
  config: RenderProjectionConfig): GameRenderState {
  const defenseMode = !!config.catharsis?.balance.defenseMode;
  const originZ = defenseMode ? state.player.z : 0;
  return {
    ...(state.commanderSupport ? { commanderSupport: { state: state.commanderSupport,
      config: state.catharsis?.balance.commanderSupport, elapsedSeconds: state.elapsedSeconds } } : {}),
    ...(state.defenseTank && state.catharsis?.balance.defenseTank ? { defenseTank: { state: state.defenseTank,
      config: state.catharsis.balance.defenseTank, elapsedSeconds: state.elapsedSeconds } } : {}),
    ...(state.destroyer && state.catharsis?.balance.destroyer ? { destroyer: { state: state.destroyer, presence: state.navalPresence,
      config: state.catharsis.balance.destroyer, elapsedSeconds: state.elapsedSeconds } } : {}),
    ...(state.artillery ? { artillery: { shells: state.artillery.shells, elapsedSeconds: state.elapsedSeconds,
      warningPresentation: state.catharsis?.balance.artillery?.warningPresentation } } : {}),
    ...(state.grenade ? { grenade: { supply: state.grenade.supply, flight: state.grenade.flight,
      elapsedSeconds: state.elapsedSeconds, originZ } } : {}),
    ...(defenseMode ? { defenseMode } : {}),
    player: defenseMode ? { ...state.player, z: 0 } : state.player,
    squad: { count: state.squad.count, rocketCount: state.squad.rocketCount,
      ...(state.progression && config.catharsis ? { weaponFamily: progressionStage(state.progression.level,
        config.catharsis.balance.progression).weaponFamily } : {}),
      rifleCounts: state.squad.rifleCounts, formationSpacing: config.formationSpacing,
      ...(defenseMode ? { defenseFormation: {
        reinforcementSpacing: config.catharsis!.balance.progression.reinforcementSpacing,
        reinforcementStagger: config.catharsis!.balance.progression.reinforcementStagger,
      } } : {}),
    },
    track: { halfWidth: config.trackHalfWidth,
      ...(config.catharsis ? { lanePositions: attackLanePositions(config.catharsis.balance.laneCount,
        config.catharsis.trackHalfWidth, config.catharsis.balance.edgeInset) } : {}),
      defenseLineZ: state.player.z - originZ - config.defenseLineOffset },
    enemies: config.catharsis ? state.enemies.map((enemy) => ({ ...enemy,
      z: enemy.z - originZ,
      visualScale: config.catharsis!.balance.enemyVisualScale
        * (enemy.archetype === 'giant' ? config.catharsis!.balance.giant.visualScale
          : enemy.archetype === 'heavy' ? config.catharsis!.balance.heavyVisualScale : 1),
      ...(enemy.archetype === 'giant' ? {
        maxHp: config.catharsis!.balance.giant.hp,
        gaitCycleMs: config.catharsis!.balance.giant.gaitCycleMs,
        visualScaleX: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.giant.visualScale * config.catharsis!.balance.giant.widthMultiplier,
        visualScaleY: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.giant.visualScale,
        visualScaleZ: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.giant.visualScale,
      } : {}),
      ...(enemy.archetype === 'heavy' ? {
        maxHp: config.catharsis!.balance.heavyHp,
        visualScaleX: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.heavyVisualScale * config.catharsis!.balance.heavyWidthMultiplier,
        visualScaleY: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.heavyVisualScale * config.catharsis!.balance.heavyHeightMultiplier,
        visualScaleZ: config.catharsis!.balance.enemyVisualScale * config.catharsis!.balance.heavyVisualScale * config.catharsis!.balance.heavyDepthMultiplier,
      } : {}) })) : state.enemies,
    projectiles: defenseMode ? state.projectiles.map((shot) => ({ ...shot, z: shot.z - originZ })) : state.projectiles,
  };
}
