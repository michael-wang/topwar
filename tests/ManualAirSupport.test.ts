import { expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createAirSupportPlaytest } from '../src/app/TankPlaytest';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { advanceCommanderSupport, supportBossHpThreshold, supportTankBombZ, validateCommanderSupport } from '../src/simulation/commanderSupport';
import type { ManualSupportInput, SupportBombEvent } from '../src/simulation/commanderSupport';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
function fixture(hp = 100) {
  const balance = structuredClone(config.catharsis!), last = balance.commanderSupport!.heavyRaid!.lastStand!;
  last.triggerPolicy = 'manualPlayerCall'; delete last.livingMgHpThresholds;
  const sim = createAirSupportPlaytest({ seed: 17, level, tiers: config.tiers, startSquad: 1, startRocketCount: 0,
    catharsis: { balance, trackHalfWidth: config.track.halfWidth } }, config.weapon.rifle.fireRate);
  const s = sim.getState(); s.defenseTank!.hp = hp; s.enemies = [];
  s.defenseTank!.nextAttackAtSeconds = 1000; s.defenseTank!.nextFlankAtSeconds = 1000; s.defenseTank!.nextGiantAtSeconds = 1000;
  s.weapons.rifleCooldownRemainingSeconds = 1000; s.weapons.rifleMemberCooldowns = [1000, 1000];
  sim.restoreState(s); return sim;
}
function step(sim: ReturnType<typeof fixture>, ticks = 1, input: ManualSupportInput = {}) {
  for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0, ...input }, tuning);
}
function ready(sim: ReturnType<typeof fixture>) {
  step(sim, 1, { supportNoticeStarted: true }); step(sim, 184, { supportNoticeComplete: true });
  expect(sim.getState().commanderSupport!.airstrike!.manual!.ready).toBe(true);
}
it('makes support available only in Phase 3 after entry/naval guards, without HP or ETA eligibility', () => {
  const sim = fixture(), s = sim.getState(), c = s.catharsis!.balance.commanderSupport!;
  const update = () => advanceCommanderSupport(s, c, s.commanderSupport!, -3);
  s.defenseTank!.hp = 4000; s.defenseTank!.phase = 2; update(); expect(s.commanderSupport!.airstrike!.manual).toBeUndefined();
  s.defenseTank!.hp = 2100; s.defenseTank!.phase = 3; s.defenseTank!.startedAtSeconds = s.elapsedSeconds - 5.49;
  update(); expect(s.commanderSupport!.airstrike!.manual).toBeUndefined();
  s.defenseTank!.startedAtSeconds -= .02; s.destroyer!.startedAtSeconds = s.elapsedSeconds;
  update(); expect(s.commanderSupport!.airstrike!.manual).toBeUndefined();
  s.destroyer!.startedAtSeconds = 0; update(); const manual = structuredClone(s.commanderSupport!.airstrike!.manual);
  expect(manual).toMatchObject({ availableAtSeconds: s.elapsedSeconds, announcementAtSeconds: null, ready: false });
  update(); expect(s.commanderSupport!.airstrike!.manual).toEqual(manual);
  expect(supportBossHpThreshold(c, 5)).toBeUndefined();
});
it('does not consume premature calls and never auto-triggers even at 1 HP after the announcement', () => {
  const sim = fixture(1); step(sim, 1, { callAirSupport: true, supportNoticeComplete: true });
  expect(sim.getState().commanderSupport!.airstrike!.triggeredAtSeconds).toBeNull(); ready(sim);
  step(sim, 600); expect(sim.getState().commanderSupport!.airstrike).toMatchObject({ status: 'ready', triggeredAtSeconds: null, bombAtSeconds: null });
  step(sim, 1, { callAirSupport: true }); const air = sim.getState().commanderSupport!.airstrike!;
  expect(air.status).toBe('waiting'); expect(air.bombAtSeconds! - air.triggeredAtSeconds!).toBe(7.5);
  step(sim, 30, { callAirSupport: true }); expect(sim.getState().commanderSupport!.airstrike!.triggeredAtSeconds).toBe(air.triggeredAtSeconds);
});
it.each([1, 100, 150, 500, 900])('manual raid applies real Tank damage at %i HP, preserving stats and normal defeat', hp => {
  const sim = fixture(hp); ready(sim); const before = sim.getState(); step(sim, 1, { callAirSupport: true });
  const called = sim.getState(), events: SupportBombEvent[] = [];
  for (let i = 0; i < 660 && sim.getState().defenseTank!.status !== 'defeated'; i++) {
    step(sim); events.push(...sim.consumeSupportEvents().filter((e): e is SupportBombEvent => e.kind === 'supportBomb'));
  }
  const after = sim.getState(), tankBomb = events.find(e => e.index === 3)!;
  expect(tankBomb.tankDamage).toBe(Math.min(500, hp)); expect(tankBomb.blasts[0].z).toBeGreaterThan(0);
  expect(after.defenseTank!.hp).toBe(Math.max(0, hp - 500));
  expect(after.combatStats).toEqual(before.combatStats); expect(after.progression).toEqual(before.progression);
  expect(events[0].index).toBe(0); expect(called.commanderSupport!.airstrike!.bombAtSeconds! - called.elapsedSeconds).toBe(7.5);
  if (hp <= 500) {
    expect(after.defenseTank!.status).toBe('defeated'); expect(after.defenseTank!.defeatedAtSeconds! - called.elapsedSeconds).toBeCloseTo(9.45);
    expect(events.map(e => e.index)).toEqual([0, 1, 2, 3]); expect(after.artillery?.shells ?? []).toEqual([]);
    sim.restoreState(after); step(sim, 120); expect(sim.getState()).toEqual(after);
  } else { expect(events).toHaveLength(6); expect(after.commanderSupport!.airstrike!.status).toBe('completed'); }
  const c = after.catharsis!.balance.commanderSupport!;
  expect(supportTankBombZ(3, 38, hp, c)).toBe(38); expect(supportTankBombZ(4, 38, hp, c)).toBe(52);
});
it('allows the player to win without ever calling support', () => {
  const sim = fixture(1); ready(sim); const s = sim.getState();
  s.player.x = 0; s.player.selectedLane = 2;
  s.projectiles = [{ id: s.weapons.nextProjectileId++, kind: 'machineGun', tier: 1, x: 0, z: s.defenseTank!.z - 4,
    speed: 600, lane: 2, slopeX: 0, memberIndex: 0, damage: config.tiers.tier1Power, remainingRange: 30, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 }];
  s.combatStats!.shotsFired++; sim.restoreState(s); step(sim);
  expect(sim.getState().defenseTank!.status).toBe('defeated'); expect(sim.getState().commanderSupport!.airstrike!.triggeredAtSeconds).toBeNull();
});
it.each(['announcement', 'ready', 'called', 'completed', 'cancelled'] as const)('persists %s through the real checkpoint path without repeated events', stage => {
  const sim = fixture(900); step(sim, 1, { supportNoticeStarted: true });
  if (stage !== 'announcement') ready(sim);
  if (stage === 'called' || stage === 'completed' || stage === 'cancelled') step(sim, 1, { callAirSupport: true });
  if (stage === 'completed') step(sim, 660);
  if (stage === 'cancelled') {
    const s = sim.getState(); s.commanderSupport!.airstrike!.status = 'cancelled'; sim.restoreState(s);
  }
  const s = sim.getState(), c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
    savedAt: 1, build: 'manual', paused: true, hidden: false, reason: 'pause', fixture: null, config,
    level, tuning: defaultRuntimeTuning(config, level), state: s };
  let text: string | null = null; const storage = { getItem: () => text, setItem: (_k: string, v: string) => { text = v; }, removeItem: () => { text = null; } };
  writeCheckpoint(c, storage); const result = readCheckpoint(storage); expect(result.status).toBe('valid');
  if (result.status !== 'valid') throw Error('Invalid manual checkpoint'); const copy = simulationFromCheckpoint(result.checkpoint);
  expect(copy.getState()).toEqual(s); expect(copy.consumeSupportEvents()).toEqual([]); sim.consumeSupportEvents();
  for (let i = 0; i < 90; i++) { step(sim); step(copy); expect(copy.consumeSupportEvents()).toEqual(sim.consumeSupportEvents()); }
  expect(copy.getState()).toEqual(sim.getState());
  expect(() => validateCommanderSupport({ ...s.commanderSupport, airstrike: { ...s.commanderSupport!.airstrike,
    manual: { ...s.commanderSupport!.airstrike!.manual, availableAtSeconds: s.elapsedSeconds + 1 } } }, s.catharsis!.balance.commanderSupport, s.elapsedSeconds)).toThrow();
});
