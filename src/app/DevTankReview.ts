import type { SimulationOptions, Simulation } from '../simulation/Simulation';
import { createTankPlaytest } from './TankPlaytest';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
export { createVictoryReview } from './TankPlaytest';

export type TankReviewFixture = 'boss-intro' | 'boss-phase1' | 'boss-phase2' | 'boss-phase3' | 'boss-finish' | 'boss-dense';
export const BOSS_TEST_PRESETS = {
  'boss-intro': { label: 'INTRO', hpFraction: 1 },
  'boss-phase1': { label: 'PHASE 1', hpFraction: 1 },
  'boss-phase2': { label: 'PHASE 2', hpFraction: .65 },
  'boss-phase3': { label: 'PHASE 3', hpFraction: .3 },
  'boss-finish': { label: 'FINISH', hpFraction: .02 },
} as const;

// Retained regression presets do not enter the closed-playtest bundle.
export function createTankReview(options: SimulationOptions, rate: number, role: TankReviewFixture): Simulation {
  if (role === 'boss-dense') return createDenseTankReview(options, rate);
  const preset = BOSS_TEST_PRESETS[role];
  if (!preset) throw Error('Invalid BOSS TEST preset');
  return createTankPlaytest(options, rate, role === 'boss-intro', preset.hpFraction);
}

// Fixed 67-member visual review, using the real Lv9 loadout, entrance and clocks.
// Ordered groups: front crowd, body path, beyond path, outer lanes, lateral edges.
function createDenseTankReview(options: SimulationOptions, rate: number): Simulation {
  const sim = createTankPlaytest(options, rate, true), s = sim.getState();
  const b = s.catharsis!.balance, c = b.defenseTank!;
  const lanes = attackLanePositions(b.laneCount, s.catharsis!.trackHalfWidth, b.edgeInset);
  const speed = s.enemies[0]?.survivalSpeedMultiplier;
  s.enemies = []; s.enemyStream!.nextEnemyId = 1;
  const add = (lane: number, z: number, x = lanes[lane]): void => {
    const id = s.enemyStream!.nextEnemyId++, archetype = id % 2 ? 'heavy' : 'grunt';
    s.enemies.push({ id, tier: 1, lane, x, z, archetype, hp: archetype === 'heavy' ? b.heavyHp : 1,
      ...(speed === undefined ? {} : { survivalSpeedMultiplier: speed }) });
  };
  for (let row = 0; row < 6; row++) for (let lane = 0; lane < 5; lane++)
    add(lane, c.battleZ - c.halfDepth - 8 - row * 1.4, lanes[lane] + (row % 2 ? .12 : -.12));
  for (const z of [c.battleZ + 6, c.startZ - 4, c.startZ]) for (const lane of [1,2,3]) add(lane,z);
  for (const z of [c.startZ + c.halfDepth + 5,c.startZ + c.halfDepth + 8])
    for (let lane = 0; lane < 5; lane++) add(lane,z);
  for (const z of [c.battleZ,c.battleZ+4,c.battleZ+8,c.startZ-2,c.startZ+2]) for (const lane of [0,4]) add(lane,z);
  for (const sign of [-1,1]) for (const z of [c.battleZ+8,c.startZ-2]) for (const margin of [-.05,.05])
    add(sign<0?0:4,z,sign*(c.halfWidth+options.tiers.normalEnemyRadius+margin));
  sim.restoreState(s); return sim;
}
