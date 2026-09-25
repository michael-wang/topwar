import type { GameConfig } from '../config/configSchema';
import type { LevelDefinition } from '../level/LevelDefinition';

export interface RuntimeTuning {
  bulletSpeed: number;
  bulletRange: number;
  rewardRowsPerReward: number;
  enemyHigherTierPowerMultiplier: number;
  rifleHigherTierPowerMultiplier: number;
  fireRate: number;
  moveSpeed: number;
  forwardSpeed: number;
}

export function defaultRuntimeTuning(config: Readonly<GameConfig>, level: LevelDefinition): RuntimeTuning {
  return {
    bulletSpeed: config.weapon.rifle.projectileSpeed,
    bulletRange: config.weapon.rifle.range,
    rewardRowsPerReward: level.enemyStream?.rewards?.rowsPerReward ?? 8,
    enemyHigherTierPowerMultiplier: config.tiers.enemyHigherTierPowerMultiplier,
    rifleHigherTierPowerMultiplier: config.tiers.rifleHigherTierPowerMultiplier,
    fireRate: config.weapon.rifle.fireRate,
    moveSpeed: config.player.moveSpeed,
    forwardSpeed: config.player.forwardSpeed,
  };
}
