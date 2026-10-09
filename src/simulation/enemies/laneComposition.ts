import { SeededRng } from '../../core/Rng';
import type { CatharsisConfig } from '../../config/catharsisConfig';

export function attackLanePositions(laneCount: number, halfWidth: number, edgeInset: number): number[] {
  if (!Number.isInteger(laneCount) || laneCount < 3 || laneCount > 16
    || !Number.isFinite(halfWidth) || !Number.isFinite(edgeInset)
    || edgeInset <= 0 || edgeInset >= halfWidth) throw new Error('Invalid attack lane bounds');
  const extent = halfWidth - edgeInset;
  return Array.from({ length: laneCount }, (_, lane) => -extent + lane * 2 * extent / (laneCount - 1));
}

export function laneWave(waveIndex: number, seed: number, config: CatharsisConfig) {
  // Hold priorities across several groups so approaching waves remain readable.
  const pressureBlock = Math.floor(waveIndex / config.priorityWaves);
  const rng = new SeededRng((seed ^ Math.imul(pressureBlock + 1, 0x9e3779b1)) >>> 0);
  const primary = rng.nextInt(config.laneCount);
  const secondary = (primary + 1 + rng.nextInt(config.laneCount - 1)) % config.laneCount;
  let lanes = rng.nextFloat() < config.secondLaneChance ? [primary, secondary] : [primary];
  if (config.defenseMode && config.pressureLaneCount !== undefined) {
    const choices = Array.from({ length: config.laneCount }, (_, lane) => lane);
    // A small seeded partial shuffle selects distinct fronts for the whole block.
    for (let index = 0; index < config.pressureLaneCount; index++) {
      const chosen = index + rng.nextInt(choices.length - index);
      [choices[index], choices[chosen]] = [choices[chosen], choices[index]];
    }
    lanes = choices.slice(0, config.pressureLaneCount);
  }
  const compositionRng = new SeededRng((seed ^ Math.imul(waveIndex + 1, 0x85ebca6b)) >>> 0);
  const heavy = compositionRng.nextFloat() < config.heavyChance;
  const quiet = Array.from({ length: config.laneCount }, (_, lane) => lane).filter((lane) => !lanes.includes(lane));
  return { lanes, heavy, rewardLane: quiet.length ? quiet[compositionRng.nextInt(quiet.length)] : lanes[0] };
}

export function laneCompositionForRow(row: number, seed: number, config: CatharsisConfig & { heavyCount?: number }, halfWidth: number,
  authoredLanes?: readonly number[]):
  { x: number; z: number; archetype: 'grunt' | 'heavy'; lane?: number }[] {
  const wave = laneWave(Math.floor(row / config.waveRows), seed, config);
  if (authoredLanes) wave.lanes = [...authoredLanes];
  const slot = row % config.waveRows;
  if (config.defenseMode) {
    if (slot !== 0) return [];
    const positions = attackLanePositions(config.laneCount, halfWidth, config.edgeInset);
    const spacing = positions[1] - positions[0];
    const rng = new SeededRng((seed ^ Math.imul(row + 1, 0xc2b2ae35)) >>> 0);
    const rotation = Math.floor(row / config.waveRows) % wave.lanes.length;
    const heavyMembers = new Set(Array.from({ length: config.heavyCount ?? (wave.heavy ? 1 : 0) },
      (_, index) => config.heavyCount === undefined ? 0 : (rotation + index) % config.groupSize));
    const members = Array.from({ length: config.groupSize }, (_, member) => {
      const lane = wave.lanes[member % wave.lanes.length];
      const spread = spacing * config.lateralSpreadFraction;
      const minimumX = Math.max(positions[0], positions[lane] - spread);
      const maximumX = Math.min(positions.at(-1)!, positions[lane] + spread);
      // Independent samples intentionally allow overlap; no rows or personal-space slots.
      return { lane, x: minimumX + rng.nextFloat() * (maximumX - minimumX),
        // Beachward only: even the rear of a newly admitted crowd stays at entry.
        // Population changes density, never the group's longitudinal footprint.
        z: -rng.nextFloat() * config.crowdDepthSpan,
        archetype: heavyMembers.has(member) ? 'heavy' as const : 'grunt' as const };
    });
    const clearedLanes = new Set<number>();
    for (const heavy of members.filter(member => member.archetype === 'heavy')) {
      heavy.x = positions[heavy.lane];
      heavy.z = -config.crowdDepthSpan;
      if (clearedLanes.has(heavy.lane)) continue;
      clearedLanes.add(heavy.lane);
      // Only this lane's leader gets clearance; Grunts remain overlapping seeded crowds.
      const clearance = Math.min(config.heavyFrontClearance, config.crowdDepthSpan);
      for (const member of members) if (member.archetype === 'grunt' && member.lane === heavy.lane) {
        member.z = -config.crowdDepthSpan + clearance
          + (member.z + config.crowdDepthSpan) * (config.crowdDepthSpan - clearance) / config.crowdDepthSpan;
      }
    }
    return members;
  }
  if (slot % config.groupRowStride !== 0 || slot / config.groupRowStride >= config.groupSize) return [];
  const positions = attackLanePositions(config.laneCount, halfWidth, config.edgeInset);
  // A two-lane wave splits the same group budget, avoiding twice the pressure.
  const lane = wave.lanes[(slot / config.groupRowStride) % wave.lanes.length];
  return [{ x: positions[lane], z: 0, archetype: slot === 0 && wave.heavy ? 'heavy' as const : 'grunt' as const }];
}

export function rewardLaneXForRow(row: number, seed: number, config: CatharsisConfig,
  halfWidth: number, playerX: number): number {
  const wave = laneWave(Math.floor(row / config.waveRows), seed, config);
  const positions = attackLanePositions(config.laneCount, halfWidth, config.edgeInset);
  const requiresMovement = positions.map((x, lane) => ({ x, lane }))
    .filter(({ x }) => Math.abs(x - playerX) > config.rewardAimRadius);
  const quiet = requiresMovement.filter(({ lane }) => !wave.lanes.includes(lane));
  // With three lanes the only quiet lane can already be defended. In that
  // case a pressured lane is preferable to an automatic reinforcement.
  const choices = quiet.length ? quiet : requiresMovement;
  if (!choices.length) throw new Error('Reward aim radius leaves no intentional lane choice');
  return (choices.find(({ lane }) => lane === wave.rewardLane) ?? choices[row % choices.length]).x;
}
