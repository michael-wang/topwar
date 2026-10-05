import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createEnemyVfxLab, ENEMY_VFX_LAB } from '../src/app/EnemyVfxLab';
import { effectiveRifleFireRate } from '../src/simulation/progression';

const c = GameConfigSchema.parse(gameData), level = LevelDefinitionSchema.parse(levelData);
const options = { seed: 19, level, startSquad: c.player.startSquad,
  startRocketCount: c.player.startRocketCount, tiers: c.tiers,
  catharsis: { trackHalfWidth: c.track.halfWidth, balance: c.catharsis! } };
const tuning = { moveSpeed: c.player.moveSpeed, forwardSpeed: c.player.forwardSpeed,
  trackHalfWidth: c.track.halfWidth, defenseLineOffset: c.track.defenseLineOffset,
  formationSpacing: c.player.formationSpacing, memberRadius: c.player.memberRadius,
  normalEnemyRadius: c.tiers.normalEnemyRadius, bossRadius: c.bosses.basic.radius,
  rifle: c.weapon.rifle, rocket: c.weapon.rocket };

it.each(['grunt', 'heavy', 'giant'] as const)('creates deterministic validated %s fixtures using real HP and weapon tuning', role => {
  const sim = createEnemyVfxLab(options, c.weapon.rifle.fireRate, role), state = sim.getState();
  expect(state).toEqual(createEnemyVfxLab({ ...options, seed: 99 }, c.weapon.rifle.fireRate, role).getState());
  const fixture = ENEMY_VFX_LAB[role];
  expect(state.progression).toEqual({ level: fixture.level, xp: 0 });
  expect(state.squad.count).toBe(fixture.soldiers);
  expect(state.squad.rifleCounts).toEqual([fixture.soldiers]);
  expect(state.squad.rocketCount).toBe(0);
  expect(state.catharsis!.balance).toEqual(c.catharsis);
  expect(state.enemies.map(e => e.z)).toEqual(fixture.depths);
  expect(state.enemies.every(e => e.archetype === role && e.lane === state.player.selectedLane && e.x === state.player.x)).toBe(true);
  const hp = role === 'giant' ? c.catharsis!.giant.hp : role === 'heavy' ? c.catharsis!.heavyHp : 1;
  expect(state.enemies.every(e => e.hp === hp)).toBe(true);
  expect(state.giantEncounter!.spawned).toBe(role === 'giant');
  expect(state.enemyStream!.nextRowIndex * level.enemyStream!.spacing + level.enemyStream!.startZ)
    .toBeGreaterThan(c.catharsis!.defenseSpawnAheadDistance);
  const interval = 1 / effectiveRifleFireRate(c.weapon.rifle.fireRate, fixture.level, c.catharsis!.progression);
  expect(state.weapons.rifleMemberCooldowns).toEqual(Array.from({ length: fixture.soldiers }, (_, i) => i * interval / fixture.soldiers));
  expect(Object.keys(state).some(key => /lab|debug/i.test(key))).toBe(false);
  // Real combat kills every fixture without natural refill or debug damage.
  const cursor = state.enemyStream!.nextEnemyId;
  for (let i = 0; i < 60 * 35; i++) sim.step(1 / 60, { targetX: state.player.x }, tuning);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().squad.count).toBe(fixture.soldiers);
  expect(sim.getState().enemyStream!.nextEnemyId).toBe(cursor);
  expect(createEnemyVfxLab(options, c.weapon.rifle.fireRate, role).getState()).toEqual(state);
});

it('keeps the Grunt fixture below its next level threshold', () => {
  expect(ENEMY_VFX_LAB.grunt.depths.length * c.catharsis!.progression.gruntKillXp)
    .toBeLessThan(c.catharsis!.progression.xpRequirements[0]);
});
