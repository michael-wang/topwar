import { describe, expect, it } from 'vitest';
import game from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { CHECKPOINT_KEY, checkpointPresent, clearCheckpoint, MAX_CHECKPOINT_CHARACTERS, readCheckpoint,
  simulationFromCheckpoint, writeCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { pilotTuning } from '../scripts/qa/p15Pilot';
import historical from './fixtures/old-survival.json';
import { survivalDecision } from '../scripts/qa/survivalPilot';
import { createQaStressFixture, advanceQaPreparation, qaSimulationTuning } from '../src/app/QaStressFixture';

const config = GameConfigSchema.parse(game), level = LevelDefinitionSchema.parse(levelData);
function storage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, text: string) => { entries.set(key, text); }, removeItem: (key: string) => { entries.delete(key); } };
}
function checkpoint(fixture: 'survival10-ahead' | 'survival10-staged' | 'survival10-experimental' | 'survival10-baseline' | 'crate3' | 'naval' | 'barrage10-on' | 'barrage10-off' = 'survival10-ahead') {
  const sim = createDevReviewFixture({ seed: 17, level, startSquad: 1, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } },
  config.weapon.rifle.fireRate, fixture);
  for (let i = 0; i < 110; i++) sim.step(1 / 60, { targetX: 0, ...(i === 90 ? { throwGrenade: true } : {}) }, pilotTuning);
  sim.consumeArtilleryEvents(); // Already-presented cues are never replayed by recovery.
  const state = sim.getState();
  const c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
    savedAt: 1, build: 'baseline', paused: true, hidden: true, reason: 'hidden', fixture,
    config, level: state.enemyStream ? level : { ...level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] },
    tuning: defaultRuntimeTuning(config, level), state };
  return { sim, c };
}
describe('durable checkpoint', () => {
  it.each([4,20,50,100,1000,Number.MAX_SAFE_INTEGER])('recovers exact inventory %i and deterministic in-flight continuation',inventory=>{
    const {sim,c}=checkpoint(),state=sim.getState();state.grenade!.inventory=inventory;sim.restoreState(state);
    const store=storage(),saved={...c,state:sim.getState()};expect(writeCheckpoint(saved,store).ok).toBe(true);
    const found=readCheckpoint(store);expect(found.status).toBe('valid');if(found.status!=='valid')throw Error(found.status);
    const restored=simulationFromCheckpoint(found.checkpoint);expect(restored.getState()).toEqual(sim.getState());
    expect(restored.consumeGrenadeEvents()).toEqual([]);
    for(let i=0;i<120;i++){const input={targetX:0};sim.step(1/60,input,pilotTuning);restored.step(1/60,input,pilotTuning);}
    expect(restored.getState()).toEqual(sim.getState());
  });
  it('accepts only narrowly scoped QA metadata after full authoritative validation', () => {
    const tuning=qaSimulationTuning(config), sim=createQaStressFixture({seed:42,level,startSquad:1,startRocketCount:0,
      tiers:config.tiers,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},tuning);
    for(let i=0;i<5400;i++)if(advanceQaPreparation(sim,tuning,i))break;
    const {c}=checkpoint(),store=storage(),save:SessionCheckpoint={...c,fixture:null,state:sim.getState(),
      qa:{version:1,kind:'sleep-lv10',armed:true}};
    expect(writeCheckpoint(save,store).ok).toBe(true);const found=readCheckpoint(store);
    expect(found.status).toBe('valid');if(found.status!=='valid')throw Error(found.status);
    const restored=simulationFromCheckpoint(found.checkpoint);expect(restored.getState()).toEqual(sim.getState());
    expect(restored.consumeArtilleryEvents()).toEqual([]);
    for(let i=0;i<120;i++){const input={targetX:0};sim.step(1/60,input,tuning);restored.step(1/60,input,tuning);}
    expect(restored.getState()).toEqual(sim.getState());
    for(const bad of [{...save,qa:{...save.qa,version:2}},{...save,qa:{...save.qa,kind:'arbitrary'}},
      {...save,fixture:'late'},{...save,state:{...save.state,rngState:-1}},{...c,qa:save.qa}]){
      store.setItem(CHECKPOINT_KEY,JSON.stringify(bad));expect(readCheckpoint(store).status).toBe('invalid');}
  });
  it('detects presence without parsing, mutation or rejecting corrupt pending data', () => {
    const store = storage(); expect(checkpointPresent(store)).toBe(false);
    store.setItem(CHECKPOINT_KEY, '{'); expect(checkpointPresent(store)).toBe(true);
    expect(store.getItem(CHECKPOINT_KEY)).toBe('{');
    expect(checkpointPresent(null)).toBe(false);
    expect(checkpointPresent({ ...store, getItem() { throw Error('Denied'); } })).toBe(false);
  });
  it.each(['survival10-ahead', 'naval'] as const)('preserves %s opportunities/artillery across seventy seconds of real continued combat', fixture => {
    const { sim, c } = checkpoint(fixture), restored = simulationFromCheckpoint(JSON.parse(JSON.stringify(c)));
    const launches: number[] = [];
    for (let i = 0; i < 70 * 60; i++) {
      const input = survivalDecision(sim, i, 'competent'), replayInput = survivalDecision(restored, i, 'competent');
      expect(replayInput).toEqual(input);
      sim.step(1 / 60, input, pilotTuning); restored.step(1 / 60, replayInput, pilotTuning);
      const events = sim.consumeArtilleryEvents(); expect(restored.consumeArtilleryEvents()).toEqual(events);
      launches.push(...events.filter(e => e.kind === 'artilleryLaunch').map(e => e.shell.launchedAtSeconds));
      if (i % 60 === 0) expect(restored.getState()).toEqual(sim.getState());
    }
    expect(restored.getState()).toEqual(sim.getState()); expect(sim.getState().squad.count).toBeGreaterThan(0);
    if (fixture === 'naval') { expect(launches).toHaveLength(5); expect(new Set(launches).size).toBe(5); }
    else {
      expect(sim.getState().postCapSurvival!.nextGiantAtSeconds).toBe(72);
      expect(sim.getState().postCapSurvival!.nextGrenadeSupplyAtSeconds).toBe(90);
    }
  });
  it.each(['survival10-ahead', 'survival10-staged', 'survival10-experimental', 'survival10-baseline', 'crate3', 'naval', 'barrage10-on', 'barrage10-off'] as const)('restores %s and continues every authoritative clock identically', fixture => {
    const { sim, c } = checkpoint(fixture), store = storage(), before = JSON.stringify(sim.getState());
    expect(writeCheckpoint(c, store).ok).toBe(true);
    expect(JSON.stringify(sim.getState())).toBe(before);
    const found = readCheckpoint(store); expect(found.status).toBe('valid');
    if (found.status !== 'valid') throw Error(found.status);
    const clone = simulationFromCheckpoint(found.checkpoint);
    expect(clone.getState()).toEqual(sim.getState());
    for (let i = 0; i < 240; i++) {
      const input = { targetX: i < 120 ? -2 : 2 };
      sim.step(1 / 60, input, pilotTuning); clone.step(1 / 60, input, pilotTuning);
    }
    expect(clone.getState()).toEqual(sim.getState());
    expect(clone.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents());
  });
  it.each(historical)('loads a historical eight-level Survival snapshot without replacing its saved plan/schedule', old => {
    const { c } = checkpoint(), store = storage();
    const save = { ...c, fixture: null, state: old as unknown as SessionCheckpoint['state'] };
    writeCheckpoint(save, store); const found = readCheckpoint(store); expect(found.status).toBe('valid');
    if (found.status !== 'valid') throw Error(found.status);
    const restored = simulationFromCheckpoint(found.checkpoint).getState();
    expect(restored.catharsis?.balance.progression.levelPlan).toHaveLength(8);
    expect(restored.catharsis?.balance.postCapSurvival).toEqual(old.catharsis.balance.postCapSurvival);
    expect(restored.defenseWaves).toEqual(old.defenseWaves);
    expect(restored.destroyer).toEqual(old.destroyer);
  });
  it('rejects corruption, incompatible versions, mismatched modes/levels, invalid state and finished runs', () => {
    const { c } = checkpoint(), store = storage();
    for (const bad of ['{', JSON.stringify({ ...c, version: 2 }), JSON.stringify({ ...c, mode: 'legacy' }),
      JSON.stringify({ ...c, simulationContract: 2 }), JSON.stringify({ ...c, level: { ...c.level, id: 'other' } }),
      JSON.stringify({ ...c, state: { ...c.state, rngState: -1 } }),
      JSON.stringify({ ...c, state: { ...c.state, squad: { ...c.state.squad, count: 0 } } }),
      'x'.repeat(MAX_CHECKPOINT_CHARACTERS + 1)]) {
      store.entries.set(CHECKPOINT_KEY, bad); expect(readCheckpoint(store).status).toBe('invalid');
    }
  });
  it('keeps valid saves without expiring them or requiring identical commit SHAs', () => {
    const { c } = checkpoint(), store = storage(); writeCheckpoint({ ...c, savedAt: 0, build: 'historical' }, store);
    expect(readCheckpoint(store).status).toBe('valid');
    expect(clearCheckpoint(store)).toBe(true); expect(readCheckpoint(store).status).toBe('empty');
  });
  it('handles unavailable storage, quota errors and bounded writes without throwing', () => {
    const { c } = checkpoint(), store = storage();
    expect(readCheckpoint(null).status).toBe('unavailable'); expect(writeCheckpoint(c, null).ok).toBe(false);
    const denied = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('denied'); } };
    expect(readCheckpoint(denied).status).toBe('unavailable'); expect(writeCheckpoint(c, denied).ok).toBe(false);
    expect(clearCheckpoint(denied)).toBe(false);
    writeCheckpoint(c, store); store.setItem = () => { throw Error('quota'); };
    expect(writeCheckpoint(c, store).ok).toBe(false); expect(readCheckpoint(store).status).toBe('empty');
  });
});
