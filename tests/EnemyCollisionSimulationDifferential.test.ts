import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeededRng } from '../src/core/Rng';
import configData from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import type { EnemySimulationState, ProjectileSimulationState } from '../src/simulation/SimulationState';

const config = GameConfigSchema.parse(configData);
const level: LevelDefinition = { id: 'differential', length: 1000,
  enemyGroups: [], upgradeGates: [] };

afterEach(() => {
  vi.doUnmock('../src/simulation/enemies/EnemyCollisionIndex');
  vi.resetModules();
});

describe('simulation with indexed projectile collision', () => {
  it('matches an unindexed full-scan simulation over seeded multi-projectile steps', async () => {
    const { Simulation: IndexedSimulation } = await import('../src/simulation/Simulation');
    vi.resetModules();
    vi.doMock('../src/simulation/enemies/EnemyCollisionIndex', () => ({
      EnemyCollisionIndex: class {
        constructor(private readonly enemies: EnemySimulationState[]) {}
        forEachCandidate(_minX: number, _maxX: number, _minZ: number, _maxZ: number,
          visit: (enemy: EnemySimulationState) => void): void {
          for (const enemy of this.enemies) visit(enemy);
        }
        remove(): void { /* The reference scans the mutable enemies array. */ }
      },
    }));
    const { Simulation: FullScanSimulation } = await import('../src/simulation/Simulation');
    const tuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3,
      defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22,
      normalEnemyRadius: .3, bossRadius: config.bosses.basic.radius,
      rifle: { ...config.weapon.rifle, fireRate: .01 },
      rocket: { ...config.weapon.rocket, fireRate: .01 } };
    for (const seed of [3, 97, 4103]) {
      const options = { seed, level, startSquad: 1, startRocketCount: 0,
        tiers: config.tiers, catharsis: { balance: { ...config.catharsis!, gruntSpeed: 0, heavySpeed: 0, defenseWaves: { ...config.catharsis!.defenseWaves, firstWaveDelaySeconds: 1000 } }, trackHalfWidth: 3.2 } };
      const indexed = new IndexedSimulation(options);
      const fullScan = new FullScanSimulation(options);
      const rng = new SeededRng(seed);
      const initial = indexed.getState();
      initial.enemies = Array.from({ length: 120 }, (_, index): EnemySimulationState => ({
        id: index + 1, tier: 1, lane: 2, archetype: index % 5 === 0 ? 'heavy' : 'grunt',
        x: (rng.nextFloat() - .5) * 5,
        z: 2 + rng.nextFloat() * 22,
        hp: index % 5 === 0 ? 15 : 1,
      }));
      initial.projectiles = Array.from({ length: 8 }, (_, index): ProjectileSimulationState => ({
        id: index + 1, kind: index % 2 ? 'machineGun' : 'rifle',
        tier: 1, lane: 2, slopeX: 0, x: (rng.nextFloat() - .5) * 4,
        z: 0, speed: 30, damage: 3, remainingRange: 35,
        blastRadius: 0,
        hitRadiusBonus: 0,
        penetrationRemaining: 0,
      }));
      initial.weapons.nextProjectileId = 9;
      initial.weapons.rifleCooldownRemainingSeconds = 100;
      initial.weapons.rocketCooldownRemainingSeconds = 100;
      indexed.restoreState(initial);
      fullScan.restoreState(initial);
      for (let step = 0; step < 12; step++) {
        indexed.step(1 / 20, { targetX: 0 }, tuning);
        fullScan.step(1 / 20, { targetX: 0 }, tuning);
        expect(indexed.getState()).toEqual(fullScan.getState());
      }
    }

    const options = { seed: 19, level, startSquad: 1, startRocketCount: 0,
      tiers: config.tiers, catharsis: { balance: { ...config.catharsis!, gruntSpeed: 0, heavySpeed: 0, defenseWaves: { ...config.catharsis!.defenseWaves, firstWaveDelaySeconds: 1000 } }, trackHalfWidth: 3.2 } };
    const indexed = new IndexedSimulation(options);
    const fullScan = new FullScanSimulation(options);
    const initial = indexed.getState();
    initial.enemies = [{ id: 1, tier: 1, lane: 2, archetype: 'grunt', x: 0, z: 2, hp: 1 },
      { id: 2, tier: 1, lane: 2, archetype: 'grunt', x: 0, z: 2, hp: 1 }];
    initial.projectiles = [
      { id: 1, kind: 'machineGun', tier: 1, lane: 2, slopeX: 0, x: 0, z: 0, speed: 30,
        damage: 20, remainingRange: 30, blastRadius: 0,
        hitRadiusBonus: 0, penetrationRemaining: 0 },
      { id: 2, kind: 'rifle', tier: 1, lane: 2, slopeX: 0, x: 0, z: 0, speed: 30,
        damage: 10, remainingRange: 30, blastRadius: 0,
        hitRadiusBonus: 0, penetrationRemaining: 0 },
    ];
    initial.weapons.nextProjectileId = 3;
    initial.weapons.rifleCooldownRemainingSeconds = 100;
    initial.weapons.rocketCooldownRemainingSeconds = 100;
    indexed.restoreState(initial);
    fullScan.restoreState(initial);
    indexed.step(.1, { targetX: 0 }, tuning);
    fullScan.step(.1, { targetX: 0 }, tuning);
    expect(indexed.getState()).toEqual(fullScan.getState());
    expect(indexed.getState().enemies).toEqual([]);
    expect(indexed.getState().projectiles).toEqual([]);
  });
});
