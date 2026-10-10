import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createShellReview, shellReviewLaunches, SHELL_REVIEW_SOURCE } from './helpers/ShellReview';
import { sampleArtillery, artilleryHits, effectiveArtilleryLane } from '../src/simulation/artillery';
import { attackLanePositions } from '../src/simulation/enemies/laneComposition';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import type { Simulation } from '../src/simulation/Simulation';

const config = GameConfigSchema.parse(data);
const make = () => createShellReview({ seed: 11, level: LevelDefinitionSchema.parse(levelData),
  startSquad: 1, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } });
const lanes = attackLanePositions(5, config.track.halfWidth, config.catharsis!.edgeInset);
const launch = (sim: Simulation, z = 52) => sim.launchArtillery({ source: { ...SHELL_REVIEW_SOURCE,
  position: { ...SHELL_REVIEW_SOURCE.position, z } } });
function advance(sim: Simulation, seconds: number) {
  const until = sim.getState().elapsedSeconds + seconds;
  while (sim.getFrameState().elapsedSeconds < until - 1e-10 && sim.getFrameState().squad.count)
    sim.step(Math.min(1 / 60, until - sim.getFrameState().elapsedSeconds), { targetX: 0 }, pilotTuning);
}

it('solves deterministic distance-dependent ballistic arcs with exact source/ground endpoints', () => {
  const a = make(), b = make(); launch(a); launch(b);
  expect(a.getState()).toEqual(b.getState());
  const shell = a.getState().artillery!.shells[0];
  expect(shell.flightSeconds).toBeGreaterThanOrEqual(1.8); expect(shell.flightSeconds).toBeLessThanOrEqual(2.5);
  expect(sampleArtillery(shell, shell.launchedAtSeconds)).toEqual(shell.source.position);
  const end = sampleArtillery(shell, shell.impactAtSeconds);
  expect(end.x).toBeCloseTo(shell.target.x); expect(end.y).toBeCloseTo(0); expect(end.z).toBeCloseTo(0);
  const mid = sampleArtillery(shell, shell.launchedAtSeconds + shell.flightSeconds / 2);
  expect(mid.y).toBeGreaterThan(shell.source.position.y);
  expect(sampleArtillery(shell, shell.impactAtSeconds - .05).y).toBeGreaterThan(end.y);
  const short = make(); launch(short, 8); expect(short.getState().artillery!.shells[0].flightSeconds).toBe(.5);
});

it.each([0, 1, 2, 3, 4])('locks lane %i from physical position, with adjacent-lane safety', lane => {
  const sim = make(), state = sim.getState(); state.player = { x: lanes[lane], z: 0, selectedLane: lane }; sim.restoreState(state);
  launch(sim); const shell = sim.getState().artillery!.shells[0];
  expect(shell.targetLane).toBe(lane); expect(shell.target.x).toBe(lanes[lane]);
  expect(artilleryHits(shell, lanes[lane], 0)).toBe(true);
  for (let other = 0; other < 5; other++) if (other !== lane) expect(artilleryHits(shell, lanes[other], 0)).toBe(false);
  sim.stepLane(lane === 4 ? -1 : 1); advance(sim, shell.flightSeconds + .1);
  expect(sim.getState().squad.count).toBe(3);
  expect(sim.consumeArtilleryEvents().at(-1)).toMatchObject({ kind: 'artilleryImpact', hit: false, x: lanes[lane] });
});

it('targets interpolated position rather than a newly selected lane, and never tracks afterward', () => {
  const sim = make(); sim.stepLane(1); advance(sim, .025);
  expect(sim.getState().player.selectedLane).toBe(3); expect(effectiveArtilleryLane(sim.getState().player.x, lanes)).toBe(2);
  launch(sim); const shell = sim.getState().artillery!.shells[0]; expect(shell.targetLane).toBe(2);
  advance(sim, .1); expect(sim.getState().artillery!.shells[0]).toEqual(shell);
  sim.stepLane(-1); advance(sim, shell.flightSeconds);
  expect(sim.getState().squad.count).toBe(2); // Returning before impact is dangerous again.
});

it.each([[.04, 2], [.09, 3]])('samples movement %.2fs before impact, not selectedLane or end-of-step position', (lead, count) => {
  const sim = make(); launch(sim);
  advance(sim, sim.getState().artillery!.shells[0].impactAtSeconds - lead);
  sim.stepLane(1); sim.step(.2, { targetX: 0 }, pilotTuning);
  expect(sim.getState().player.x).toBe(lanes[3]); expect(sim.getState().squad.count).toBe(count);
});

it('has identical impact results with coarse and fine steps across a lane arrival', () => {
  const a = make(); launch(a); advance(a, a.getState().artillery!.shells[0].impactAtSeconds - .04);
  a.stepLane(1); const b = make(); b.restoreState(a.getState());
  a.step(.2, { targetX: 0 }, pilotTuning); advance(b, .2);
  expect(a.getState().squad).toEqual(b.getState().squad);
});

it('resolves one casualty once and preserves each surviving MG firing clock', () => {
  const sim = make(), control = make(); launch(sim);
  advance(sim, sim.getState().artillery!.shells[0].impactAtSeconds - .01);
  const saved = sim.getState(); control.restoreState(saved); control.cancelArtillery();
  sim.step(1 / 60, { targetX: 0 }, pilotTuning); control.step(1 / 60, { targetX: 0 }, pilotTuning);
  expect(sim.getState().squad.count).toBe(2);
  expect(sim.getState().weapons.rifleMemberCooldowns).toEqual(control.getState().weapons.rifleMemberCooldowns!.slice(1));
  expect(sim.consumePresentationEvents()).toMatchObject([{ kind: 'artilleryContact', affectedMembers: [{ index: 0 }] }]);
  advance(sim, 1); expect(sim.getState().squad.count).toBe(2); expect(sim.getState().artillery!.shells).toEqual([]);
});

