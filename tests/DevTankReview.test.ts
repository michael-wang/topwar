import { expect, it, vi } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { BOSS_TEST_PRESETS, type TankReviewFixture } from '../src/app/DevTankReview';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { readCheckpoint, simulationFromCheckpoint, writeCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import type { DefenseTankConfig } from '../src/config/defenseTankConfig';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config);
const options = { seed: 19, level, tiers: config.tiers, startSquad: 1, startRocketCount: 0,
  catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } };
const roles = Object.keys(BOSS_TEST_PRESETS) as (keyof typeof BOSS_TEST_PRESETS)[];
const make = (role: TankReviewFixture) => createDevReviewFixture(options, config.weapon.rifle.fireRate, role);
it('authors one fixed 67-member dense review without modifying the real Boss config, RNG or loadout',()=>{
  const a=make('boss-dense').getState(),b=make('boss-dense').getState(),original=make('boss-intro').getState();
  expect(a).toEqual(b);expect(a.catharsis).toEqual(original.catharsis);expect(a.rngState).toBe(original.rngState);
  expect(a.progression).toEqual(original.progression);expect(a.squad).toEqual(original.squad);expect(a.defenseTank).toBeUndefined();
  expect(a.enemies).toHaveLength(67);expect(new Set(a.enemies.map(e=>e.lane)).size).toBe(5);
  expect(new Set(a.enemies.map(e=>e.archetype))).toEqual(new Set(['heavy','grunt']));
  expect(a.enemies.map(e=>e.id)).toEqual(Array.from({length:67},(_,i)=>i+1));
});
it('crushes exactly the body-path and touching-edge IDs, sparing every other review enemy without awards',()=>{
  const sim=make('boss-dense'),s=sim.getState();s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns=[100,100];sim.restoreState(s);
  const events=[] as ReturnType<typeof sim.consumeTankEntranceEvents>;
  for(let i=0;i<150;i++){step(sim);events.push(...sim.consumeTankEntranceEvents());}
  const crushed=[31,32,33,34,35,36,37,38,39,60,62,64,66],after=sim.getState();
  expect(events.flatMap(e=>e.victims.map(v=>v.id)).sort((a,b)=>a-b)).toEqual(crushed);
  expect(events.filter(e=>e.shockwave)).toHaveLength(1);
  expect(after.enemies.filter(e=>e.id<=67).map(e=>e.id)).toEqual(s.enemies.filter(e=>!crushed.includes(e.id)).map(e=>e.id));
  expect(after.enemies.filter(e=>e.id<=67).every(e=>e.z<s.enemies[e.id-1].z)).toBe(true);
  expect(after.progression).toEqual(s.progression);expect(after.combatStats).toEqual(s.combatStats);
  expect(after.defenseTank).toMatchObject({status:'active',hp:6500,phase:1,startedAtSeconds:60,activeAtSeconds:62.5});
});
it('awards ordinary XP for player kills in the dense review',()=>{
  const sim=make('boss-dense');step(sim,120);const s=sim.getState(),stats=s.combatStats!;
  expect(stats.gruntKills+stats.heavyKills).toBeGreaterThan(0);
  expect(s.progression!.xp).toBe(stats.gruntKills+10*stats.heavyKills);
});
it.each([20,75,160])('dense review checkpoint at tick %i restores exact state and remains DEV-only',ticks=>{
  const sim=make('boss-dense');step(sim,ticks);const c:SessionCheckpoint={version:1,simulationContract:1,game:'topwar',mode:'defense',
    savedAt:1,build:'test',paused:true,hidden:false,reason:'pause',fixture:'boss-dense',config,level,
    tuning:defaultRuntimeTuning(config,level),state:sim.getState()};
  const entries=new Map<string,string>(),storage={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);},removeItem:(k:string)=>{entries.delete(k);}};
  expect(writeCheckpoint(c,storage).ok).toBe(true);const loaded=readCheckpoint(storage);expect(loaded.status).toBe('valid');
  if(loaded.status!=='valid')throw Error('Rejected dense checkpoint');const copy=simulationFromCheckpoint(loaded.checkpoint);
  expect(copy.getState()).toEqual(sim.getState());expect(copy.consumeTankEntranceEvents()).toEqual([]);
  step(sim,60);step(copy,60);expect(copy.getState()).toEqual(sim.getState());
  vi.stubEnv('DEV',false);try{expect(readCheckpoint(storage).status).toBe('invalid');}finally{vi.unstubAllEnvs();}
});
it('previews a real completed Tank battlefield with fixed DEV results and no manual final hit', () => {
  const sim = createDevReviewFixture(options, config.weapon.rifle.fireRate, 'victory'), state = sim.getState();
  expect(state.catharsis!.balance).toEqual(config.catharsis);
  expect(state.defenseTank).toMatchObject({ status: 'defeated', hp: 0, phase: 3, defeatedAtSeconds: 216.6 });
  expect(state.combatStats).toEqual({ gruntKills: 65, heavyKills: 234, giantKills: 6,
    shotsFired: 11410, shotsHit: 11024, grenadesUsed: 8 });
  expect(state.enemies).toEqual([]); expect(state.projectiles).toEqual([]); expect(state.artillery!.shells).toEqual([]);
  sim.restoreState(JSON.parse(JSON.stringify(state))); step(sim, 120); expect(sim.getState()).toEqual(state);
});
function step(sim: ReturnType<typeof make>, ticks = 1) { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning); }

