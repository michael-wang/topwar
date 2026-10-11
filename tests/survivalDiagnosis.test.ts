import { describe, expect, it } from 'vitest';
import { SurvivalDiagnosis } from '../scripts/qa/survivalDiagnosis';
import { survivalSimulation } from '../scripts/qa/survivalPilot';
import { enemyApproachSpeed } from '../src/simulation/enemies/latePressure';

function fixture(level: 'lv7' | 'lv10' = 'lv7') {
  const state = survivalSimulation(1, level).getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 38, hp: 15 }];
  state.enemyStream!.nextEnemyId = 2;
  const copy = structuredClone(state), collector = new SurvivalDiagnosis(state);
  return { state, collector, copy };
}
describe('QA-only Survival cohort accounting', () => {
  it('uses actual speed and retains censored theoretical arrivals after an immediate kill', () => {
    const { state, collector } = fixture();
    collector.begin(state);
    const e = state.enemies[0];
    collector.hit(e, 15, 'projectile');
    collector.reward(e, 10, { level: 7, xp: 0 }, { level: 7, xp: 10 });
    collector.removed(e, 'projectile');
    const result = collector.finish(state), c = result.cohorts[0];
    expect(c.mgHits).toBe(15);
    expect(c.nominalXp).toBe(10);
    expect(c.arrivals[20].firstAt).toBeCloseTo(18 / enemyApproachSpeed(e, state.catharsis!.balance));
    expect(c.arrivals[20].firstLoadout).toBeNull();
    expect(c.arrivals[20].censored).toBe(true);
    expect(c.combatCleared).toBe(true);
  });
  it('records same-tick admissions even when absent from the final enemy array', () => {
    const { state, collector } = fixture();
    collector.begin(state); collector.phase('survival-wave');
    const enemy = { ...state.enemies[0], id: 2, archetype: 'grunt' as const, hp: 1, z: 40 };
    collector.admitted([enemy], { row: 12, cursor: 7 });
    collector.reward(enemy, 1, { level: 7, xp: 0 }, { level: 7, xp: 1 });
    collector.removed(enemy, 'projectile');
    const c = collector.finish(state).cohorts[1];
    expect(c.ids).toEqual([2]); expect(c.nominalXp).toBe(1);
    expect(c.clearedAt).toBe(c.at); expect(c.row).toBe(12);
  });
  it('accounts XP across a level reset from reward grants', () => {
    const { state, collector } = fixture();
    collector.reward(state.enemies[0], 10, { level: 7, xp: 299 }, { level: 8, xp: 9 });
    collector.removed(state.enemies[0], 'grenade');
    expect(collector.finish(state).usableXp).toBe(10);
    expect(collector.finish(state).cohorts[0].deaths.grenade).toBe(1);
  });
  it('separates nominal cap rewards from usable progression XP', () => {
    const { state, collector } = fixture('lv10');
    collector.reward(state.enemies[0], 10, { level: 10, xp: 0 }, { level: 10, xp: 0 });
    collector.removed(state.enemies[0], 'projectile');
    expect(collector.finish(state).nominalXp).toBe(10);
    expect(collector.finish(state).usableXp).toBe(0);
  });
  it('gives contacts and leaks no XP or combat clear credit', () => {
    for (const cause of ['contact', 'leak']) {
      const { state, collector } = fixture(); collector.removed(state.enemies[0], cause);
      const r = collector.finish(state);
      expect(r.nominalXp).toBe(0); expect(r.usableXp).toBe(0); expect(r.cohorts[0].combatCleared).toBe(false);
    }
  });
  it('counts each distance boundary once with HP at its first live crossing', () => {
    const { state, collector } = fixture();
    collector.begin(state);
    const enemy = { ...state.enemies[0], z: 29.9, hp: 9 };
    collector.positions([enemy]); collector.positions([{ ...enemy, hp: 3 }]);
    const c = collector.finish(state).cohorts[0];
    expect(c.crossings[30]).toEqual({ count: 1, hp: 9 });
    expect(c.crossings[20]).toEqual({ count: 0, hp: 0 });
  });
  it('does not mutate observed state or enemy objects', () => {
    const { state, collector, copy } = fixture();
    collector.begin(state); collector.positions(state.enemies); collector.finish(state);
    expect(state).toEqual(copy);
  });
  it('fails loudly on duplicate admission or unattributed kills', () => {
    const { state, collector } = fixture();
    expect(() => collector.admitted(state.enemies, {})).toThrow('Duplicate admitted ID');
    expect(() => collector.removed(state.enemies[0], 'projectile')).toThrow('Missing kill reward');
  });
});