it('orders concurrent impacts by time then ID, with no invulnerability and no ghost shells after death', () => {
  const sim = make(); launch(sim); launch(sim, 8); launch(sim, 8);
  advance(sim, .6); expect(sim.getState().squad.count).toBe(1);
  expect(sim.consumeArtilleryEvents().filter(e => e.kind === 'artilleryImpact').map(e => e.id)).toEqual([2, 3]);
  launch(sim, 60); advance(sim, 3);
  expect(sim.getState().squad.count).toBe(0); expect(sim.getState().artillery!.shells).toEqual([]);
  const dead = sim.getState(); advance(sim, 10); expect(sim.getState()).toEqual(dead); expect(launch(sim)).toBeNull();
});

it('restores a mid-flight snapshot exactly, suppresses past event replay and resumes deterministic scheduling', () => {
  const a = make();
  for (let i = 0; i < 100; i++) a.step(1 / 60, { targetX: 0, artilleryLaunches: shellReviewLaunches(a.getFrameState()) }, pilotTuning);
  const snapshot = JSON.parse(JSON.stringify(a.getState())), b = make(); b.restoreState(snapshot);
  expect(b.consumeArtilleryEvents()).toEqual([]); expect(b.getState()).toEqual(snapshot);
  a.consumeArtilleryEvents();
  for (let i = 0; i < 150; i++) for (const sim of [a, b]) sim.step(1 / 60,
    { targetX: 0, artilleryLaunches: shellReviewLaunches(sim.getFrameState()) }, pilotTuning);
  expect(a.getState()).toEqual(b.getState()); expect(a.consumeArtilleryEvents()).toEqual(b.consumeArtilleryEvents());
  expect(make().getState().artillery).toEqual({ version: 1, nextId: 1, shells: [] });
});

it.each([6, 8])('accepts historical Lv%i snapshots without artillery fields/configuration', level => {
  const sim = make(), s = sim.getState(); delete s.artillery; delete s.catharsis!.balance.artillery;
  s.progression = { level, xp: 0 }; const living = level - 5;
  s.squad = { count: living, rifleCounts: [living], rocketCount: 0, rifleRemainder: 0 };
  s.weapons.rifleMemberCooldowns = Array(living).fill(0);
  if (level === 6) { s.catharsis!.balance.progression.levelPlan = s.catharsis!.balance.progression.levelPlan.slice(0, 6);
    s.catharsis!.balance.progression.xpRequirements = s.catharsis!.balance.progression.xpRequirements.slice(0, 5); }
  sim.restoreState(s); expect(sim.getState().artillery).toBeUndefined(); advance(sim, 10); expect(sim.getState().artillery).toBeUndefined();
});

it('rejects malformed, duplicate, expired or geometrically inconsistent shell snapshots atomically', () => {
  const sim = make(); launch(sim); const valid = sim.getState();
  const mutations = [
    (s: typeof valid) => s.artillery!.shells.push(s.artillery!.shells[0]),
    (s: typeof valid) => s.artillery!.nextId = 1,
    (s: typeof valid) => s.artillery!.shells[0].target.x += .1,
    (s: typeof valid) => s.artillery!.shells[0].flightSeconds += 1,
    (s: typeof valid) => s.artillery!.shells[0].impactAtSeconds = 0,
    (s: typeof valid) => s.artillery!.shells[0].launchedAtSeconds = 1,
    (s: typeof valid) => s.artillery!.shells[0].radius = 1.4,
  ];
  for (const mutate of mutations) { const bad = structuredClone(valid); mutate(bad);
    expect(() => sim.restoreState(bad)).toThrow(); expect(sim.getState()).toEqual(valid); }
});

it('bounds active shells and cancels individual targets without applying damage', () => {
  const sim = make(); for (let i = 0; i < 8; i++) expect(launch(sim)).toBe(i + 1);
  expect(launch(sim)).toBeNull(); sim.cancelArtillery(3); expect(sim.getState().artillery!.shells.map(s => s.id)).not.toContain(3);
  sim.cancelArtillery(); advance(sim, 4); expect(sim.getState().squad.count).toBe(3);
});

it('keeps the SHELL test isolated indefinitely and demonstrates overlapping real shots after single shots', () => {
  const sim = make(); let peak = 0;
  for (let i = 0; i < 3600; i++) {
    const s = sim.getState();
    const threat = s.artillery!.shells.find(shell => shell.targetLane === s.player.selectedLane);
    if (threat) sim.stepLane(s.player.selectedLane === 4 ? -1 : 1);
    sim.step(1 / 60, { targetX: 0, artilleryLaunches: shellReviewLaunches(sim.getFrameState()) }, pilotTuning);
    peak = Math.max(peak, sim.getState().artillery!.shells.length);
  }
  const s = sim.getState(); expect(s.squad.count).toBe(3); expect(peak).toBe(2);
  expect(s.enemies).toEqual([]); expect(s.enemyStream).toBeNull(); expect(s.grenade!.supply).toBeNull();
  expect(s.carnival!.status).not.toBe('active'); expect(s.postCapSurvival!.startedAtSeconds).toBeNull();
});
