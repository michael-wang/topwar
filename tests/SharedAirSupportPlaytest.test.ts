import {createAirSupportPlaytest} from '../src/app/TankPlaytest';
import { expect, it, vi } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { createPlaytestScenario } from '../src/app/PlaytestScenarios';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { PLAYTEST_ENTRIES } from '../src/app/PlaytestScenarios';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 17, level, startSquad: 1, startRocketCount: 0, tiers: config.tiers,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
it('shares one reproducible manual 3-MG battle, READY/called Restore and Retry in DEV and production', () => {
  const review={role:'air-support' as const,count:3,hp:2100};
  const initialOptions = structuredClone(options), make = () => createPlaytestScenario(options, config.weapon.rifle.fireRate, review.role);
  const sim = make(), initial = sim.getState(); expect(options).toEqual(initialOptions); expect(make().getState()).toEqual(initial);
  expect(initial.squad.count).toBe(review.count); expect(initial.progression!.level).toBe(review.count + 7);
  expect(initial.defenseTank).toMatchObject({ phase: 3, status: 'active', hp: review.hp });
  expect(initial.catharsis!.balance.defenseTank).toEqual(config.catharsis!.defenseTank);
  expect(initial.enemies.some(e => e.archetype === 'heavy')).toBe(true);
  expect(initial.commanderSupport!.airstrike!.manual).toBeUndefined();
  let copy: ReturnType<typeof make> | undefined, readySaved = false, calledSaved = false, tankBomb = 0, lethal = false;
  for (let tick = 0; tick < 1800 && sim.getState().defenseTank!.status !== 'defeated'; tick++) {
    const s = sim.getState(), danger = (s.artillery?.shells ?? []).filter(p => p.impactAtSeconds - s.elapsedSeconds < .65);
    const preferred = review.count === 5 ? 0 : 2;
    const target = [0, 1, 2, 3, 4].filter(l => !danger.some(p => p.targetLane === l)).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0];
    const manual = s.commanderSupport!.airstrike!.manual, call = !!manual?.ready && s.commanderSupport!.airstrike!.status === 'ready';
    for (const runner of copy ? [sim, copy] : [sim]) {
      if (target !== undefined && target !== s.player.selectedLane) runner.stepLane(target < s.player.selectedLane! ? -1 : 1);
      runner.step(1 / 60, { targetX: 0, supportNoticeStarted: true, supportNoticeComplete: true, callAirSupport: call }, tuning);
    }
    const events = sim.consumeSupportEvents(); if (copy) expect(copy.consumeSupportEvents()).toEqual(events);
    const next = sim.getState(), air = next.commanderSupport!.airstrike!;
    for (const e of events) if (e.kind === 'supportBomb' && e.tankDamage) { tankBomb += e.tankDamage; lethal ||= next.defenseTank!.status === 'defeated'; }
    expect(next.squad.count).toBe(review.count);
    if (air.manual?.ready && (!readySaved || air.status === 'waiting' && !calledSaved)) {
      readySaved = true; calledSaved ||= air.status === 'waiting';
      const c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense', savedAt: 1, build: 'manual-review',
        paused: true, hidden: false, reason: 'pause', fixture: review.role, config, level, tuning: defaultRuntimeTuning(config, level), state: next };
      let text: string | null = null; const storage = { getItem: () => text, setItem: (_k: string, v: string) => { text = v; }, removeItem: () => { text = null; } };
      writeCheckpoint(c, storage); const found = readCheckpoint(storage); expect(found.status).toBe('valid');
      if (found.status !== 'valid') throw Error('Invalid manual review'); copy = simulationFromCheckpoint(found.checkpoint);
      expect(copy.consumeSupportEvents()).toEqual([]); expect(copy.getState()).toEqual(next);
      vi.stubEnv('DEV', false); try { expect(readCheckpoint(storage).status).toBe('valid'); } finally { vi.unstubAllEnvs(); }
    }
  }
  expect(readySaved && calledSaved).toBe(true); expect(tankBomb).toBeGreaterThan(0); expect(tankBomb).toBeLessThanOrEqual(500);
  expect(lethal).toBe(false);
  expect(sim.getState().defenseTank!.status).toBe('defeated'); expect(copy!.getState()).toEqual(sim.getState()); expect(make().getState()).toEqual(initial);
});
it('retains four shared entries, shipping manual configuration and the unrelated dense review', () => {
  expect(config.catharsis!.commanderSupport!.heavyRaid!.lastStand!.triggerPolicy).toBe('manualPlayerCall');
  expect(PLAYTEST_ENTRIES.map(e => e.role)).toEqual(['naval', 'boss-intro', 'victory', 'air-support']);
  expect(createDevReviewFixture(options, 27, 'boss-dense').getState().enemies).toHaveLength(67);
});

it.each(['bossHpBySquad','bossHpOnly',undefined] as const)('restores historical shared support under its saved %s policy in production',policy=>{
  const historical=structuredClone(config),last=historical.catharsis!.commanderSupport!.heavyRaid!.lastStand!;
  if(policy===undefined)delete last.triggerPolicy;else last.triggerPolicy=policy;
  if(policy==='bossHpBySquad')last.livingMgHpThresholds=[750,750,1200,1600,2000];else delete last.livingMgHpThresholds;
  const sim=createAirSupportPlaytest({...options,catharsis:{...options.catharsis,balance:historical.catharsis!}},historical.weapon.rifle.fireRate);
  for(const waiting of [false,true]){
    if(waiting)sim.step(1/60,{targetX:sim.getState().player.x},tuning);
    const state=sim.getState(),c:SessionCheckpoint={version:1,simulationContract:1,game:'topwar',mode:'defense',savedAt:1,build:'historical-shared',paused:true,hidden:false,reason:'pause',fixture:'air-support',config:historical,level,tuning:defaultRuntimeTuning(historical,level),state};
    let text:string|null=null;const storage={getItem:()=>text,setItem:(_k:string,v:string)=>{text=v;},removeItem:()=>{text=null;}};
    vi.stubEnv('DEV',false);try{writeCheckpoint(c,storage);const found=readCheckpoint(storage);expect(found.status).toBe('valid');if(found.status!=='valid')throw Error('Invalid historical shared review');
      const copy=simulationFromCheckpoint(found.checkpoint);expect(copy.getState()).toEqual(state);expect(copy.getState().squad.count).toBe(2);expect(copy.getState().catharsis!.balance.commanderSupport!.heavyRaid!.lastStand!.triggerPolicy).toBe(policy);expect(copy.getState().commanderSupport!.airstrike!.manual).toBeUndefined();
    }finally{vi.unstubAllEnvs();}
  }
});
