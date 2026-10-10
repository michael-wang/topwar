import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import { grenadeTarget, enemiesInBlast } from '../../src/simulation/grenade';
import { pilotTuning } from './p15Pilot';

export function runDifficultyPilot(seed: number, retainSnapshots = false) {
  const c = GameConfigSchema.parse(data);
  const sim = new Simulation({ seed, level: LevelDefinitionSchema.parse(levelData), startSquad: 1,
    startRocketCount: 0, tiers: c.tiers, catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } });
  const levels: Record<number, number> = { 1: 0 }, giants: any[] = [], waves: any[] = [], shells: any[] = [];
  const snapshots: Record<string, unknown> = {};
  let casualties = 0, peakEnemies = 0, peakProjectiles = 0, entrance: number | null = null;
  let carnivalEnd: number | null = null, destroyerEnd: number | null = null;
  const stepCosts: number[] = [];
  for (let tick = 0; tick < 60 * 240 && sim.getFrameState().squad.count; tick++) {
    const before = sim.getState();
    if (tick % 12 === 0) {
      const current = before.player.selectedLane!;
      const unsafe = new Set(before.artillery?.shells.map(s => s.targetLane));
      const nearest = [...before.enemies].filter(e => e.z > before.player.z).sort((a, b) => a.z - b.z || a.id - b.id)[0];
      const giant = before.enemies.find(e => e.archetype === 'giant');
      const preferred = before.grenade?.supply?.lane
        ?? (giant && (!nearest || nearest.z - before.player.z > 10) ? giant : nearest)?.lane ?? current;
      // One adjacent input every 200ms. Avoid locked artillery lanes, including
      // both shells during overlap. No simulation, targeting or damage overrides.
      const choices = [current - 1, current, current + 1].filter(l => l >= 0 && l < 5 && !unsafe.has(l));
      const lane = choices.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b)[0] ?? current;
      if (lane !== current) sim.stepLane(lane < current ? -1 : 1);
    }
    const frame = sim.getFrameState(), g = c.catharsis!.grenade;
    const target = frame.grenade!.inventory && !frame.grenade!.flight ? grenadeTarget(frame, g) : undefined;
    const victims = target ? enemiesInBlast(frame.enemies, target.x, target.z, g.blastRadius) : [];
    const depth = target ? target.z - frame.player.z : Infinity;
    const throwGrenade = !!target && (victims.length >= 6 && depth <= 14
      || depth <= 10 && victims.reduce((sum, e) => sum + e.hp, 0) >= 12);
    const start = performance.now();
    sim.step(1 / 60, { targetX: 0, throwGrenade }, pilotTuning);
    stepCosts.push(performance.now() - start);
    const after = sim.getFrameState();
    for (let lv = before.progression!.level + 1; lv <= after.progression!.level; lv++) levels[lv] = after.elapsedSeconds;
    const events = sim.consumePresentationEvents();
    casualties += events.reduce((n, e) => n + Math.max(0, e.before.count - e.after.count), 0);
    const contacts = new Set(events.filter(e => e.kind === 'normalEnemyContact').map(e => e.enemyId));
    for (const e of after.enemies.filter(e => e.archetype === 'giant' && e.id >= before.enemyStream!.nextEnemyId))
      giants.push({ id: e.id, spawn: after.elapsedSeconds, hp: e.hp, lane: e.lane, depth: e.z - after.player.z, death: null });
    for (const e of before.enemies.filter(e => e.archetype === 'giant' && !after.enemies.some(a => a.id === e.id))) {
      const entry = giants.find(g => g.id === e.id);
      if (entry) Object.assign(entry, { death: after.elapsedSeconds, survival: after.elapsedSeconds - entry.spawn,
        killed: !contacts.has(e.id), progressionBefore: before.progression, progressionAfter: after.progression });
    }
    const added = after.enemies.filter(e => e.id >= before.enemyStream!.nextEnemyId && e.archetype !== 'giant');
    if (added.length) waves.push({ time: after.elapsedSeconds, level: before.progression!.level, xp: before.progression!.xp,
      carnival: before.carnival!.status === 'active', release: before.machineGunReleaseAtSeconds !== after.machineGunReleaseAtSeconds,
      population: added.length, heavy: added.filter(e => e.archetype === 'heavy').length });
    for (const event of sim.consumeArtilleryEvents()) if (event.kind === 'artilleryLaunch')
      shells.push({ time: event.shell.launchedAtSeconds, lane: event.shell.targetLane });
    sim.consumeGrenadeEvents();
    entrance ??= after.destroyer?.startedAtSeconds ?? null;
    if (after.carnival!.status === 'complete') carnivalEnd ??= after.elapsedSeconds;
    if (after.destroyer?.status === 'complete') destroyerEnd ??= after.elapsedSeconds;
    peakEnemies = Math.max(peakEnemies, after.enemies.length); peakProjectiles = Math.max(peakProjectiles, after.projectiles.length);
    if (retainSnapshots) {
      const age = after.carnival!.elapsedSeconds;
      const key = after.carnival!.status === 'active' ? age < 1 ? 'carnival-start' : age >= 12 ? 'carnival-middle' : ''
        : after.destroyer?.status === 'active' ? after.elapsedSeconds - entrance! >= 12 ? 'destroyer-middle' : 'carnival-complete'
        : after.destroyer?.status === 'complete' ? 'destroyer-complete' : '';
      if (key && !snapshots[key]) snapshots[key] = sim.getState();
    }
  }
  const end = sim.getState(), sorted = stepCosts.sort((a, b) => a - b);
  return { seed, levels, giants, waves, release: end.machineGunReleaseAtSeconds, entrance, shells, carnivalEnd, destroyerEnd,
    survivalStart: end.postCapSurvival!.startedAtSeconds, casualties, gameOver: !end.squad.count,
    final: { time: end.elapsedSeconds, level: end.progression, soldiers: end.squad.count }, peakEnemies, peakProjectiles,
    stepMs: { mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) },
    ...(retainSnapshots ? { snapshots } : {}) };
}
