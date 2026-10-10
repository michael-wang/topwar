import { z } from 'zod';
import type { CatharsisConfig } from '../config/catharsisConfig';
import type { SimulationState } from './SimulationState';
import { spawnInteriorGiant } from './enemies/latePressure';
import { placeGrenadeSupply } from './grenade';

const clock = z.number().finite().nonnegative().nullable();
export const PostCapSurvivalStateSchema = z.strictObject({
  startedAtSeconds: clock, nextGiantAtSeconds: clock, nextGrenadeSupplyAtSeconds: clock,
}).refine(s => s.startedAtSeconds === null
  ? s.nextGiantAtSeconds === null && s.nextGrenadeSupplyAtSeconds === null
  : s.nextGiantAtSeconds !== null && s.nextGrenadeSupplyAtSeconds !== null
    && s.nextGiantAtSeconds > s.startedAtSeconds && s.nextGrenadeSupplyAtSeconds > s.startedAtSeconds,
  { message: 'Invalid post-cap schedule' });
export type PostCapSurvivalState = z.infer<typeof PostCapSurvivalStateSchema>;
export const emptyPostCapSurvival = (): PostCapSurvivalState => ({
  startedAtSeconds: null, nextGiantAtSeconds: null, nextGrenadeSupplyAtSeconds: null,
});

export function postCapOrdinarySettings(balance: CatharsisConfig, state?: PostCapSurvivalState, level = 0):
  { groupSize: number; pressureLaneCount: number; heavyCount: number } | undefined {
  const c = balance.postCapSurvival;
  if (!c.enabled || state?.startedAtSeconds == null) return undefined;
  const profile = c.advancedProfile && level >= c.advancedProfile.startLevel ? c.advancedProfile : c;
  return { groupSize: profile.ordinaryGroupSize, pressureLaneCount: profile.pressureLaneCount, heavyCount: profile.heavyCount };
}

// Advance fixed opportunities, never a backlog. A late restored/large step can
// attempt at most one opportunity and advances directly to the next future slot.
function nextSlot(slot: number, now: number, interval: number): number {
  return slot + (Math.floor((now - slot + 1e-9) / interval) + 1) * interval;
}

// Temporary scheduler only: ordinary archetypes, Supply acquisition and combat
// remain owned by their existing systems. Removing this module restores capped play.
export function advancePostCapSurvival(previous: PostCapSurvivalState | undefined,
  frame: SimulationState): PostCapSurvivalState {
  const balance = frame.catharsis?.balance, c = balance?.postCapSurvival;
  if (!balance?.defenseMode || !c?.enabled) return emptyPostCapSurvival();
  const state = { ...(previous ?? emptyPostCapSurvival()) };
  if (!frame.squad.count || !frame.enemyStream || !frame.grenade
    || (frame.progression?.level ?? 0) < c.startLevel || frame.machineGunReleaseAtSeconds == null) return state;
  const now = frame.elapsedSeconds;
  if (state.startedAtSeconds === null) {
    // Old capped snapshots may lack the teaching encounter entirely. Give its
    // existing timer a safe fresh origin; isolated/disabled reviews stay untouched.
    frame.grenade.lv3EnteredAtSeconds ??= now;
    return { startedAtSeconds: now, nextGiantAtSeconds: now + c.giantIntervalSeconds,
      nextGrenadeSupplyAtSeconds: now + c.grenadeSupplyIntervalSeconds };
  }
  if (now + 1e-9 >= state.nextGiantAtSeconds!) {
    if ((c.maxActiveEnemies === undefined || frame.enemies.filter(e => e.hp > 0).length < c.maxActiveEnemies)
      && frame.enemies.filter(e => e.hp > 0 && e.archetype === 'giant').length < c.maxSimultaneousGiants)
      spawnInteriorGiant(frame.player.z, balance, frame.catharsis!.trackHalfWidth, frame.enemies, frame.enemyStream);
    state.nextGiantAtSeconds = nextSlot(state.nextGiantAtSeconds!, now, c.giantIntervalSeconds);
  }
  if (now + 1e-9 >= state.nextGrenadeSupplyAtSeconds!) {
    // The original teaching crate owns the first Supply encounter, even in a
    // migrated snapshot whose Lv3 entry clock was previously absent.
    if (frame.grenade.supplySpawnedAtSeconds !== null
      && frame.grenade.inventory < balance.grenade.capacity && !frame.grenade.supply)
      frame.grenade.supply = { ...placeGrenadeSupply(frame, balance.grenade), rewardAmount: c.grenadeSupplyAmount };
    state.nextGrenadeSupplyAtSeconds = nextSlot(state.nextGrenadeSupplyAtSeconds!, now, c.grenadeSupplyIntervalSeconds);
  }
  return state;
}
