import { strict as assert } from 'node:assert';
export async function checkDiagnosticHooks(observed, control) {
  let checks = 0;
  function stepCase(setup, verify) {
    const sim = observed.makeRun(1, 'lv10'), plain = control.makeRun(1, 'lv10');
    const state = sim.getState();
    state.enemies = []; state.enemyStream.nextEnemyId = 1; state.projectiles = [];
    state.defenseWaves.nextAtSeconds = 100;
    setup(state);
    sim.restoreState(state); plain.restoreState(state);
    const initial = sim.getState(), collector = new observed.SurvivalDiagnosis(initial);
    observed.bindObserver(collector); collector.begin(initial);
    try { sim.step(1 / 60, { targetX: 0 }, observed.pilotTuning); }
    finally { observed.bindObserver(); }
    plain.step(1 / 60, { targetX: 0 }, control.pilotTuning);
    const after = sim.getState(); assert.deepEqual(after, plain.getState());
    const presentations = sim.consumePresentationEvents();
    assert.deepEqual(presentations, plain.consumePresentationEvents());
    assert.deepEqual(sim.consumeGrenadeEvents(), plain.consumeGrenadeEvents());
    assert.deepEqual(sim.consumeArtilleryEvents(), plain.consumeArtilleryEvents());
    collector.end(after, initial, presentations);
    verify(collector.finish(after)); checks++;
  }
  const projectile = (s, enemy, damage = 1) => {
    s.projectiles = [{ id: 1, kind: 'machineGun', tier: 1, lane: enemy.lane, x: enemy.x, z: enemy.z - .8,
      damage: damage * observed.gameData.tiers.tier1Power, speed: 60, remainingRange: 80, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0, slopeX: 0, memberIndex: 0 }];
    s.weapons.nextProjectileId = 2;
  };
  stepCase(s => {
    s.defenseWaves.nextAtSeconds = .01;
    const preview = structuredClone(s);
    observed.advanceDefenseWaves(preview.defenseWaves, preview, 1 / 60, observed.effectiveSeed(s.seed, observed.levelData.enemyStream.seed), true);
    const enemy = [...preview.enemies].sort((a, b) => a.z - b.z || a.id - b.id)[0];
    projectile(s, enemy, enemy.hp);
  }, r => {
    const c = r.cohorts.find(c => c.kind === 'survival-wave');
    assert.equal(c.members.length, 42);
    const killed = c.members.filter(e => e.death);
    assert.equal(killed.length, 1); assert.equal(killed[0].death.at, c.at);
    assert.equal(c.deaths.projectile, 1); assert.ok(c.nominalXp > 0); assert.equal(c.usableXp, 0);
    assert.equal(c.arrivals[20].censored, true);
  });
  stepCase(s => {
    s.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 5, hp: 15 }];
    s.enemyStream.nextEnemyId = 2; s.progression = { level: 9, xp: 449 };
    s.squad = { count: 2, rifleCounts: [2], rifleRemainder: 0, rocketCount: 0 };
    s.weapons.rifleMemberCooldowns = [0, 0];
    projectile(s, s.enemies[0], 15);
  }, r => {
    assert.equal(r.nominalXp, 10); assert.equal(r.usableXp, 1); assert.equal(r.endLevel, 10);
    assert.equal(r.cohorts[0].members[0].death.cause, 'projectile');
  });
  stepCase(s => {
    s.elapsedSeconds = .65; s.tick = 39;
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 6, hp: 1 },
      { id: 2, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 6.3, hp: 15 }];
    s.enemyStream.nextEnemyId = 3;
    s.grenade.flight = { startX: 0, startZ: 0, targetX: 0, targetZ: 6, startedAtSeconds: 0,
      flightSeconds: .65, damageEnemyHp: 9, blastRadius: 4 };
  }, r => {
    assert.equal(r.cohorts[0].deaths.grenade, 1); assert.equal(r.nominalXp, 1);
    assert.equal(r.cohorts[0].members[1].damage.grenade, 9);
  });
  stepCase(s => {
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: .1, hp: 1 }];
    s.enemyStream.nextEnemyId = 2; s.weapons.rifleCooldownRemainingSeconds = 1;
    s.weapons.rifleMemberCooldowns = [1, 1, 1];
  }, r => {
    assert.equal(r.cohorts[0].deaths.contact, 1); assert.equal(r.nominalXp, 0); assert.equal(r.usableXp, 0);
    assert.equal(r.cohorts[0].combatCleared, false);
  });
  stepCase(s => {
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -3.6, z: -3, hp: 1 }];
    s.enemyStream.nextEnemyId = 2;
  }, r => { assert.equal(r.cohorts[0].deaths.leak, 1); assert.equal(r.nominalXp, 0); });
  stepCase(s => {
    s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -3.6, z: 30.005, hp: 1 }];
    s.enemyStream.nextEnemyId = 2;
  }, r => {
    assert.equal(r.cohorts[0].crossings[30].count, 1); assert.equal(r.cohorts[0].crossings[30].hp, 1);
    assert.equal(r.cohorts[0].crossings[20].count, 0);
    assert.equal(r.cohorts[0].arrivals[20].firstLoadout, null);
  });
  console.log(`Passed ${checks} QA hook integration cases; every case exactly matches unobserved state and events.`);
}
