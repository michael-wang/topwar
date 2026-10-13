import { expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createAirSupportPlaytest } from '../src/app/TankPlaytest';
import { Simulation } from '../src/simulation/Simulation';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { enemyApproachSpeed } from '../src/simulation/enemies/latePressure';
import { supportTankBombZ } from '../src/simulation/commanderSupport';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 17, level, startSquad: 3, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
function raid(hp = 950, phase: 2 | 3 = 3, enemies = true) {
  const sim = createAirSupportPlaytest(options, config.weapon.rifle.fireRate), s = sim.getState();
  s.player.x = 0; s.player.selectedLane = 2;
  s.defenseTank!.hp = hp; s.defenseTank!.phase = phase;
  s.defenseTank!.nextAttackAtSeconds = s.defenseTank!.nextFlankAtSeconds = s.defenseTank!.nextGiantAtSeconds = 1000;
  s.weapons.rifleMemberCooldowns = Array(s.squad.count).fill(100); s.weapons.rifleCooldownRemainingSeconds = 100;
  s.artillery = { version: 1, nextId: 1, shells: [] };
  if (!enemies) s.enemies = [];
  sim.restoreState(s); return sim;
}
function step(sim: Simulation, ticks: number, t = tuning) {
  for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: sim.getState().player.x }, t);
}
function recover(sim: Simulation) {
  let stored: string | null = null;
  const storage = { getItem: () => stored, setItem: (_key: string, v: string) => { stored = v; }, removeItem: () => { stored = null; } };
  const cp: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense', savedAt: 1,
    build: 'last-stand', paused: true, hidden: false, reason: 'pause', fixture: 'air-support', config, level,
    tuning: defaultRuntimeTuning(config, level), state: sim.getState() };
  expect(writeCheckpoint(cp, storage).ok).toBe(true); const result = readCheckpoint(storage);
  expect(result.status).toBe('valid'); if (result.status !== 'valid') throw Error('Invalid last-stand checkpoint');
  return simulationFromCheckpoint(result.checkpoint);
}
it('authors the last stand in configuration and shares a playable Phase 3 fixture', () => {
  expect(config.catharsis!.commanderSupport!.heavyRaid!.lastStand).toEqual({ bossHpThreshold: 1000, etaSafetySeconds: 2, minimumBossHp: 150 });
  const sim = createAirSupportPlaytest(options, config.weapon.rifle.fireRate), s = sim.getState();
  expect(s.defenseTank).toMatchObject({ hp: 950, phase: 3, status: 'active' });
  expect(s.player.selectedLane).toBe(0); expect(s.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(6);
  step(sim, 1); expect(sim.getState().commanderSupport!.airstrike!.status).toBe('waiting');
});
it('never triggers in Phase 2 or during an unthreatened Phase 3 at 2000 HP', () => {
  const p2 = raid(4000, 2), s = p2.getState(); s.enemies.forEach(e => e.z = 6); p2.restoreState(s);
  step(p2, 1); expect(p2.getState().commanderSupport!.airstrike!.status).toBe('ready');
  const enteringP3 = p2.getState(); enteringP3.defenseTank!.phase = 3; enteringP3.defenseTank!.hp = 2000;
  p2.restoreState(enteringP3); step(p2, 1); expect(p2.getState().commanderSupport!.airstrike!.status).toBe('waiting');
  const p3 = raid(2000, 3, false); step(p3, 600);
  expect(p3.getState().commanderSupport!.airstrike!.status).toBe('ready');
});
it.each([1000, 900])('triggers at %i HP with no flank enemies', hp => {
  const sim = raid(hp, 3, false); step(sim, 1); const air = sim.getState().commanderSupport!.airstrike!;
  expect(air.status).toBe('waiting'); expect(air.bombAtSeconds! - air.triggeredAtSeconds!).toBe(7.5);
});
it.each([{ lane: 0, archetype: 'heavy' as const, speed: 1.4 }, { lane: 4, archetype: 'giant' as const, speed: 1.1 }])(
  'uses the actual defense line and stamped speed for a single $archetype on lane $lane', ({ lane, archetype, speed }) => {
    const sim = raid(2000, 3, false), s = sim.getState(), t = { ...tuning, defenseLineOffset: 5 };
    s.enemies = [{ id: s.enemyStream!.nextEnemyId++, tier: 1, lane, x: lane === 0 ? -2.85 : 2.85,
      archetype, hp: archetype === 'giant' ? config.catharsis!.giant.hp : config.catharsis!.heavyHp,
      z: s.player.z - t.defenseLineOffset + speed * 9.55, bossFlankSpeedUnitsPerSecond: speed }];
    expect(enemyApproachSpeed(s.enemies[0], config.catharsis!)).toBe(speed); sim.restoreState(s);
    step(sim, 1, t); expect(sim.getState().commanderSupport!.airstrike!.status).toBe('ready');
    step(sim, 3, t); expect(sim.getState().commanderSupport!.airstrike!.status).toBe('waiting');
  });
it('also uses ordinary/survival speed, and ignores Grunts and central lanes', () => {
  const sim = raid(2000, 3, false), s = sim.getState();
  s.enemies = [{ id: s.enemyStream!.nextEnemyId++, tier: 1, lane: 4, x: 2.85, archetype: 'heavy', hp: config.catharsis!.heavyHp,
    survivalSpeedMultiplier: 2, z: 30 }];
  const speed = enemyApproachSpeed(s.enemies[0], config.catharsis!);
  s.enemies[0].z = -tuning.defenseLineOffset + speed * 9.5; sim.restoreState(s); step(sim, 1);
  expect(sim.getState().commanderSupport!.airstrike!.status).toBe('waiting');
  const safe = raid(2000, 3, false), other = safe.getState();
  other.enemies = [{ id: other.enemyStream!.nextEnemyId++, tier: 1, lane: 0, x: -2.85, z: 3, archetype: 'grunt', hp: 1 },
    { id: other.enemyStream!.nextEnemyId++, tier: 1, lane: 2, x: 0, z: 3, archetype: 'heavy', hp: config.catharsis!.heavyHp }];
  safe.restoreState(other); step(safe, 1); expect(safe.getState().commanderSupport!.airstrike!.status).toBe('ready');
});
it.each([[900, 400], [600, 150], [300, 150], [100, 100]])('hits the Boss once: %i HP becomes %i, without player credit', (hp, remaining) => {
  const sim = raid(hp), before = sim.getState(); step(sim, 646);
  const s = sim.getState(), bombs = sim.consumeSupportEvents().filter(e => e.kind === 'supportBomb');
  expect(s.defenseTank).toMatchObject({ hp: remaining, phase: 3, status: 'active' });
  expect(s.commanderSupport!.airstrike!.status).toBe('completed');
  expect(bombs.map(e => e.tankDamage)).toEqual([0, 0, 0, hp - remaining, 0, 0]);
  expect(bombs[4].blasts[0].z).toBeGreaterThan(bombs[3].blasts[0].z);
  expect(bombs[5].blasts[0].z).toBeGreaterThan(bombs[4].blasts[0].z);
  expect(s.progression).toEqual(before.progression); expect(s.combatStats).toEqual(before.combatStats);
  expect(s.grenade).toEqual(before.grenade); expect(s.defenseTank!.nextFlankAtSeconds).toBe(before.defenseTank!.nextFlankAtSeconds);
  expect(s.enemies.filter(e => e.archetype === 'giant').every(e => e.hp <= config.catharsis!.giant.hp * .15 + 1e-8)).toBe(true);
  step(sim, 120); expect(sim.consumeSupportEvents()).toEqual([]);
});
it('directs bombs past a Tank already at the floor instead of displaying an undamaging direct hit', () => {
  const c = config.catharsis!.commanderSupport!;
  expect(supportTankBombZ(3, 38, 900, c)).toBe(38);
  expect(supportTankBombZ(3, 38, 150, c)).toBe(45);
  expect(supportTankBombZ(3, 38, 100, c)).toBe(45);
  expect(supportTankBombZ(4, 38, 900, c)).toBe(52); expect(supportTankBombZ(5, 38, 900, c)).toBe(66);
});
it.each([1, 451, 490, 529, 568, 607, 646])('restores the six-round clock at tick %i without repeating its single Tank hit', tick => {
  const sim = raid(); step(sim, tick); sim.consumeSupportEvents(); const copy = recover(sim);
  expect(copy.consumeSupportEvents()).toEqual([]); step(sim, 650 - tick); step(copy, 650 - tick);
  expect(copy.getState()).toEqual(sim.getState()); expect(copy.consumeSupportEvents()).toEqual(sim.consumeSupportEvents());
  expect(copy.getState().defenseTank!.hp).toBe(450);
});
it('lets normal player gunfire finish the 150 HP Tank and retains the existing clear boundary', () => {
  const sim = raid(300, 3, false); step(sim, 646); const s = sim.getState(); expect(s.defenseTank!.hp).toBe(150);
  s.weapons.rifleMemberCooldowns!.fill(0); s.weapons.rifleCooldownRemainingSeconds = 0; sim.restoreState(s); step(sim, 240);
  expect(sim.getState().defenseTank).toMatchObject({ hp: 0, status: 'defeated' });
  expect(sim.getState().combatStats!.shotsHit).toBeGreaterThan(0); expect(sim.getState().artillery!.shells).toEqual([]);
});
it('never adds pending support damage after the player kills the Tank or after Game Over', () => {
  for (const gameOver of [false, true]) {
    const sim = raid(900, 3, false); step(sim, 1); const s = sim.getState();
    if (gameOver) { s.squad.count = 0; s.squad.rifleCounts = []; s.weapons.rifleMemberCooldowns = []; }
    else { s.defenseTank!.hp = 1; s.weapons.rifleMemberCooldowns!.fill(0); s.weapons.rifleCooldownRemainingSeconds = 0; }
    sim.restoreState(s); step(sim, 650); expect(sim.consumeSupportEvents()).toEqual([]);
    expect(sim.getState().defenseTank!.hp).toBe(gameOver ? 900 : 0);
  }
});
