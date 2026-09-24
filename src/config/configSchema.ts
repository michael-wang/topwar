import { z } from 'zod';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();

export const GameConfigSchema = z.strictObject({
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
  controls: z.strictObject({
    mouseSensitivity: positive,
  }),
  weapon: z.strictObject({
    rifle: z.strictObject({
      damage: positive,
      fireRate: positive,
      projectileSpeed: positive,
      range: positive,
    }),
    rocket: z.strictObject({
      damage: positive,
      fireRate: positive,
      projectileSpeed: positive,
      range: positive,
      blastRadius: positive,
    }),
  }),
  enemies: z.strictObject({
    grunt: z.strictObject({
      hp: positive,
      radius: positive,
    }),
    brute: z.strictObject({
      hp: positive,
      radius: positive,
    }),
    tier3: z.strictObject({
      hp: positive,
      radius: positive,
    }),
  }),
  bosses: z.strictObject({
    basic: z.strictObject({
      hpMultiplier: positive,
      visualScale: z.number().finite().gt(1),
      radius: positive,
    }),
  }),
}).refine((config) => config.player.startRocketCount <= config.player.startSquad,
  { path: ['player', 'startRocketCount'], message: 'startRocketCount cannot exceed startSquad' });

export type GameConfig = z.infer<typeof GameConfigSchema>;
