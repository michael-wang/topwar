import { expect, it } from 'vitest';
import { runPilot } from '../scripts/qa/DefensePilot';
import config from './helpers/ShippingConfig';

it('observes the real opening cohort without Grenades or modifying the old pilot default', () => {
  const r = runPilot(17, false, false, true, 2, false, config.catharsis!, { openingCohort: true });
  expect(r.initialEnemies).toBe(16); expect(r.milestones[2]).toBeGreaterThan(0);
  expect(r.levelPressure[1].nearestDefenseDistance).toBeGreaterThan(10);
  expect(r.levelPressure[1].nearDefenseCount).toBe(0); expect(r.levelPressure[1].casualties).toBe(0);
  expect(r.activation).toBeNull();
});

it('replays the seeded hesitation pilot and logs authoritative blast XP, lane debt and clocks',()=>{
  const first=runPilot(17,true,true),second=runPilot(17,true,true);
  expect(second).toEqual(first);
  expect(first.supplySpawn!-first.milestones[3]).toBeCloseTo(8);
  expect(first.detonation!-first.activation!).toBeCloseTo(.65);
  expect(first.grenadeKillXp).toBe(first.grenadeVictims.reduce((sum,v)=>sum+v.killXp,0));
  expect(first.beforeBlast!.rifleHitDebt).toHaveLength(5);
  expect(first.afterBlast!.rifleHitDebt.reduce((a,b)=>a+b,0)).toBeLessThan(first.beforeBlast!.rifleHitDebt.reduce((a,b)=>a+b,0));
  expect(first.hesitationStart).not.toBeNull();expect(first.hesitationEnd).not.toBeNull();
});
