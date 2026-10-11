import { expect,it } from 'vitest';
import { SurvivalPressureDiagnosis } from '../scripts/qa/survivalPressureDiagnosis';
import { makeRun } from '../scripts/qa/survivalPressureRun';

it('captures upgrade HP debt and actual engagement without mutating state, marking incomplete windows',()=>{
  const s=makeRun(17,'lv8','ahead').getState(),copy=structuredClone(s),d=new SurvivalPressureDiagnosis(s);
  d.begin(s);d.hit(s.enemies[0],1,'projectile');
  const next=structuredClone(s);next.elapsedSeconds=1/60;next.progression!.level=9;
  d.end(next,s,[]);
  const r=d.finish(next);
  expect(s).toEqual(copy);expect(r.engagements[0]).toMatchObject({id:s.enemies[0].id,level:8,xp:0});
  expect(r.upgrades[0].windows.map(w=>w.offset)).toEqual([-1/60,0]);
  expect(r.upgrades[0].censoredOffsets).toEqual([5,10,20]);
  expect(r.upgrades[0].windows[0].hp).toBe(196);
  const later=structuredClone(next);later.elapsedSeconds+=5;d.begin(next);d.end(later,next,[]);
  expect(d.finish(later).upgrades[0].windows.map(w=>w.offset)).toEqual([-1/60,0,5]);
});
