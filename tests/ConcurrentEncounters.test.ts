import { expect, it } from 'vitest';
import historical from './fixtures/sequential-encounters.json';
import { carnivalEntry, carnivalOptions, carnivalPilotLane } from '../scripts/qa/carnivalPilot';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import { Simulation } from '../src/simulation/Simulation';
import { runDifficultyPilot } from '../scripts/qa/difficultyPilot';

const advance = (s: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    const f = s.getFrameState();
    if (f.tick % 12 === 0) {
      const lane = carnivalPilotLane(f);
      if (lane !== f.player.selectedLane) s.stepLane(lane < f.player.selectedLane! ? -1 : 1);
    }
    s.step(1 / 60, { targetX: 0 }, pilotTuning);
    s.consumePresentationEvents(); s.consumeGrenadeEvents();
  }
};

// Actual natural seed-17 states captured at canonical 83afed8, before edits.
// Their serialized balance and absent start policy remain authoritative.
it.each(Object.entries(historical))('loads historical sequential %s without retroactive entrance or shots', (_, saved) => {
  const a = new Simulation(carnivalOptions), b = new Simulation(carnivalOptions);
  a.restoreState(JSON.parse(JSON.stringify(saved))); b.restoreState(JSON.parse(JSON.stringify(saved)));
  expect(a.getState().catharsis!.balance.destroyer!.startPolicy).toBe('afterCarnival');
  expect(a.getState().catharsis!.balance.giant.unlockLevel).toBe(5);
  expect(a.consumeArtilleryEvents()).toEqual([]);
  const start = saved.carnival.startedAtSeconds! + 24;
  advance(a, 60 * 60); advance(b, 60 * 60);
  expect(a.getState()).toEqual(b.getState());
  const launches = a.consumeArtilleryEvents().filter(e => e.kind === 'artilleryLaunch');
  expect(launches).toEqual(b.consumeArtilleryEvents().filter(e => e.kind === 'artilleryLaunch'));
  const expected = [8.8, 12, 16, 17.3, 21].map(t => t + start).filter(t => t > saved.elapsedSeconds + 1e-8);
  expect(launches).toHaveLength(expected.length);
  launches.forEach((e, i) => expect(e.shell.launchedAtSeconds).toBeCloseTo(expected[i], 7));
  expect(a.getState().destroyer!.startedAtSeconds).toBeCloseTo(start, 7);
  expect(a.getState().postCapSurvival!.startedAtSeconds).toBeCloseTo(start + 27, 7);
});

it.each([1, 120, 529, 721, 961, 1039, 1261, 1441, 1621])('replays overlapping clocks at tick %i without duplicated events', tick => {
  const a = carnivalEntry(); advance(a, tick); a.consumeArtilleryEvents();
  const saved = a.getState(), b = carnivalEntry(); b.restoreState(JSON.parse(JSON.stringify(saved)));
  advance(a, 180); advance(b, 180);
  expect(b.getState()).toEqual(a.getState());
  expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
});

it('rejects mismatched overlapping starts, absent entrances, replayed shots and premature Survival atomically', () => {
  const s = carnivalEntry(); advance(s, 180); const good = s.getState();
  for (const change of [
    (v: typeof good) => v.destroyer!.startedAtSeconds = 0,
    (v: typeof good) => v.catharsis!.balance.destroyer!.startPolicy = 'afterCarnival',
    (v: typeof good) => v.destroyer = { status: 'pending', startedAtSeconds: null, nextShotIndex: 0 },
    (v: typeof good) => v.destroyer!.nextShotIndex = 1,
    (v: typeof good) => v.carnival!.nextWaveIndex = 0,
    (v: typeof good) => v.carnival!.nextWaveIndex = 999,
    (v: typeof good) => v.postCapSurvival = { startedAtSeconds: 1, nextGiantAtSeconds: 25, nextGrenadeSupplyAtSeconds: 31 },
  ]) {
    const bad = structuredClone(good); change(bad);
    expect(() => s.restoreState(bad)).toThrow(); expect(s.getState()).toEqual(good);
  }
});

it('a real shell can kill the sole Lv6 specialist during Carnival and its Game Over snapshot remains loadable', () => {
  const a = carnivalEntry();
  for (let i = 0; i < 60 * 14 && a.getFrameState().squad.count; i++) a.step(1 / 60, { targetX: 0 }, pilotTuning);
  const dead = a.getState(); expect(dead.squad.count).toBe(0); expect(dead.carnival!.status).toBe('active');
  const b = carnivalEntry(); b.restoreState(JSON.parse(JSON.stringify(dead))); expect(b.getState()).toEqual(dead);
  advance(a, 120); advance(b, 120); expect(a.getState()).toEqual(dead); expect(b.getState()).toEqual(dead);
});

it('rejects a backdated Survival clock even after both authored encounters complete', () => {
  const s = carnivalEntry(); advance(s, 60 * 28); const good = s.getState();
  expect(good.destroyer!.status).toBe('complete');
  const bad = structuredClone(good); bad.postCapSurvival!.startedAtSeconds = 1;
  expect(() => s.restoreState(bad)).toThrow('Survival clock'); expect(s.getState()).toEqual(good);
});

it.each([1, 17, 42, 99, 2026])('keeps natural progression and five real artillery opportunities deterministic for seed %i', seed => {
  const { stepMs: _, ...a } = runDifficultyPilot(seed);
  const { stepMs: __, ...b } = runDifficultyPilot(seed);
  expect(a).toEqual(b);
  expect(a.giants[0].spawn).toBe(a.levels[4]); expect(a.giants[0].hp).toBe(172);
  expect(a.entrance).toBe(a.release); expect(a.shells).toHaveLength(5);
  a.shells.forEach((s, i) => expect(s.time - a.release!).toBeCloseTo([8.8, 12, 16, 17.3, 21][i], 7));
  expect(a.carnivalEnd! - a.release!).toBeCloseTo(24, 7);
  expect(a.destroyerEnd! - a.release!).toBeCloseTo(27, 7);
  expect(a.survivalStart).toBe(a.destroyerEnd);
  expect(a.waves.filter(w => w.carnival && !w.release).every(w => w.heavy === 0 && w.population <= 36)).toBe(true);
  expect(a.final.level!.level).toBe(8);
}, 30000);
