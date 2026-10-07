import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createEnemyVfxLab, ENEMY_VFX_LAB } from '../src/app/EnemyVfxLab';
import { effectiveRifleFireRate } from '../src/simulation/progression';
import { grenadeTarget } from '../src/simulation/grenade';

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

it('restarts a deterministic Lv3 Grenade crowd with a fresh charge and no natural refill', () => {
  const make = () => createEnemyVfxLab(options, c.weapon.rifle.fireRate, 'grenade');
  const sim = make(), initial = sim.getState();
  expect(initial).toEqual(createEnemyVfxLab({ ...options, seed: 42 }, c.weapon.rifle.fireRate, 'grenade').getState());
  expect(initial.progression).toEqual({ level: 3, xp: 0 });
  expect(initial.squad).toMatchObject({ count: 1, rocketCount: 0, rifleCounts: [1] });
  expect(initial.player.selectedLane).toBe(2);
  expect(initial.grenade).toMatchObject({ inventory: 1, acquiredAtSeconds: 0, supply: null, flight: null });
  expect(initial.enemies.filter(e => e.archetype === 'grunt')).toHaveLength(45);
  expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(3);
  expect(new Set(initial.enemies.map(e => e.lane)).size).toBe(5);
  expect(initial.enemies.every(e => e.z >= 10 && e.z <= 18)).toBe(true);
  expect(initial.enemies.every(e => e.hp === (e.archetype === 'heavy' ? c.catharsis!.heavyHp : 1))).toBe(true);
  expect(initial.boss).toBeNull();expect(initial.giantEncounter!.spawned).toBe(false);
  expect(grenadeTarget(initial, c.catharsis!.grenade)).toBeDefined();
  sim.step(1/60, { targetX: 0, throwGrenade: true }, tuning);
  for (let i=0;i<120;i++) sim.step(1/60, { targetX: 0 }, tuning);
  expect(sim.getState().grenade!.inventory).toBe(0);
  expect(sim.getState().enemyStream!.nextEnemyId).toBe(initial.enemyStream!.nextEnemyId);
  expect(sim.getState().grenade!.supply).toBeNull();
  for (let i=0;i<3;i++) expect(make().getState()).toEqual(initial);
});

it('restarts the deterministic Lv6 MG fixture with one specialist, 60 Grunts and 5 Heavies',()=>{
 const make=()=>createEnemyVfxLab(options,c.weapon.rifle.fireRate,'machineGun');
 const sim=make(),s=sim.getState();expect(s.progression).toEqual({level:6,xp:0});
 expect(s.squad).toMatchObject({count:1,rocketCount:0,rifleCounts:[1]});expect(s.player.selectedLane).toBe(2);
 expect(s.enemies.filter(e=>e.archetype==='grunt')).toHaveLength(60);expect(s.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(5);
 expect(new Set(s.enemies.map(e=>e.lane)).size).toBe(5);expect(s.enemies.every(e=>e.z>=8&&e.z<=24)).toBe(true);
 expect(s.enemies.every(e=>e.hp===(e.archetype==='heavy'?15:1))).toBe(true);expect(s.boss).toBeNull();expect(s.grenade!.inventory).toBe(0);
 for(let i=0;i<300;i++)sim.step(1/60,{targetX:0},tuning);
 expect(sim.getState().enemyStream!.nextEnemyId).toBe(s.enemyStream!.nextEnemyId);
 expect(sim.getState().enemies.filter(e=>e.lane===2)).toHaveLength(0);
 expect(sim.getState().giantEncounter!.scheduledAtSeconds).toBe(0);
 for(let i=0;i<3;i++)expect(make().getState()).toEqual(s);
});

it('restarts EVOLVE at 210/220 XP with three Rifles and a deterministic ordinary crowd', () => {
  const make = () => createEnemyVfxLab(options, c.weapon.rifle.fireRate, 'evolve');
  const initial = make().getState();
  expect(initial.progression).toEqual({ level: 5, xp: 210 });
  expect(initial.squad).toMatchObject({ count: 3, rifleCounts: [3], rocketCount: 0 });
  expect(initial.player.selectedLane).toBe(2);
  expect(initial.enemies.filter(e => e.archetype === 'grunt')).toHaveLength(18);
  expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(2);
  expect(initial.enemies.filter(e => e.archetype === 'grunt' && e.lane === 2)).toHaveLength(12);
  expect(new Set(initial.enemies.map(e => e.lane)).size).toBe(5);
  expect(initial.enemies.every(e => e.hp === (e.archetype === 'heavy' ? c.catharsis!.heavyHp : 1))).toBe(true);
  expect(initial.boss).toBeNull();
  expect(initial.grenade).toMatchObject({ inventory: 0, supply: null, flight: null });
  expect(initial.giantEncounter).toEqual({ scheduledAtSeconds: 0, spawned: true });
  expect(createEnemyVfxLab({ ...options, seed: 42 }, c.weapon.rifle.fireRate, 'evolve').getState()).toEqual(initial);
  for (let i = 0; i < 3; i++) expect(make().getState()).toEqual(initial);
});

it('earns the EVOLVE upgrade from ten real Grunt kills within 1–3 seconds, with deterministic continuation', () => {
  const sim = createEnemyVfxLab(options, c.weapon.rifle.fireRate, 'evolve');
  const initial = sim.getState();
  const restored = createEnemyVfxLab(options, c.weapon.rifle.fireRate, 'evolve');
  let ticks = 0;
  while (sim.getState().progression!.level === 5 && ticks < 180) {
    expect(sim.getState().squad.count).toBe(3);
    sim.step(1 / 60, { targetX: 0 }, tuning);
    restored.step(1 / 60, { targetX: 0 }, tuning);
    ticks++;
    if (ticks === 30) restored.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  }
  const evolved = sim.getState();
  expect(ticks / 60).toBeGreaterThanOrEqual(1);
  expect(ticks / 60).toBeLessThanOrEqual(3);
  expect(evolved.progression).toEqual({ level: 6, xp: 0 });
  expect(evolved.squad.count).toBe(1);
  expect(evolved.enemies.filter(e => e.archetype === 'grunt' && e.id <= 18)).toHaveLength(8);
  expect(sim.consumePresentationEvents()).toEqual([]);
  expect(restored.getState()).toEqual(evolved);
  restored.restoreState(JSON.parse(JSON.stringify(evolved)));
  for (let i = 0; i < 60; i++) {
    sim.step(1 / 60, { targetX: 0 }, tuning);
    restored.step(1 / 60, { targetX: 0 }, tuning);
  }
  expect(restored.getState()).toEqual(sim.getState());
  expect(sim.getState().projectiles.some(p => p.kind === 'machineGun')).toBe(true);
  expect(sim.getState().enemyStream!.nextEnemyId).toBe(initial.enemyStream!.nextEnemyId + 60);
  expect(sim.getState().giantEncounter!.scheduledAtSeconds).toBe(0);
});
