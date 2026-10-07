import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
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

it('restarts a deterministic Lv3 Grenade crowd with three fresh charges and no natural refill', () => {
  const make = () => createDevReviewFixture(options, c.weapon.rifle.fireRate, 'grenade');
  const sim = make(), initial = sim.getState();
  expect(initial).toEqual(createDevReviewFixture({ ...options, seed: 42 }, c.weapon.rifle.fireRate, 'grenade').getState());
  expect(initial.progression).toEqual({ level: 3, xp: 0 });
  expect(initial.squad).toMatchObject({ count: 1, rocketCount: 0, rifleCounts: [1] });
  expect(initial.player.selectedLane).toBe(2);
  expect(initial.grenade).toMatchObject({ inventory: 3, acquiredAtSeconds: 0, supply: null, flight: null });
  expect(initial.enemies.filter(e => e.archetype === 'grunt')).toHaveLength(45);
  expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(3);
  expect(new Set(initial.enemies.map(e => e.lane)).size).toBe(5);
  expect(initial.enemies.every(e => e.z >= 10 && e.z <= 18)).toBe(true);
  expect(initial.enemies.every(e => e.hp === (e.archetype === 'heavy' ? c.catharsis!.heavyHp : 1))).toBe(true);
  expect(initial.boss).toBeNull();expect(initial.giantEncounter!.spawned).toBe(false);
  expect(grenadeTarget(initial, c.catharsis!.grenade)).toBeDefined();
  sim.step(1/60, { targetX: 0, throwGrenade: true }, tuning);
  for (let i=0;i<120;i++) sim.step(1/60, { targetX: 0 }, tuning);
  expect(sim.getState().grenade!.inventory).toBe(2);
  expect(sim.getState().enemyStream!.nextEnemyId).toBe(initial.enemyStream!.nextEnemyId);
  expect(sim.getState().grenade!.supply).toBeNull();
  for (let i=0;i<3;i++) expect(make().getState()).toEqual(initial);
});

it('restarts the deterministic Lv6 MG fixture with one specialist, 60 Grunts and 5 Heavies',()=>{
 const make=()=>createDevReviewFixture(options,c.weapon.rifle.fireRate,'machineGun');
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
  const make = () => createDevReviewFixture(options, c.weapon.rifle.fireRate, 'evolve');
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
  expect(createDevReviewFixture({ ...options, seed: 42 }, c.weapon.rifle.fireRate, 'evolve').getState()).toEqual(initial);
  for (let i = 0; i < 3; i++) expect(make().getState()).toEqual(initial);
});

it('earns the EVOLVE upgrade from ten real Grunt kills within 1–3 seconds, with deterministic continuation', () => {
  const sim = createDevReviewFixture(options, c.weapon.rifle.fireRate, 'evolve');
  const initial = sim.getState();
  const restored = createDevReviewFixture(options, c.weapon.rifle.fireRate, 'evolve');
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
