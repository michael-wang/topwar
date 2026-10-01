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
  const lanes = rng.nextFloat() < config.secondLaneChance ? [primary, secondary] : [primary];
  const compositionRng = new SeededRng((seed ^ Math.imul(waveIndex + 1, 0x85ebca6b)) >>> 0);
  const heavy = compositionRng.nextFloat() < config.heavyChance;
  const quiet = Array.from({ length: config.laneCount }, (_, lane) => lane).filter((lane) => !lanes.includes(lane));
  return { lanes, heavy, rewardLane: quiet[compositionRng.nextInt(quiet.length)] };
}

export function laneCompositionForRow(row: number, seed: number, config: CatharsisConfig, halfWidth: number):
  { x: number; z: number; archetype: 'grunt' | 'heavy'; lane?: number }[] {
  const wave = laneWave(Math.floor(row / config.waveRows), seed, config);
  const slot = row % config.waveRows;
  if (config.defenseMode) {
    if (slot !== 0) return [];
    const positions = attackLanePositions(config.laneCount, halfWidth, config.edgeInset);
    const spacing = positions[1] - positions[0];
    const rng = new SeededRng((seed ^ Math.imul(row + 1, 0xc2b2ae35)) >>> 0);
    return Array.from({ length: config.groupSize }, (_, member) => {
      const lane = wave.lanes[member % wave.lanes.length];
      const localMember = Math.floor(member / wave.lanes.length);
      const lateral = (localMember % 2 === 0 ? -1 : 1)
        * spacing * config.lateralSpreadFraction * (.55 + rng.nextFloat() * .45);
      return { lane, x: Math.max(positions[0], Math.min(positions.at(-1)!, positions[lane] + lateral)),
        z: Math.floor(localMember / 2) * config.memberDepthSpacing + (rng.nextFloat() * 2 - 1) * config.depthJitter,
        archetype: member === 0 && wave.heavy ? 'heavy' as const : 'grunt' as const };
    });
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
