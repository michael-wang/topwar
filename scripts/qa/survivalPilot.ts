import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import { createDevReviewFixture } from '../../tests/helpers/ReviewFixtures';
import { SeededRng } from '../../src/core/Rng';
import { effectiveSeed } from '../../src/simulation/enemies/effectiveSeed';
import { admitDefenseGroup } from '../../src/simulation/enemies/defenseGroup';
import { postCapOrdinarySettings } from '../../src/simulation/postCapSurvival';
import { grenadeTarget, enemiesInBlast } from '../../src/simulation/grenade';
import { pilotTuning } from './p15Pilot';

export function survivalSimulation(seed: number, scenario: 'natural' | 'lv7' | 'lv8') {
  const c = GameConfigSchema.parse(data), options = { seed, level: LevelDefinitionSchema.parse(levelData),
    startSquad: 1, startRocketCount: 0, tiers: c.tiers,
    catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } };
  if (scenario === 'natural') return new Simulation(options);
  const sim = createDevReviewFixture(options, c.weapon.rifle.fireRate, scenario === 'lv7' ? 'mg7' : 'mg8');
  const s = sim.getState(); s.seed = seed; s.rngState = new SeededRng(seed).getState();
  s.enemies = []; s.enemyStream!.nextEnemyId = 1;
  const row = s.enemyStream!.nextRowIndex - 1, balance = s.catharsis!.balance;
  const settings = postCapOrdinarySettings(balance, s.postCapSurvival, s.progression!.level);
  admitDefenseGroup(s.enemies, s.enemyStream!, row, effectiveSeed(seed, options.level.enemyStream!.seed),
    { ...balance, ...settings }, s.catharsis!.trackHalfWidth, balance.defenseSpawnAheadDistance);
  if (balance.postCapSurvival.waveIntervalSeconds) s.defenseWaves!.nextAtSeconds = balance.postCapSurvival.waveIntervalSeconds;
  sim.restoreState(s); return sim;
}

export function survivalDecision(sim: Simulation, tick: number, policy: 'competent' | 'slower' | 'fixed') {
  const s = sim.getFrameState();
  if (policy !== 'fixed' && tick % (policy === 'slower' ? 36 : 12) === 0) {
    const current = s.player.selectedLane!, danger = new Set(s.artillery?.shells.map(s => s.targetLane));
    const nearest = s.enemies.reduce<typeof s.enemies[number] | undefined>((a, e) => !a || e.z < a.z ? e : a, undefined);
    const giant = s.enemies.find(e => e.archetype === 'giant');
    const preferred = s.grenade?.supply?.lane ?? (giant && (!nearest || nearest.z > 10) ? giant : nearest)?.lane ?? current;
    const lane = [current - 1, current, current + 1].filter(l => l >= 0 && l < 5 && !danger.has(l))
      .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b)[0] ?? current;
    if (lane !== current) sim.stepLane(lane < current ? -1 : 1);
  }
  const g = s.catharsis!.balance.grenade;
  const target = policy !== 'fixed' && (policy !== 'slower' || tick % 36 === 0) && s.grenade?.inventory && !s.grenade.flight ? grenadeTarget(s, g) : undefined;
  const victims = target ? enemiesInBlast(s.enemies, target.x, target.z, g.blastRadius) : [];
  return { targetX: 0, throwGrenade: !!target && (victims.length >= 6 && target.z <= 14
    || target.z <= 10 && victims.reduce((sum, e) => sum + e.hp, 0) >= 12) };
}