it.each(roles)('%s is a playable real Boss entry with checkpoint/Resume continuity', role => {
  const sim = make(role), initial = sim.getState();
  expect(initial.catharsis!.balance).toEqual(config.catharsis);
  expect(initial.progression!.level).toBe(9); expect(initial.squad.count).toBe(2);
  expect(initial.grenade!.inventory).toBe(3);
  if (role === 'boss-intro') {
    expect(initial.defenseTank).toBeUndefined(); expect(initial.enemies).toHaveLength(42);
    expect(initial.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(11);
    expect(initial.enemies.filter(e => e.lane === 2).length).toBeGreaterThan(0);
    expect(initial.enemies.every(e => e.survivalSpeedMultiplier === 1.6)).toBe(true);
  } else expect(initial.defenseTank!.hp).toBe(6500 * BOSS_TEST_PRESETS[role].hpFraction);
  sim.stepLane(1); sim.step(1 / 60, { targetX: 0, throwGrenade: true }, tuning);
  expect(sim.getState().combatStats).toMatchObject({ grenadesUsed: 1 });
  step(sim, role === 'boss-intro' ? 155 : 30);
  expect(sim.getState().combatStats!.shotsFired).toBeGreaterThan(0);
  expect(sim.getState().defenseTank!.status).toBe('active');
  const state = sim.getState(), c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar',
    mode: 'defense', savedAt: 1, build: 'test', paused: true, hidden: false, reason: 'pause', fixture: role,
    config, level, tuning: defaultRuntimeTuning(config, level), state };
  const entries = new Map<string, string>(), storage = { getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => { entries.set(k, v); }, removeItem: (k: string) => { entries.delete(k); } };
  expect(writeCheckpoint(c, storage).ok).toBe(true);
  const found = readCheckpoint(storage); expect(found.status).toBe('valid'); if (found.status !== 'valid') throw Error(found.status);
  const restored = simulationFromCheckpoint(found.checkpoint); expect(restored.getState()).toEqual(state);
  expect(restored.consumeArtilleryEvents()).toEqual([]);
  step(sim, 120); step(restored, 120); expect(restored.getState()).toEqual(sim.getState());
});

it.each(['boss-phase1', 'boss-phase2', 'boss-phase3'] as const)('%s uses its real salvo, cooldown and Giant schedule with at least 2.4s flight near the defense line', role => {
  const sim = make(role), s = sim.getState(); s.defenseTank!.z = 6;
  s.weapons.rifleCooldownRemainingSeconds = 100; s.weapons.rifleMemberCooldowns = [100, 100]; sim.restoreState(s);
  step(sim); const shells = sim.getState().artillery!.shells, phase = s.defenseTank!.phase;
  expect(s.defenseTank!.z - sim.getState().defenseTank!.z).toBeCloseTo([.12, .16, .16][phase - 1] / 60, 7);
  expect(shells).toHaveLength(phase); expect(new Set(shells.map(s => s.targetLane)).size).toBe(phase);
  for (const shell of shells) expect(shell.flightSeconds).toBeGreaterThanOrEqual(2.4);
  expect(sim.getState().defenseTank!.nextGiantAtSeconds).toBe(phase === 1 ? null : sim.getState().elapsedSeconds + 12);
  const deadline = Math.max(...shells.map(s => s.impactAtSeconds));
  // Use each shell's safe adjacent corridor through normal input rather than changing hit rules.
  const safe = [0, 1, 2, 3, 4].find(lane => !shells.some(s => s.targetLane === lane))!;
  sim.stepLane(safe < 2 ? -1 : 1);
  while (sim.getState().elapsedSeconds < deadline + .02 && sim.getState().squad.count) {
    const st = sim.getState(); if (st.player.selectedLane !== safe) sim.stepLane(st.player.selectedLane! < safe ? 1 : -1);
    sim.step(1 / 60, { targetX: 0 }, tuning);
  }
  expect(sim.getState().defenseTank!.nextAttackAtSeconds).toBeCloseTo(deadline + [4, 3, 2][phase - 1]);
});

it('keeps Destroyer timing and restores Tank saves authored before the flight override', () => {
  const sim = make('boss-phase1'); sim.launchArtillery({ source: { id: 'navy', type: 'destroyer', position: { x: 0, y: 2, z: 8 } }, targetLane: 0 });
  expect(sim.getState().artillery!.shells[0].flightSeconds).toBe(.5);
  sim.launchArtillery({ source: { id: 'tank', type: 'defenseTank', position: { x: 0, y: 2, z: 8 } }, targetLane: 0,
    flight: { horizontalSpeed: 24, gravity: 8, minimumFlightSeconds: .5 } });
  const old = sim.getState(), oldConfig: Partial<DefenseTankConfig> = old.catharsis!.balance.defenseTank!;
  delete oldConfig.flight; old.defenseTank!.pendingImpactAtSeconds = old.artillery!.shells[1].impactAtSeconds;
  old.defenseTank!.nextAttackAtSeconds = null; sim.restoreState(old);
  expect(sim.getState().artillery!.shells).toEqual(old.artillery!.shells);
  expect(sim.getState().catharsis!.balance.defenseTank!.flight.minimumFlightSeconds).toBe(2.4);
  sim.cancelArtillery(); step(sim, 241);
  expect(sim.getState().artillery!.shells.find(s => s.source.type === 'defenseTank')!.flightSeconds).toBeGreaterThanOrEqual(2.4);
});

it('FINISH reaches real explosions/clear state through ordinary fire', () => {
  const sim = make('boss-finish'); step(sim, 600);
  expect(sim.getState().defenseTank!.status).toBe('defeated'); expect(sim.getState().combatStats!.shotsHit).toBeGreaterThan(0);
  expect(sim.getState().artillery!.shells).toEqual([]);
});
