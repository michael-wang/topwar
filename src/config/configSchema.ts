import { z } from 'zod';
import { CatharsisConfigSchema } from './catharsisConfig';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();

export const GameConfigSchema = z.strictObject({
  catharsis: CatharsisConfigSchema.optional(),
  player: z.strictObject({
    startSquad: z.number().int().safe().nonnegative(),
    startRocketCount: z.number().int().safe().nonnegative(),
    moveSpeed: nonnegative,
    forwardSpeed: nonnegative,
    formationSpacing: positive,
    memberRadius: positive,
  }),
  track: z.strictObject({
    halfWidth: positive,
    defenseLineOffset: positive,
  }),
  weapon: z.strictObject({
    rifle: z.strictObject({
      fireRate: positive,
      projectileSpeed: positive,
      range: positive,
      tierHitRadiusStep: nonnegative,
      maxHitRadiusBonus: nonnegative,
    }),
    rocket: z.strictObject({
      damage: positive,
      fireRate: positive,
      projectileSpeed: positive,
      range: positive,
      blastRadius: positive,
    }),
  }),
  tiers: z.strictObject({
    mergeCount: z.number().int().safe().min(2),
    tier1Power: positive,
    tier2Power: positive,
    enemyHigherTierPowerMultiplier: z.number().finite().gt(1),
    rifleHigherTierPowerMultiplier: z.number().finite().gt(1),
    normalEnemyRadius: positive,
  }),
  bosses: z.strictObject({
    basic: z.strictObject({
      visualScale: z.number().finite().gt(1),
      radius: positive,
    }),
  }),
}).refine((config) => !config.catharsis || (config.catharsis.edgeInset < config.track.halfWidth
  && config.catharsis.edgeInset >= config.tiers.normalEnemyRadius),
  { path: ['catharsis', 'edgeInset'], message: 'Lane inset must contain enemy collision and be inside the track' })
  .refine((config) => !config.catharsis
    || config.catharsis.rewardAimRadius < config.track.halfWidth - config.catharsis.edgeInset,
  { path: ['catharsis', 'rewardAimRadius'], message: 'Rewards must leave another lane to pursue' })
  .refine((config) => config.player.startRocketCount <= config.player.startSquad,
  { path: ['player', 'startRocketCount'], message: 'startRocketCount cannot exceed startSquad' });

export type GameConfig = z.infer<typeof GameConfigSchema>;
