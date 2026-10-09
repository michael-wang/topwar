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
  rewardRowsPerReward: number;
  enemyHigherTierPowerMultiplier: number;
  rifleHigherTierPowerMultiplier: number;
  fireRate: number;
  moveSpeed: number;
  forwardSpeed: number;
  bossHpScale: number;
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
    rewardRowsPerReward: config.catharsis?.waveRows ?? level.enemyStream?.rewards?.rowsPerReward ?? 7,
    enemyHigherTierPowerMultiplier: config.tiers.enemyHigherTierPowerMultiplier,
    rifleHigherTierPowerMultiplier: config.tiers.rifleHigherTierPowerMultiplier,
    fireRate: config.weapon.rifle.fireRate,
    moveSpeed: config.player.moveSpeed,
    forwardSpeed: config.catharsis?.defenseMode ? 0 : config.player.forwardSpeed,
    bossHpScale: 3,
    musicVolume: 0.50,
  };
}
