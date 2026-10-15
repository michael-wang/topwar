import { describe, expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { DefenseTankConfigSchema, type DefenseTankConfig } from '../src/config/defenseTankConfig';
import { startDefenseTank, tankSalvo, tankPhase, validateDefenseTank } from '../src/simulation/defenseTank';
import { makeArtilleryShell, type ArtilleryShell } from '../src/simulation/artillery';
import { SeededRng } from '../src/core/Rng';
import { Simulation } from '../src/simulation/Simulation';
import { createTankPlaytest } from '../src/app/TankPlaytest';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { personalArtilleryThreat } from '../src/presentation/ArtilleryEmergency';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const lanes = [-2.8, -1.4, 0, 1.4, 2.8];
type Mode = NonNullable<DefenseTankConfig['salvoPolicy']>['mode'];
const policy = (mode: Mode): NonNullable<DefenseTankConfig['salvoPolicy']> => ({ mode,
  cooldownSeconds: [{ min: 3.5, max: 5.5 }, { min: 2.5, max: 4.5 }, { min: 2.5, max: 6 }],
  gapSeconds: { min: .3, max: .6 } });
const tankConfig = (mode?: Mode) => DefenseTankConfigSchema.parse({ ...config.catharsis!.defenseTank,
  salvoPolicy: mode ? policy(mode) : undefined });

function fixture(mode: Mode = 'randomStaggered', phase: 1 | 2 | 3 = 3) {
  const balance = structuredClone(config.catharsis!); balance.defenseTank = tankConfig(mode);
  const sim = createTankPlaytest({ seed: 17, level, tiers: config.tiers, startSquad: 1, startRocketCount: 0,
    catharsis: { balance, trackHalfWidth: config.track.halfWidth } }, config.weapon.rifle.fireRate, false,
  phase === 1 ? 1 : phase === 2 ? .65 : .3);
  const s = sim.getState();
  // Isolate scheduling from unrelated player damage and flank contact in unit tests.
  s.defenseTank!.nextFlankAtSeconds = 1000; s.defenseTank!.nextGiantAtSeconds = 1000;
  s.weapons.rifleCooldownRemainingSeconds = 1000; s.weapons.rifleMemberCooldowns = [1000, 1000];
  sim.restoreState(s); return sim;
}
function step(sim: Simulation, count = 1) { for (let i = 0; i < count; i++) sim.step(1 / 60, { targetX: 0 }, tuning); }

// A small scheduler harness keeps player damage/phase changes out of the RNG comparison.
function schedule(mode: Mode | undefined, phase: 1 | 2 | 3, seed = 17) {
  const c = tankConfig(mode), tank = startDefenseTank(0, seed, c);
  tank.status = 'active'; tank.phase = phase; tank.hp = phase === 1 ? c.hp : phase === 2 ? c.hp * .65 : c.hp * .3;
  let now = c.entrySeconds, active: ArtilleryShell[] = [], nextId = 1;
  const launches: ArtilleryShell[][] = [], cooldowns: number[] = [], cooldownRng = new SeededRng(tank.rhythm?.cooldownRngState ?? 0);
  let volley: ArtilleryShell[] = [];
  for (let tick = 0; launches.length < 12 && tick < 20000; tick++, now += 1 / 60) {
    active = active.filter(s => s.impactAtSeconds > now);
    const resolving = tank.pendingImpactAtSeconds !== null && !active.length && !tank.rhythm?.pendingShots.length;
    const finalImpact = tank.pendingImpactAtSeconds;
    const targets = tankSalvo(tank, c, now, active, 12 - active.length, lanes, 0);
    if (resolving) {
      const duration = tank.nextAttackAtSeconds! - finalImpact!;
      cooldowns.push(duration);
      const range = c.salvoPolicy?.cooldownSeconds[phase - 1];
      expect(duration).toBeCloseTo(range ? range.min + cooldownRng.nextFloat() * (range.max - range.min) : c.phases[phase - 1].cooldownSeconds, 9);
      launches.push(volley); volley = [];
    }
    for (const targetLane of targets) {
      expect(active.every(s => volley.some(v => v.id === s.id))).toBe(true);
      const shell = makeArtilleryShell(nextId++, { source: { id: 'stage1-tank', type: 'defenseTank',
        position: { x: 0, y: 2.3, z: 35 } } }, targetLane, lanes, 0, now, c.flight, .588);
      active.push(shell); volley.push(shell);
      tank.pendingImpactAtSeconds = Math.max(tank.pendingImpactAtSeconds ?? 0, shell.impactAtSeconds);
    }
  }
  expect(launches).toHaveLength(12);
  return { launches, cooldowns, tank };
}

describe('opt-in random Tank rhythm', () => {
  it.each([1, 2, 3] as const)('phase %i preserves target draws and cooldown samples across A/B with no overlap', phase => {
    const a = schedule('randomSimultaneous', phase), b = schedule('randomStaggered', phase);
    expect(b.launches.map(v => v.map(s => s.targetLane))).toEqual(a.launches.map(v => v.map(s => s.targetLane)));
    b.cooldowns.forEach((d, i) => expect(d).toBeCloseTo(a.cooldowns[i], 8));
    expect(b.tank.rngState).toBe(a.tank.rngState);
    expect(b.tank.rhythm!.cooldownRngState).toBe(a.tank.rhythm!.cooldownRngState);
    for (const volley of b.launches) {
      expect(volley).toHaveLength(phase); expect(volley[0].targetLane).toBe(2);
      expect(new Set(volley.map(s => s.targetLane)).size).toBe(phase);
      for (let i = 1; i < phase; i++) {
        const gap = volley[i].launchedAtSeconds - volley[i - 1].launchedAtSeconds;
        expect(gap).toBeGreaterThanOrEqual(.3 - 1e-8); expect(gap).toBeLessThan(.6 + 1 / 60);
      }
    }
    expect(a.launches.every(v => v.every(s => s.launchedAtSeconds === v[0].launchedAtSeconds))).toBe(true);
    expect(schedule('randomStaggered', phase)).toEqual(b);
  });
  it('samples each gap independently, locks physical aim/count, and never catches up a delayed burst', () => {
    const c = tankConfig('randomStaggered'), tank = startDefenseTank(0, 17, c);
    tank.status = 'active'; tank.phase = 3;
    const gaps = new SeededRng(tank.rhythm!.gapRngState), first = .3 + gaps.nextFloat() * .3, second = .3 + gaps.nextFloat() * .3;
    expect(first).not.toBe(second);
    expect(tankSalvo(tank, c, 3, [], 2, lanes, .9)).toEqual([]); // Whole-volley admission.
    expect(tankSalvo(tank, c, 3, [], 3, lanes, .9)).toEqual([3]);
    const planned = structuredClone(tank.rhythm!.pendingShots);
    expect(planned[0].launchAtSeconds).toBeCloseTo(3 + first);
    expect(planned[1].launchAtSeconds).toBeCloseTo(3 + first + second);
    tank.phase = 1; // Later phase/player changes cannot replace locked shots.
    expect(tankSalvo(tank, c, 20, [], 0, lanes, -2.8)).toEqual([]);
    expect(tankSalvo(tank, c, 20, [], 1, lanes, -2.8)).toEqual([planned[0].targetLane]);
    expect(tankSalvo(tank, c, 20, [], 1, lanes, -2.8)).toEqual([]);
    expect(tank.rhythm!.pendingShots[0].launchAtSeconds).toBeCloseTo(20 + second);
    expect(tankSalvo(tank, c, 20 + second, [], 1, lanes, -2.8)).toEqual([planned[1].targetLane]);
  });
  it('uses phase at final resolution for cooldown, preserving historical fixed policies', () => {
    const c = tankConfig('randomStaggered'), tank = startDefenseTank(0, 17, c);
    tank.status = 'active'; tank.phase = 1;
    expect(tankSalvo(tank, c, 3, [], 3, lanes, 0)).toEqual([2]); tank.pendingImpactAtSeconds = 6;
    tank.phase = 3; const rng = new SeededRng(tank.rhythm!.cooldownRngState);
    expect(tankSalvo(tank, c, 6, [], 3, lanes, 0)).toEqual([]);
    expect(tank.nextAttackAtSeconds).toBeCloseTo(6 + 2.5 + rng.nextFloat() * 3.5);
    expect(config.catharsis!.defenseTank!.salvoPolicy).toEqual(policy('randomStaggered'));
    for (const phase of [1, 2, 3] as const) {
      const old = schedule(undefined, phase);
      expect(old.tank.rhythm).toBeUndefined();
      old.cooldowns.forEach(d => expect(d).toBeCloseTo([4, 3, 2][phase - 1]));
      expect(old.launches.every(v => v.length === phase && v.every(s => s.launchedAtSeconds === v[0].launchedAtSeconds))).toBe(true);
    }
  });
  it.each([1, 22, 50, 110, 230])('round-trips pending/airborne/cooldown tick %i without replay or RNG divergence', ticks => {
    const a = fixture(); step(a, ticks); a.consumeArtilleryEvents(); const saved = a.getState(), b = fixture();
    b.restoreState(JSON.parse(JSON.stringify(saved))); expect(b.getState()).toEqual(saved);
    expect(b.consumeArtilleryEvents()).toEqual([]);
    // Pause: no step advances any clock or pending lane; snapshots are independent.
    const snapshot = b.getState(); step(a, 1); expect(b.getState()).toEqual(snapshot);
    step(b, 1); expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents());
    for (let i = 0; i < 300; i++) { step(a); step(b); expect(b.consumeArtilleryEvents()).toEqual(a.consumeArtilleryEvents()); }
    expect(b.getState()).toEqual(a.getState());
  });
  it('launches real individual shells and warning deadlines, with no queued phantom warnings', () => {
    const sim = fixture(); step(sim); const initial = sim.getState(), first = initial.artillery!.shells[0];
    expect(initial.artillery!.shells).toHaveLength(1); expect(initial.defenseTank!.rhythm!.pendingShots).toHaveLength(2);
    const firstEvents = sim.consumeArtilleryEvents(); expect(firstEvents).toHaveLength(1);
    step(sim, 75); const s = sim.getState(), events = sim.consumeArtilleryEvents();
    const launched = events.filter(e => e.kind === 'artilleryLaunch'); expect(launched).toHaveLength(2);
    expect(s.artillery!.shells).toHaveLength(3);
    for (const shell of s.artillery!.shells) {
      expect(shell.impactAtSeconds - shell.launchedAtSeconds).toBeCloseTo(shell.flightSeconds);
      const state = structuredClone(s); state.player.x = shell.target.x;
      state.elapsedSeconds = shell.impactAtSeconds - .8 + 1e-8;
      expect(personalArtilleryThreat(state)?.id).toBe(shell.id);
      state.elapsedSeconds = shell.impactAtSeconds - .8 - 1e-8;
      expect(personalArtilleryThreat(state)).toBeUndefined();
    }
    expect(s.artillery!.shells[2].launchedAtSeconds).toBeGreaterThan(first.launchedAtSeconds + .6);
    expect(s.rngState).toBe(initial.rngState);
  });
  it.each([undefined, 1])('explicit cancellation (%s) clears delayed shots without replay after Restore', id => {
    const sim = fixture(); step(sim); sim.cancelArtillery(id); const saved = sim.getState(), copy = fixture(); copy.restoreState(saved);
    expect(saved.defenseTank!.rhythm!.pendingShots).toEqual([]); expect(saved.artillery!.shells).toEqual([]);
    sim.consumeArtilleryEvents(); step(sim, 140); step(copy, 140);
    expect(sim.consumeArtilleryEvents()).toEqual([]); expect(copy.consumeArtilleryEvents()).toEqual([]);
    expect(copy.getState()).toEqual(sim.getState());
  });
  it('retains locked targets across a mid-volley phase change, and samples the new phase only at resolution', () => {
    const sim = fixture('randomStaggered', 2); step(sim); const s = sim.getState();
    const locked = s.defenseTank!.rhythm!.pendingShots[0].targetLane;
    s.defenseTank!.hp = 1950; s.defenseTank!.phase = 3; sim.restoreState(s);
    sim.stepLane(-1); sim.stepLane(-1); step(sim, 50);
    const after = sim.getState();
    expect(after.artillery!.shells.map(s => s.targetLane)).toEqual([2, locked]);
    step(sim, 150); const tank = sim.getState().defenseTank!;
    const rng = new SeededRng(s.defenseTank!.rhythm!.cooldownRngState);
    expect(tank.nextAttackAtSeconds! - after.defenseTank!.pendingImpactAtSeconds!).toBeCloseTo(2.5 + rng.nextFloat() * 3.5);
  });
  it('keeps capacity-blocked pending shots restorable even after earlier shells resolve', () => {
    const c = tankConfig('randomStaggered'), tank = startDefenseTank(0, 17, c);
    tank.status = 'active'; tank.phase = 3; tank.hp = c.hp * .3;
    tankSalvo(tank, c, 3, [], 3, lanes, 0); tank.pendingImpactAtSeconds = 5.4;
    expect(tankSalvo(tank, c, 6, [], 0, lanes, 0)).toEqual([]);
    expect(validateDefenseTank(tank, c, 6, [])).toEqual(tank);
    expect(tankSalvo(tank, c, 6, [], 1, lanes, 0)).toHaveLength(1);
    expect(tankSalvo(tank, c, 6, [], 1, lanes, 0)).toEqual([]);
  });
  it('cancels the rest of a partially launched volley, but ignores cancellation of another source', () => {
    const sim = fixture(); step(sim);
    const id = sim.launchArtillery({ source: { id: 'other', type: 'destroyer', position: { x: 0, y: 2, z: 50 } }, targetLane: 0 })!;
    const before = sim.getState().defenseTank; sim.cancelArtillery(id);
    expect(sim.getState().defenseTank).toEqual(before);
    step(sim, 35); expect(sim.getState().artillery!.shells).toHaveLength(2);
    sim.cancelArtillery(1); const saved = sim.getState();
    expect(saved.defenseTank!.rhythm!.pendingShots).toEqual([]);
    expect(saved.artillery!.shells).toHaveLength(1);
    expect(saved.defenseTank!.nextAttackAtSeconds).toBeNull();
    const copy = fixture(); copy.restoreState(saved); step(sim, 120); step(copy, 120);
    expect(copy.getState()).toEqual(sim.getState());
    expect(copy.getState().artillery!.nextId).toBe(4); // No third Tank shot.
  });
  it('clears pending shots at defeat/Game Over and Retry recreates the original deterministic state', () => {
    for (const end of ['defeat', 'breach'] as const) {
      const sim = fixture(); step(sim); const s = sim.getState();
      if (end === 'defeat') {
        s.defenseTank!.hp = 1;
        s.grenade!.flight = { startX: 0, startZ: 0, targetX: 0, targetZ: s.defenseTank!.z,
          startedAtSeconds: s.elapsedSeconds, flightSeconds: 1 / 60, damageEnemyHp: 9, blastRadius: 4 };
      } else s.defenseTank!.z = s.catharsis!.balance.defenseTank!.halfDepth - tuning.defenseLineOffset;
      sim.restoreState(s); step(sim);
      const final = sim.getState(); expect(final.defenseTank!.rhythm!.pendingShots).toEqual([]);
      expect(final.artillery!.shells).toEqual([]); expect(final.defenseTank!.nextAttackAtSeconds).toBeNull();
      if (end === 'defeat') sim.restoreState(final);
      step(sim, 200); expect(sim.getState()).toEqual(final);
    }
    expect(fixture().getState()).toEqual(fixture().getState());
  });
  it('validates optional policy/state and rejects corrupt queues transactionally', () => {
    const sim = fixture(); step(sim); const s = sim.getState(), c = s.catharsis!.balance.defenseTank!;
    expect(validateDefenseTank(s.defenseTank, c, s.elapsedSeconds, s.artillery!.shells)).toEqual(s.defenseTank);
    for (const change of [(b: typeof s) => { delete b.defenseTank!.rhythm; },
      (b: typeof s) => { b.defenseTank!.rhythm!.pendingShots = [b.defenseTank!.rhythm!.pendingShots[0], b.defenseTank!.rhythm!.pendingShots[0]]; },
      (b: typeof s) => { delete b.catharsis!.balance.defenseTank!.salvoPolicy; }]) {
      const bad = structuredClone(s); change(bad); expect(() => sim.restoreState(bad)).toThrow(); expect(sim.getState()).toEqual(s);
    }
    expect(tankPhase(s.defenseTank!.hp, c)).toBe(3);
  });
});
