import { z } from 'zod';
import { GameConfigSchema } from '../config/configSchema';
import type { ConfigStorage } from '../config/ConfigStore';
import { LevelDefinitionSchema } from '../level/LevelDefinition';
import { Simulation } from '../simulation/Simulation';
import type { SimulationState } from '../simulation/SimulationState';

export const CHECKPOINT_KEY = `topwar:session:v1:${import.meta.env.DEV ? 'dev' : 'release'}`;
// One slot, bounded before parsing or writing. UTF-16 storage is at most 2 MiB.
export const MAX_CHECKPOINT_CHARACTERS = 1024 * 1024;
const nonnegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
export const RuntimeTuningSchema = z.strictObject({
  groupSize: z.number().int().positive().optional(), enemyVisualScale: positive.optional(),
  gruntSpeed: nonnegative.optional(), heavyHp: positive.optional(),
  heavySpeed: nonnegative.optional(), heavyChance: z.number().min(0).max(1).optional(),
  bulletSpeed: positive, bulletRange: positive, rewardRowsPerReward: z.number().int().positive(),
  enemyHigherTierPowerMultiplier: z.number().finite().gt(1),
  rifleHigherTierPowerMultiplier: z.number().finite().gt(1),
  fireRate: positive, moveSpeed: nonnegative, forwardSpeed: nonnegative,
  bossHpScale: z.number().min(.25).max(100), musicVolume: z.number().min(0).max(.5),
});
const envelope = z.strictObject({
  version: z.literal(1), simulationContract: z.literal(1), game: z.literal('topwar'),
  mode: z.enum(['defense', 'legacy']), build: z.string().max(80),
  savedAt: z.number().finite().nonnegative(), paused: z.literal(true), hidden: z.boolean(),
  reason: z.enum(['pause', 'hidden', 'pagehide', 'freeze', 'contextlost']),
  fixture: z.string().max(80).nullable(), config: GameConfigSchema,
  level: LevelDefinitionSchema, tuning: RuntimeTuningSchema, state: z.unknown(),
});
export type SessionCheckpoint = Omit<z.infer<typeof envelope>, 'state'> & { state: SimulationState };
export type CheckpointRead = { status: 'empty' | 'unavailable' | 'invalid'; checkpoint?: never }
  | { status: 'valid'; checkpoint: SessionCheckpoint };

export function browserSessionStorage(): ConfigStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
export function checkpointPresent(storage = browserSessionStorage()): boolean {
  try { return storage?.getItem(CHECKPOINT_KEY) != null; } catch { return false; }
}
export function simulationFromCheckpoint(c: SessionCheckpoint): Simulation {
  const simulation = new Simulation({ seed: c.state.seed, level: c.level,
    startSquad: c.config.player.startSquad, startRocketCount: c.config.player.startRocketCount,
    tiers: { ...c.config.tiers, enemyHigherTierPowerMultiplier: c.tuning.enemyHigherTierPowerMultiplier,
      rifleHigherTierPowerMultiplier: c.tuning.rifleHigherTierPowerMultiplier },
    rewardRowsPerReward: c.tuning.rewardRowsPerReward, bossHpScale: c.tuning.bossHpScale,
    ...(c.config.catharsis ? { catharsis: { balance: c.config.catharsis,
      trackHalfWidth: c.config.track.halfWidth } } : {}),
  });
  simulation.restoreState(c.state);
  return simulation;
}
export function readCheckpoint(storage = browserSessionStorage()): CheckpointRead {
  if (!storage) return { status: 'unavailable' };
  let text: string | null;
  try { text = storage.getItem(CHECKPOINT_KEY); } catch { return { status: 'unavailable' }; }
  if (text === null) return { status: 'empty' };
  try {
    if (text.length > MAX_CHECKPOINT_CHARACTERS) throw Error('Oversized checkpoint');
    const c = envelope.parse(JSON.parse(text)) as SessionCheckpoint;
    if (c.fixture !== null && (!import.meta.env.DEV
      || !/^(late|crate3|crate8|naval|mg(6|7|8|9|10)|survival(7|8|9|10)-(baseline|experimental|staged|ahead)|barrage(8|9|10)-(on|off))$/.test(c.fixture)))
      throw Error('Unsupported fixture');
    if (c.level.id !== c.state.levelId || c.mode !== (c.state.catharsis?.balance.defenseMode ? 'defense' : 'legacy')
      || c.mode !== (c.config.catharsis?.defenseMode ? 'defense' : 'legacy') || c.state.squad.count === 0)
      throw Error('Incompatible or finished checkpoint');
    simulationFromCheckpoint(c); // Includes the existing strict historical migrations/clock validation.
    return { status: 'valid', checkpoint: c };
  } catch { return { status: 'invalid' }; }
}
export function clearCheckpoint(storage = browserSessionStorage()): boolean {
  try { storage?.removeItem(CHECKPOINT_KEY); return storage !== null; } catch { return false; }
}
export function writeCheckpoint(c: SessionCheckpoint, storage = browserSessionStorage()) {
  const started = performance.now();
  let characters = 0;
  try {
    if (!storage) throw Error('Storage unavailable');
    const text = JSON.stringify(c); characters = text.length;
    if (characters > MAX_CHECKPOINT_CHARACTERS) throw Error('Oversized checkpoint');
    storage.setItem(CHECKPOINT_KEY, text);
    return { ok: true, characters, milliseconds: performance.now() - started };
  } catch {
    // Do not leave an older run looking like the just-paused run after a failed write.
    clearCheckpoint(storage);
    return { ok: false, characters, milliseconds: performance.now() - started };
  }
}
