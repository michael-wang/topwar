import { describe, expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { emptyCarnival } from '../src/simulation/carnival';
import { emptyDestroyer } from '../src/simulation/destroyer';
import { tankPhase, startDefenseTank } from '../src/simulation/defenseTank';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { CHECKPOINT_KEY, readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { clearResultRows } from '../src/ui/StageClearOverlay';
import { combatResults } from '../src/simulation/combatStats';

const level = LevelDefinitionSchema.parse(levelData), tuning = qaSimulationTuning(config), tankConfig = config.catharsis!.defenseTank!;
function fixture(playerLevel = 9) {
  const balance = structuredClone(config.catharsis!);
  balance.levelEncounters!.triggers = []; balance.carnival.enabled = false;
  const sim = new Simulation({ seed: 17, level, startSquad: 2, startRocketCount: 0,
    tiers: config.tiers, catharsis: { balance, trackHalfWidth: config.track.halfWidth } });
  const s = sim.getState(); s.tick = 1800; s.elapsedSeconds = 30; s.enemies = []; s.projectiles = [];
  s.carnival = emptyCarnival(true); s.destroyer = emptyDestroyer(true);
  s.levelEncounters!.survivalEnabled = true; s.machineGunReleaseAtSeconds = 0;
  s.progression = { level: playerLevel, xp: 0 }; s.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  if (playerLevel === 8) s.squad = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
  s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0, inventory: 20, flight: null, supply: null };
  s.defenseWaves!.nextAtSeconds = 30; sim.restoreState(s);
  return sim;
}
function step(sim: Simulation, ticks = 1) { for (let i = 0; i < ticks; i++) sim.step(1 / 60, { targetX: 0 }, tuning); }
function active(phase: 1 | 2 | 3 = 1) {
  const sim = fixture();
  const s = sim.getState(); s.defenseTank = startDefenseTank(27.5, s.seed, tankConfig);
  s.defenseTank.status = 'active'; s.defenseTank.z = tankConfig.battleZ;
  s.defenseTank.hp = phase === 1 ? 6500 : phase === 2 ? 4550 : 2275; s.defenseTank.phase = phase;
  sim.restoreState(s); return sim;
}
function suppressFire(sim: Simulation) {
  const s = sim.getState(); s.weapons.rifleCooldownRemainingSeconds = 100;
  s.weapons.rifleMemberCooldowns = [100, 100]; sim.restoreState(s);
}

describe('Stage 1 Defense tank', () => {
  it('clears the middle lanes once at 0.5s without XP or direct kills, including across entry checkpoints', () => {
    const sim = fixture(); suppressFire(sim);
    const initial = sim.getState();
    initial.enemies = Array.from({ length: 5 }, (_, lane) => ({ id: lane + 1, tier: 1,
      archetype: 'heavy' as const, lane, x: (lane - 2) * 1.4, z: 32, hp: 15 }));
    initial.enemyStream!.nextEnemyId = 6; sim.restoreState(initial); step(sim, 16);
    expect(sim.getState().enemies).toHaveLength(5);
    const before = sim.getState(), replay = fixture(); replay.restoreState(before);
    step(sim, 16); step(replay, 16);
    expect(replay.getState()).toEqual(sim.getState());
    const cleared = sim.getState(), event = sim.consumeTankEntranceEvents();
    expect(event).toHaveLength(1); expect(event[0].victims.map(e => e.id).sort()).toEqual([2, 3, 4]);
    expect(cleared.enemies.map(e => e.lane)).toEqual([0, 4]);
    expect(cleared.progression).toEqual(before.progression); expect(cleared.combatStats).toEqual(before.combatStats);
    expect(cleared.defenseTank!.entranceCleared).toBe(true);
    expect(replay.consumeTankEntranceEvents()).toEqual(event);
    cleared.enemies.push({ id: 6, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 32, hp: 15 });
    cleared.enemyStream!.nextEnemyId = 7; sim.restoreState(cleared);
    expect(sim.consumeTankEntranceEvents()).toEqual([]); step(sim, 120);
    expect(sim.consumeTankEntranceEvents()).toEqual([]); expect(sim.getState().enemies.some(e => e.id === 6)).toBe(true);
    const old = active().getState(); delete old.defenseTank!.entranceCleared;
    sim.restoreState(old); expect(sim.getState().defenseTank!.entranceCleared).toBe(true);
  });
  it('starts exactly on earned Lv9, stops new naval fire and preserves incoming shells', () => {
    const sim = fixture(8), s = sim.getState(); s.progression!.xp = 349;
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: .6, hp: 1 }]; s.enemyStream!.nextEnemyId = 2;
    sim.restoreState(s);
    sim.launchArtillery({ source: { id: 'destroyer', type: 'destroyer', position: { x: 0, y: 2, z: 52 } }, targetLane: 0 });
    const before = sim.getState().artillery!.shells[0]; step(sim);
    const after = sim.getState(); expect(after.progression!.level).toBe(9); expect(after.defenseTank!.status).toBe('entering');
    expect(after.defenseTank!.activeAtSeconds - after.defenseTank!.startedAtSeconds).toBe(2.5);
    expect(after.artillery!.shells).toEqual([before]); expect(after.navalBarrage!.enabled).toBe(false);
    step(sim, 150); expect(sim.getState().defenseTank!.status).toBe('active');
    expect(sim.getState().artillery!.shells.every(x => x.source.type === 'defenseTank')).toBe(true);
    expect(sim.consumeArtilleryEvents().some(e => e.kind === 'artilleryImpact' && e.id === before.id)).toBe(true);
  });
  it.each([1, 2, 3] as const)('phase %i uses distinct lanes and its post-impact cooldown with no overlapping tank salvos', phase => {
    const sim = active(phase); suppressFire(sim); step(sim);
    const first = sim.getState().artillery!.shells;
    expect(first).toHaveLength(phase); expect(new Set(first.map(s => s.targetLane)).size).toBe(phase);
    const finalImpact = Math.max(...first.map(s => s.impactAtSeconds)), count = tankConfig.phases[phase - 1].shells;
    while (sim.getState().elapsedSeconds + 1 / 60 < finalImpact) step(sim);
    expect(sim.getState().artillery!.nextId).toBe(count + 1);
    step(sim, 2); const cooldown = sim.getState().defenseTank!;
    expect(cooldown.nextAttackAtSeconds).toBeCloseTo(finalImpact + tankConfig.phases[phase - 1].cooldownSeconds);
    const deadline = cooldown.nextAttackAtSeconds!;
    while (sim.getState().elapsedSeconds + 1 / 60 < deadline - 1e-9) step(sim);
    expect(sim.getState().artillery!.shells).toHaveLength(0); step(sim);
    expect(sim.getState().artillery!.shells).toHaveLength(count);
  });
  it('keeps a paused checkpoint valid when a tank shell or the whole salvo is cancelled', () => {
    const sim = active(3); suppressFire(sim); step(sim);
    sim.cancelArtillery(sim.getState().artillery!.shells[0].id);
    const partial = sim.getState(); sim.restoreState(partial);
    expect(partial.defenseTank!.pendingImpactAtSeconds).toBe(Math.max(...partial.artillery!.shells.map(s => s.impactAtSeconds)));
    sim.cancelArtillery(); const cancelled = sim.getState(); sim.restoreState(cancelled);
    expect(cancelled.defenseTank!.pendingImpactAtSeconds).toBeNull();
    expect(cancelled.defenseTank!.nextAttackAtSeconds).toBeCloseTo(cancelled.elapsedSeconds + 2);
  });
  it.each([1, 2, 3])('middle lane %i damages the same armor while a closer enemy/supply blocks it', lane => {
    const sim = active(); suppressFire(sim); const s = sim.getState();
    s.player.selectedLane = lane;
    const shot = { id: 1, kind: 'machineGun' as const, tier: 1, x: lane * 1.4 - 2.8, z: 35, speed: 600,
      lane, slopeX: 0, memberIndex: 0, damage: config.tiers.tier1Power, remainingRange: 50,
      blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 };
    s.projectiles = [shot]; s.weapons.nextProjectileId = 2; s.combatStats!.shotsFired = 1;
    sim.restoreState(s); step(sim); expect(sim.getState().defenseTank!.hp).toBe(6499); expect(sim.getState().combatStats!.shotsHit).toBe(1);
    const blocked = sim.getState(); blocked.projectiles = [{ ...shot, id: 2 }]; blocked.weapons.nextProjectileId = 3; blocked.combatStats!.shotsFired = 2;
    blocked.enemies = [{ id: 1, lane, tier: 1, archetype: 'heavy', hp: 15, x: shot.x, z: 36 }]; blocked.enemyStream!.nextEnemyId = 2;
    sim.restoreState(blocked); step(sim); expect(sim.getState().defenseTank!.hp).toBe(6499);
    expect(sim.getState().enemies[0].hp).toBe(14); expect(sim.getState().combatStats!.shotsHit).toBe(2);
  });
  it('keeps outer lanes off armor, and Grenades damage armor once without affecting bullet accuracy', () => {
    const sim = active(); suppressFire(sim);
    const s = sim.getState(); s.player.selectedLane = 0; s.player.x = -2.8;
    s.projectiles = [{ id: 1, kind: 'machineGun', tier: 1, x: -2.8, z: 35, speed: 600, lane: 0, slopeX: 0, memberIndex: 0,
      damage: config.tiers.tier1Power, remainingRange: 50, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 }];
    s.weapons.nextProjectileId = 2; s.combatStats!.shotsFired = 1; sim.restoreState(s); step(sim);
    expect(sim.getState().defenseTank!.hp).toBe(6500);
    const empty = sim.getState(); empty.enemies = []; sim.restoreState(empty);
    sim.step(1 / 60, { targetX: 0, throwGrenade: true }, tuning);
    expect(sim.getState().grenade!.inventory).toBe(19); expect(sim.getState().combatStats!.grenadesUsed).toBe(1);
    step(sim, 40); expect(sim.getState().defenseTank!.hp).toBe(6491); expect(sim.getState().combatStats!.shotsHit).toBe(0);
  });
  it.each([1, 2, 3] as const)('phase %i takes one Grenade hit anywhere the blast overlaps its armor, preserving ordinary enemy damage', phase => {
    for (const [x, dz, expectedDamage] of [[0, 0, 9], [tankConfig.halfWidth + 3.9, 0, 9],
      [tankConfig.halfWidth + 2, tankConfig.halfDepth + 2, 9], [tankConfig.halfWidth + 4.1, 0, 0]]) {
      const sim = active(phase); suppressFire(sim); const s = sim.getState(), hp = s.defenseTank!.hp;
      const z = s.defenseTank!.z + dz;
      s.grenade!.flight = { startX: 0, startZ: 0, targetX: x, targetZ: z, startedAtSeconds: s.elapsedSeconds,
        flightSeconds: 1 / 60, damageEnemyHp: config.catharsis!.grenade.damageEnemyHp, blastRadius: config.catharsis!.grenade.blastRadius };
      s.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 4, x, z, hp: 15 }]; s.enemyStream!.nextEnemyId = 2;
      sim.restoreState(s); step(sim);
      expect(sim.getState().defenseTank!.hp).toBe(hp - expectedDamage);
      expect(sim.getState().enemies.find(e => e.id === 1)!.hp).toBe(6);
      expect(sim.getState().combatStats!.shotsHit).toBe(s.combatStats!.shotsHit);
      const blast = sim.consumeGrenadeEvents().find(e => e.kind === 'grenadeDetonated');
      expect(blast?.kind === 'grenadeDetonated' ? blast.tankDamage ?? 0 : undefined).toBe(expectedDamage);
      step(sim, 10); expect(sim.getState().defenseTank!.hp).toBe(hp - expectedDamage);
      expect(sim.consumeGrenadeEvents()).toEqual([]);
    }
  });
  it('owns flank waves and 12-second Giants while preserving Supply and normal XP to Lv10', () => {
    const sim = active(2); suppressFire(sim); step(sim);
    let s = sim.getState(); expect(s.enemies.every(e => e.lane === 0 || e.lane === 4)).toBe(true);
    expect(s.enemies.filter(e => e.archetype === 'heavy')).toHaveLength(8);
    const giantAt = s.defenseTank!.nextGiantAtSeconds!;
    while (sim.getState().elapsedSeconds < giantAt + .01) step(sim);
    s = sim.getState(); expect(s.enemies.some(e => e.archetype === 'giant' && [0, 4].includes(e.lane!))).toBe(true);
    expect(s.enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
    s.progression!.xp = 449; s.grenade!.flight = { startX: 0, startZ: 0, targetX: -2.8, targetZ: 10,
      startedAtSeconds: s.elapsedSeconds, flightSeconds: 1 / 60, damageEnemyHp: 9, blastRadius: 4 };
    s.enemies = [{ id: 100, lane: 0, x: -2.8, z: 10, tier: 1, archetype: 'grunt', hp: 1 }]; s.enemyStream!.nextEnemyId = 101;
    s.postCapSurvival!.nextGrenadeSupplyAtSeconds = s.elapsedSeconds;
    sim.restoreState(s); step(sim); s = sim.getState();
    expect(s.progression!.level).toBe(10); expect(s.squad.count).toBe(3); expect(s.grenade!.supply).not.toBeNull();
    expect(s.combatStats!.gruntKills).toBe(1);
  });
  it('crosses HP thresholds, speeds up phase 3 and loses the entire squad on breach', () => {
    expect(tankPhase(4550.1, tankConfig)).toBe(1); expect(tankPhase(4550, tankConfig)).toBe(2);
    expect(tankPhase(2275, tankConfig)).toBe(3);
    const sim = active(3), before = sim.getState().defenseTank!.z; step(sim);
    expect(before - sim.getState().defenseTank!.z).toBeCloseTo(.36 / 60);
    const s = sim.getState(); s.defenseTank!.z = tankConfig.halfDepth - tuning.defenseLineOffset + .001;
    sim.restoreState(s); step(sim); expect(sim.getState().squad.count).toBe(0);
    expect(sim.getState().defenseTank!.status).toBe('breached');
  });
  it('clears at Lv9, cancels shells and excludes the remaining enemies from direct kills; final stats freeze', () => {
    const sim = active(3); step(sim); const s = sim.getState(); s.defenseTank!.hp = 1;
    s.grenade!.flight = { startX: 0, startZ: 0, targetX: 0, targetZ: s.defenseTank!.z,
      startedAtSeconds: s.elapsedSeconds, flightSeconds: 1 / 60, damageEnemyHp: 9, blastRadius: 4 };
    const kills = combatResults(s.combatStats!, 0).totalKills; sim.restoreState(s); step(sim);
    const final = sim.getState(); expect(final.progression!.level).toBe(9); expect(final.defenseTank!.status).toBe('defeated');
    expect(final.enemies).toHaveLength(0); expect(final.projectiles).toHaveLength(0); expect(final.artillery!.shells).toHaveLength(0);
    expect(combatResults(final.combatStats!, 0).totalKills).toBe(kills);
    sim.restoreState(final); step(sim, 120); expect(sim.getState()).toEqual(final);
    expect(sim.launchArtillery({ source: { id: 'test', type: 'destroyer', position: { x: 0, y: 2, z: 52 } } })).toBeNull();
  });
  it.each(['entering', 'active', 'cooldown'] as const)('checkpoints %s with deterministic continuation and rejects malformed tank data transactionally', stage => {
    const sim = stage === 'entering' ? fixture() : active(2); suppressFire(sim); step(sim);
    if (stage === 'cooldown') step(sim, 105);
    const s = sim.getState(), c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
      savedAt: 1, build: 'tank', paused: true, hidden: false, reason: 'pause', fixture: null,
      config, level, tuning: defaultRuntimeTuning(config, level), state: s };
    const map = new Map<string, string>(), storage = { getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
    expect(writeCheckpoint(c, storage).ok).toBe(true); expect(map.has(CHECKPOINT_KEY)).toBe(true);
    const found = readCheckpoint(storage); expect(found.status).toBe('valid'); if (found.status !== 'valid') throw Error('Invalid checkpoint');
    const replay = simulationFromCheckpoint(found.checkpoint); expect(replay.getState()).toEqual(s);
    expect(replay.consumeArtilleryEvents()).toEqual([]);
    sim.consumeArtilleryEvents();
    for (let i = 0; i < 240; i++) { step(sim); step(replay); expect(replay.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents()); }
    expect(replay.getState()).toEqual(sim.getState());
    const before = replay.getState(), bad = structuredClone(before); bad.defenseTank!.hp = -1;
    expect(() => replay.restoreState(bad)).toThrow(); expect(replay.getState()).toEqual(before);
  });
  it('reports exact totals, bullet-only accuracy, zero-shot accuracy and readable clear time', () => {
    const stats = { gruntKills: 5, heavyKills: 3, giantKills: 1, shotsFired: 100, shotsHit: 35, grenadesUsed: 20 };
    expect(combatResults(stats, 90).totalKills).toBe(9); expect(combatResults(stats, 90).accuracy).toBe(.35);
    expect(clearResultRows(stats, 90)).toContainEqual(['Clear Time', '1:30.0']);
    expect(clearResultRows(stats, 90)).toContainEqual(['Accuracy', '35.0%']);
    expect(combatResults({ ...stats, shotsFired: 0, shotsHit: 0 }, 0).accuracy).toBe(0);
  });
});
