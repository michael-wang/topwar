import { z } from 'zod';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();

export const GameConfigSchema = z.strictObject({
  player: z.strictObject({
    startSquad: z.number().int().nonnegative(),
    moveSpeed: nonnegative,
    forwardSpeed: nonnegative,
    formationSpacing: positive,
    memberRadius: positive,
  }),
  track: z.strictObject({
    halfWidth: positive,
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
  }),
  enemies: z.strictObject({
    grunt: z.strictObject({
      hp: positive,
      moveSpeed: nonnegative,
      contactDamage: z.number().int().safe().positive(),
      radius: positive,
    }),
  }),
  bosses: z.strictObject({
    basic: z.strictObject({
      hp: positive,
      moveSpeed: nonnegative,
      radius: positive,
    }),
  }),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
