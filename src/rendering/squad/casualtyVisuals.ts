import type { SquadSimulationState } from '../../simulation/SimulationState';

export interface AffectedMember { index: number; tier: number; rocket: boolean }

export function removedVisualMembers(before: SquadSimulationState,
  after: SquadSimulationState): AffectedMember[] {
  const removed: AffectedMember[] = [];
  let index = 0;
  for (let tier = 1; tier <= before.rifleCounts.length; tier++) {
    const oldCount = before.rifleCounts[tier - 1];
    const retained = Math.min(oldCount, after.rifleCounts[tier - 1] ?? 0);
    for (let local = retained; local < oldCount; local++) {
      removed.push({ index: index + local, tier, rocket: false });
    }
    index += oldCount;
  }
  const retainedRockets = Math.min(before.rocketCount, after.rocketCount);
  for (let local = retainedRockets; local < before.rocketCount; local++) {
    removed.push({ index: index + local, tier: 0, rocket: true });
  }
  return removed.sort((a, b) => b.tier - a.tier || a.index - b.index);
}
