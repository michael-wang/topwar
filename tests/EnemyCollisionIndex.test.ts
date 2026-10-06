import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src/core/Rng';
import { EnemyCollisionIndex, type EnemyCandidateSource } from '../src/simulation/enemies/EnemyCollisionIndex';
import { findFirstHit, type CollisionDiagnostics } from '../src/simulation/Simulation';
import type { EnemySimulationState, ProjectileSimulationState,
  BossSimulationState, StreamRewardSimulationState, UpgradeGateSimulationState } from '../src/simulation/SimulationState';

const projectile = (x: number, z: number, hitRadiusBonus = 0,
  kind: 'rifle' | 'rocket' = 'rifle'): ProjectileSimulationState => ({
  id: 1, kind, tier: 3, x, z, speed: 30, damage: 10, remainingRange: 40,
  blastRadius: 0, hitRadiusBonus, penetrationRemaining: 100,
});
const enemy = (id: number, x: number, z: number): EnemySimulationState =>
  ({ id, tier: 1, x, z, hp: 10 });
const counters = (): CollisionDiagnostics => ({ findFirstHitCalls: 0,
  enemyCandidateChecks: 0, projectilePasses: 0, penetrationPasses: 0 });

// Reference source deliberately ignores query bounds and visits every active enemy.
function fullScan(enemies: EnemySimulationState[]): EnemyCandidateSource {
  return { forEachCandidate: (_minX, _maxX, _minZ, _maxZ, visit) => {
    for (const entry of enemies) visit(entry);
  } };
}

function hit(shot: ProjectileSimulationState, endZ: number, source: EnemyCandidateSource,
  options: { boss?: BossSimulationState | null; rewards?: StreamRewardSimulationState[];
    gates?: UpgradeGateSimulationState[]; minimumFraction?: number;
    pierced?: ReadonlySet<number>; diagnostics?: CollisionDiagnostics } = {}) {
  const result = findFirstHit(shot, endZ, source, options.boss ?? null,
    options.rewards ?? [], options.gates ?? [], .3, 1.5, 0, 0,
    options.minimumFraction ?? 0, options.pierced, options.diagnostics);
  if (!result) return null;
  return { kind: result.kind, id: result.kind === 'enemy' ? result.enemy.id
    : result.kind === 'boss' ? result.boss.id
      : result.kind === 'streamReward' ? result.reward.id : result.kind === 'gate' ? result.gate.id : 0,
  fraction: result.fraction, z: result.z };
}

describe('projectile enemy broad phase', () => {
  it('matches a full enemy scan across seeded layouts, X positions, radii, and misses', () => {
    for (const seed of [1, 17, 982451653]) {
      const rng = new SeededRng(seed);
      const enemies = Array.from({ length: 300 }, (_, index) => enemy(index + 1,
        (rng.nextFloat() - .5) * 12, rng.nextFloat() * 70));
      const indexed = new EnemyCollisionIndex(enemies);
      const reference = fullScan(enemies);
      for (const x of [-10, -4, -.3, 0, 2.5, 5, 10]) {
        for (const bonus of [0, .45, .9]) {
          for (const z of [0, 12, 34, 68]) {
            const shot = projectile(x, z, bonus);
            expect(hit(shot, z + 1.2, indexed)).toEqual(hit(shot, z + 1.2, reference));
          }
        }
      }
    }
    expect(hit(projectile(100, 0), 10, new EnemyCollisionIndex([enemy(1, 0, 5)])))
      .toBeNull();
    const boundary = [enemy(1, 1.2, 5), enemy(2, -1.2, 5)];
    expect(hit(projectile(0, 0, .9), 5, new EnemyCollisionIndex(boundary)))
      .toEqual(hit(projectile(0, 0, .9), 5, fullScan(boundary)));
  });

  it('preserves exact and near ties with enemies, Boss, rewards, and gates', () => {
    const enemies = [enemy(9, 0, 5), enemy(2, 0, 5), enemy(4, 0, 5 + 1e-10)];
    const indexed = new EnemyCollisionIndex(enemies);
    const reference = fullScan(enemies);
    const boss: BossSimulationState = { id: 12, tier: 1, x: 0, z: 5,
      hp: 100, maxHp: 100, engaged: true, slamCooldownRemainingSeconds: 1, slamCount: 0 };
    const rewards: StreamRewardSimulationState[] = [{ id: 7, tier: 1,
      x: 0, z: 5, hitProgress: 0, hitsRequired: 3 }];
    const gates: UpgradeGateSimulationState[] = [{ id: 'gate', x: 0, zOffset: 4.7,
      width: 1, hitProgress: 0, reward: { mode: 'hitPickup', kind: 'rifle',
        amount: 1, hitsRequired: 3, dropSpeed: 1 } }];
    const shot = projectile(0, 0);
    for (const options of [{}, { boss }, { rewards }, { gates }, { boss, rewards, gates }]) {
      expect(hit(shot, 10, indexed, options)).toEqual(hit(shot, 10, reference, options));
    }
    expect(hit(shot, 10, indexed)?.id).toBe(2);
    expect(hit(shot, 10, indexed, { rewards })?.kind).toBe('streamReward');
    expect(hit(shot, 10, indexed, { gates })?.kind).toBe('gate');
  });

  it('matches repeated penetration cursors and excludes enemies removed earlier in the step', () => {
    const original = [enemy(4, 0, 2), enemy(2, 0, 2), enemy(6, 0, 4),
      enemy(8, 0, 6), enemy(10, 3, 3)];
    const run = (useIndex: boolean) => {
      const enemies = original.map((entry) => ({ ...entry }));
      const index = new EnemyCollisionIndex(enemies);
      const source = useIndex ? index : fullScan(enemies);
      const sequence: (string | number)[] = [];
      for (const shot of [projectile(0, 0), projectile(0, 0)]) {
        let minimumFraction = 0;
        const pierced = new Set<number>();
        for (let pass = 0; pass < 5; pass++) {
          const result = findFirstHit(shot, 8, source, null, [], [], .3,
            undefined, 0, 0, minimumFraction, pierced);
          if (!result || result.kind !== 'enemy') break;
          sequence.push(result.enemy.id, result.fraction);
          pierced.add(result.enemy.id);
          minimumFraction = result.fraction;
          enemies.splice(enemies.indexOf(result.enemy), 1);
          index.remove(result.enemy);
        }
      }
      return { sequence, survivors: enemies.map((entry) => entry.id) };
    };
    expect(run(true)).toEqual(run(false));
    expect(run(true).sequence.filter((value) => typeof value === 'number' && Number.isInteger(value)))
      .toContain(2);
    const all = Array.from({ length: 400 }, (_, id) => enemy(id + 1, id % 2 ? 4 : 5, id));
    all.push(enemy(401, 0, 2));
    const diagnostics = counters();
    expect(hit(projectile(0, 0), 3, new EnemyCollisionIndex(all), { diagnostics })?.id).toBe(401);
    expect(diagnostics.enemyCandidateChecks).toBeLessThan(all.length / 4);
  });
});