export function runSurvivalPilot(seed: number, scenario: 'natural' | 'lv7' | 'lv8', policy: 'competent' | 'slower' | 'fixed' = 'competent') {
  const sim = survivalSimulation(seed, scenario), initial = sim.getState();
  let activation = initial.postCapSurvival?.startedAtSeconds ?? null, entry = activation === null ? null : initial;
  const waves: any[] = [], opportunities: any[] = [], samples: any[] = [], levels: Record<number, number> = { [initial.progression!.level]: 0 };
  let kills = 0, contacts = 0, casualties = 0, longestEmpty = 0, emptySince: number | null = null;
  let peakEnemies = 0, peakProjectiles = 0; const costs: number[] = [];
  for (let tick = 0; tick < 420 * 60 && sim.getFrameState().squad.count; tick++) {
    const before = sim.getState(), input = survivalDecision(sim, tick, policy), start = performance.now();
    sim.step(1 / 60, input, pilotTuning); costs.push(performance.now() - start);
    const s = sim.getFrameState(), events = sim.consumePresentationEvents();
    sim.consumeArtilleryEvents(); sim.consumeGrenadeEvents();
    for (let level = before.progression!.level + 1; level <= s.progression!.level; level++) levels[level] = s.elapsedSeconds;
    if (activation === null && s.postCapSurvival?.startedAtSeconds != null) { activation = s.postCapSurvival.startedAtSeconds; entry = sim.getState(); }
    if (activation === null) continue;
    const age = s.elapsedSeconds - activation;
    const contactIds = new Set(events.filter(e => e.kind === 'normalEnemyContact').map(e => e.enemyId));
    contacts += contactIds.size; casualties += events.reduce((n, e) => n + Math.max(0, e.before.count - e.after.count), 0);
    kills += before.enemies.filter(e => !s.enemies.some(a => a.id === e.id) && !contactIds.has(e.id)).length;
    const added = s.enemies.filter(e => e.id >= before.enemyStream!.nextEnemyId);
    const ordinary = added.filter(e => e.archetype !== 'giant');
    const allocated = s.enemyStream!.nextEnemyId - before.enemyStream!.nextEnemyId;
    kills += allocated - added.length; // Shots already in flight may kill newly admitted Grunts on this tick.
    const total = allocated - added.filter(e => e.archetype === 'giant').length;
    const profile = postCapOrdinarySettings(before.catharsis!.balance, before.postCapSurvival, before.progression!.level);
    if (before.defenseWaves!.nextAtSeconds <= s.elapsedSeconds + 1e-9 && before.postCapSurvival!.startedAtSeconds !== null)
      waves.push({ age, level: before.progression!.level, total,
        grunts: total ? total - profile!.heavyCount : 0, heavies: total ? profile!.heavyCount : 0,
        sameTickKills: total - ordinary.length, lanes: [...new Set(ordinary.map(e => e.lane))], active: s.enemies.length });
    for (const [key, kind] of [['nextGiantAtSeconds', 'giant'], ['nextGrenadeSupplyAtSeconds', 'supply']] as const)
      if (before.postCapSurvival?.[key] != null && before.postCapSurvival[key]! <= s.elapsedSeconds + 1e-9)
        opportunities.push({ age, kind, admitted: kind === 'giant' ? added.some(e => e.archetype === 'giant')
          : !before.grenade!.supply && !!s.grenade!.supply });
    if (!s.enemies.some(e => e.z <= s.catharsis!.balance.machineGun.range)) emptySince ??= s.elapsedSeconds;
    else if (emptySince !== null) { longestEmpty = Math.max(longestEmpty, s.elapsedSeconds - emptySince); emptySince = null; }
    peakEnemies = Math.max(peakEnemies, s.enemies.length); peakProjectiles = Math.max(peakProjectiles, s.projectiles.length);
    if (tick % 60 === 0) samples.push({ age, level: s.progression!.level, soldiers: s.squad.count, active: s.enemies.length,
      near10: s.enemies.filter(e => e.z <= 10).length, near20: s.enemies.filter(e => e.z <= 20).length,
      hpDebt: s.enemies.reduce((sum, e) => sum + e.hp, 0), lanes: Array.from({ length: 5 }, (_, lane) => ({
        active: s.enemies.filter(e => e.lane === lane).length, near: s.enemies.filter(e => e.lane === lane && e.z <= 10).length })) });
    if (age >= 180) break;
  }
  const end = sim.getState(); if (emptySince !== null) longestEmpty = Math.max(longestEmpty, end.elapsedSeconds - emptySince);
  const age = activation === null ? 0 : end.elapsedSeconds - activation, sorted = costs.sort((a, b) => a - b);
  return { seed, scenario, policy, activation, firstWaveAge: waves.find(w => w.total)?.age ?? null, survivalSeconds: age,
    levels, waves, opportunities, samples, kills, contacts, killsPerSecond: kills / Math.max(age, 1), casualties,
    finalSoldiers: end.squad.count, gameOver: !end.squad.count, failureAge: !end.squad.count ? age : null,
    longestWithoutTargetsInRange: longestEmpty, peakEnemies, peakProjectiles,
    stepMs: { mean: costs.reduce((a, b) => a + b, 0) / costs.length, p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) },
    entry, end };
}
