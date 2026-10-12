import type { GameConfig } from '../config/configSchema';
import type { LevelDefinition } from '../level/LevelDefinition';

export interface RuntimeTuning {
  groupSize?: number;
  enemyVisualScale?: number;
  gruntSpeed?: number;
  heavyHp?: number;
  heavySpeed?: number;
  heavyChance?: number;
  bulletSpeed: number;
  bulletRange: number;
  /** Released checkpoint metadata; no current control or combat effect. */
  rewardRowsPerReward?: number;
  /** Released checkpoint metadata; no current control or combat effect. */
  enemyHigherTierPowerMultiplier?: number;
  /** Released checkpoint metadata; no current control or combat effect. */
  rifleHigherTierPowerMultiplier?: number;
  fireRate: number;
  moveSpeed: number;
  forwardSpeed: number;
  /** Released checkpoint metadata; no current control or combat effect. */
  bossHpScale?: number;
  musicVolume: number;
}

export function defaultRuntimeTuning(config: Readonly<GameConfig>, level: LevelDefinition): RuntimeTuning {
  return {
    ...(config.catharsis?.defenseMode ? { groupSize: config.catharsis.groupSize } : {}),
    ...(config.catharsis ? { enemyVisualScale: config.catharsis.enemyVisualScale,
      gruntSpeed: config.catharsis.gruntSpeed, heavyHp: config.catharsis.heavyHp,
      heavySpeed: config.catharsis.heavySpeed, heavyChance: config.catharsis.heavyChance } : {}),
    bulletSpeed: config.weapon.rifle.projectileSpeed,
    bulletRange: config.weapon.rifle.range,
    fireRate: config.weapon.rifle.fireRate,
    moveSpeed: config.player.moveSpeed,
    forwardSpeed: config.catharsis?.defenseMode ? 0 : config.player.forwardSpeed,
    musicVolume: 0.50,
  };
}
