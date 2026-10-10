import { z } from 'zod';
import type { SimulationState } from './SimulationState';
import { admitDefenseGroup } from './enemies/defenseGroup';

export const CarnivalStateSchema = z.strictObject({
  status: z.enum(['pending', 'active', 'complete', 'skipped']),
  startedAtSeconds: z.number().finite().nonnegative().nullable(),
  elapsedSeconds: z.number().finite().nonnegative(),
  nextWaveIndex: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).refine(s => s.status === 'pending' || s.status === 'skipped'
  ? s.startedAtSeconds === null && s.elapsedSeconds === 0 && s.nextWaveIndex === 0
  : s.startedAtSeconds !== null, 'Invalid Carnival lifecycle');
export type CarnivalState = z.infer<typeof CarnivalStateSchema>;
export const emptyCarnival = (skipped = false): CarnivalState => ({
  status: skipped ? 'skipped' : 'pending', startedAtSeconds: null, elapsedSeconds: 0, nextWaveIndex: 0,
});

export function carnivalOwnsSpawning(frame: SimulationState): boolean {
  return frame.carnival?.status === 'active' || (!!frame.catharsis?.balance.carnival.enabled
    && frame.carnival?.status === 'pending' && (frame.progression?.level ?? 0) >= 6);
}

// A single authored phase. Its end is the handoff boundary for future Stage 1
// content; the caller owns the current temporary fallback. No wave backlog.
export function advanceCarnival(previous: CarnivalState | undefined, frame: SimulationState, streamSeed: number): CarnivalState {
  const c = frame.catharsis?.balance.carnival;
  let state = { ...(previous ?? emptyCarnival()) };
  if (!c?.enabled || !frame.catharsis?.balance.defenseMode) {
    if (state.status === 'pending') return emptyCarnival(true);
    if (state.status === 'active') state.status = 'complete';
    return state;
  }
  if (!frame.enemyStream) return state;
  if (state.status === 'pending' && frame.squad.count && frame.machineGunReleaseAtSeconds != null)
    state = { ...state, status: 'active', startedAtSeconds: frame.machineGunReleaseAtSeconds };
  if (state.status !== 'active') return state;
  state.elapsedSeconds = Math.min(c.durationSeconds, Math.max(0, frame.elapsedSeconds - state.startedAtSeconds!));
  if (state.elapsedSeconds + 1e-9 >= c.durationSeconds) return { ...state, status: 'complete', elapsedSeconds: c.durationSeconds };
  // The lethal artillery tick still advances the phase clock, but admits no
  // enemies. Subsequent Game Over ticks freeze in Simulation, as before.
  if (!frame.squad.count) return state;
  const due = c.firstWaveSeconds + state.nextWaveIndex * c.waveIntervalSeconds;
  if (state.elapsedSeconds + 1e-9 < due) return state;
  // Skip missed opportunities after a large step, including cap-blocked slots.
  const index = Math.floor((state.elapsedSeconds - c.firstWaveSeconds + 1e-9) / c.waveIntervalSeconds);
  state.nextWaveIndex = index + 1;
  const groupSize = Math.min(c.groupSize, Math.max(0, c.activeEnemyLimit - frame.enemies.length));
  if (groupSize) {
    const { balance, trackHalfWidth } = frame.catharsis;
    admitDefenseGroup(frame.enemies, frame.enemyStream, index * balance.waveRows, streamSeed,
      { ...balance, groupSize, heavyCount: 0 }, trackHalfWidth,
      frame.player.z + balance.defenseSpawnAheadDistance, c.laneGroups[index % c.laneGroups.length]);
  }
  return state;
}
