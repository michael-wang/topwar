import { z } from 'zod';
import { CatharsisConfigSchema } from './catharsisConfig';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();

export const GameConfigSchema = z.strictObject({
  catharsis: CatharsisConfigSchema.optional(),
  player: z.strictObject({
    startSquad: z.number().int().safe().nonnegative(),
    startRocketCount: z.literal(0).default(0),
    moveSpeed: nonnegative,
    forwardSpeed: nonnegative.default(.6),
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
      tierHitRadiusStep: nonnegative.default(.45),
      maxHitRadiusBonus: nonnegative.default(.9),
    }),
    rocket: z.strictObject({
      damage: positive,
      fireRate: positive,
      projectileSpeed: positive,
      range: positive,
      blastRadius: positive,
    }).default({ damage:15, fireRate:.6, projectileSpeed:18, range:40, blastRadius:1.25 }),
  }),
  tiers: z.strictObject({
    mergeCount: z.number().int().safe().min(2).default(10),
    tier1Power: positive,
    tier2Power: positive.default(300),
    enemyHigherTierPowerMultiplier: z.number().finite().gt(1).default(10),
    rifleHigherTierPowerMultiplier: z.number().finite().gt(1).default(10),
    normalEnemyRadius: positive,
  }),
  bosses: z.strictObject({
    basic: z.strictObject({
      visualScale: z.number().finite().gt(1),
      radius: positive,
    }),
  }).default({basic:{visualScale:7,radius:2}}),
}).refine((config) => !config.catharsis || (config.catharsis.edgeInset < config.track.halfWidth
  && config.catharsis.edgeInset >= config.tiers.normalEnemyRadius),
  { path: ['catharsis', 'edgeInset'], message: 'Lane inset must contain enemy collision and be inside the track' })
  .refine((config) => !config.catharsis
    || config.catharsis.rewardAimRadius < config.track.halfWidth - config.catharsis.edgeInset,
  { path: ['catharsis', 'rewardAimRadius'], message: 'Rewards must leave another lane to pursue' })
  .refine((config) => config.player.startRocketCount <= config.player.startSquad,
  { path: ['player', 'startRocketCount'], message: 'startRocketCount cannot exceed startSquad' });

export type GameConfig = z.infer<typeof GameConfigSchema>;
