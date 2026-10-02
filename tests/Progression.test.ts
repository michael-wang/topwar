import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation } from '../src/simulation/Simulation';
import { requiredXp, grantXp, effectiveRifleFireRate } from '../src/simulation/progression';
import { laneCompositionForRow, attackLanePositions } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';
import { enemyRunFrame, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
const config = GameConfigSchema.parse(data);
const balance = config.catharsis!;
const curve = balance.progression;
const make = () => new Simulation({ seed: 17, level: { id: 'xp-test', length: 1000, enemyGroups: [], upgradeGates: [] },
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: 0, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: config.weapon.rifle, rocket: config.weapon.rocket };
it('starts at level one and uses the authored increasing XP curve with repeated overflow', () => {
  expect(make().getState().progression).toEqual({ level: 1, xp: 0 });
  expect([1, 2, 3, 4, 5, 6].map(level => requiredXp(level, curve))).toEqual([28, 60, 110, 180, 280, 420]);
  expect(grantXp({ level: 1, xp: 27 }, 10, curve)).toEqual({ level: 2, xp: 9 });
  expect(grantXp({ level: 1, xp: 0 }, 205, curve)).toEqual({ level: 4, xp: 7 });
});
it.each([['grunt', 1, 1], ['heavy', 15, 10]] as const)('awards %s XP only on its lethal hit, once', (archetype, hp, xp) => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype, lane: 2, x: .4, z: 3, hp }]; sim.restoreState(state);
  for (let hit = 1; hit <= hp; hit++) {
    const current = sim.getState(); current.weapons.rifleCooldownRemainingSeconds = 0; sim.restoreState(current);
    sim.step(.06, { targetX: 0 }, tuning);
    expect(sim.getState().progression!.xp).toBe(hit === hp ? xp : 0);
  }
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().progression).toEqual({ level: 1, xp });
});
it('does not award XP for an enemy leaking through the defense line', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -2.8, z: -2, hp: 1 }];
  sim.restoreState(state); sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().progression).toEqual({ level: 1, xp: 0 });
});
it('does not award XP for direct contact casualties', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: .1, hp: 1 }];
  state.weapons.rifleCooldownRemainingSeconds = 10;
  sim.restoreState(state); sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().progression).toEqual({ level: 1, xp: 0 });
});
it.each([1, 2, 3])('schedules effective Rifle fire at level %i without mutating base tuning', level => {
  expect(effectiveRifleFireRate(3, level, curve)).toBe(level + 2);
  expect(effectiveRifleFireRate(2.5, level, curve)).toBe(level + 1.5);
  const sim = make(); const state = sim.getState(); state.progression = { level, xp: 0 }; sim.restoreState(state);
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().weapons.nextProjectileId - 1).toBeGreaterThanOrEqual(2 * (level + 2));
  expect(sim.getState().weapons.nextProjectileId - 1).toBeLessThanOrEqual(2 * (level + 2) + 1);
  expect(tuning.rifle.fireRate).toBe(3);
  expect(sim.getState().catharsis!.balance.heavyHp).toBe(15);
});
it('shortens the pending shot promptly when a kill levels up', () => {
  const sim = make(); const state = sim.getState(); state.progression!.xp = 27;
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 3, hp: 1 }];
  sim.restoreState(state); sim.step(.06, { targetX: 0 }, tuning);
  expect(sim.getState().progression).toEqual({ level: 2, xp: 0 });
  expect(sim.getState().weapons.rifleCooldownRemainingSeconds).toBeLessThanOrEqual(.25);
});
it('restores progression deterministically, validates it, and new runs reset it', () => {
  const sim = make(); const state = sim.getState(); state.progression = { level: 3, xp: 11 }; sim.restoreState(state);
  const clone = make(); clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  state.progression.xp = 0;
  for (let tick = 0; tick < 90; tick++) { sim.step(1 / 60, { targetX: 0 }, tuning); clone.step(1 / 60, { targetX: 0 }, tuning); }
  expect(clone.getState()).toEqual(sim.getState());
  const bad = sim.getState(); bad.progression!.xp = 110; expect(() => clone.restoreState(bad)).toThrow(/progression/);
  expect(make().getState().progression).toEqual({ level: 1, xp: 0 });
});
it('stages a Heavy deterministically in front of its own lane without changing population or bounds', () => {
  const lanes = attackLanePositions(5, 3.2, balance.edgeInset);
  for (let row = 0; row < 180; row += 6) {
    const group = laneCompositionForRow(row, 17, { ...balance, heavyChance: 1 }, 3.2);
    expect(group).toEqual(laneCompositionForRow(row, 17, { ...balance, heavyChance: 1 }, 3.2));
    expect(group).toHaveLength(24);
    const heavy = group.find(enemy => enemy.archetype === 'heavy')!;
    expect(heavy.x).toBe(lanes[heavy.lane!]); expect(heavy.z).toBe(-9);
    for (const enemy of group) {
      expect(enemy.z).toBeGreaterThanOrEqual(-9); expect(enemy.z).toBeLessThanOrEqual(0);
      if (enemy !== heavy && enemy.lane === heavy.lane) expect(enemy.z - heavy.z).toBeGreaterThanOrEqual(2.5);
    }
  }
});
it('projects current Heavy max HP and keeps slower gait entirely outside gameplay', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 20, hp: 15 }]; sim.restoreState(state);
  sim.setCatharsisBalance({ ...balance, heavyHp: 30 });
  const view = projectRenderState(sim.getFrameState(), { catharsis: sim.getFrameState().catharsis,
    trackHalfWidth: 3.2, defenseLineOffset: 1.5, formationSpacing: .45, bossVisualScale: 7 });
  expect(view.enemies[0].maxHp).toBe(30);
  expect(enemyRunFrame(1, 0, 650)).toBe(enemyRunFrame(1, 650, 650));
  expect(enemyWalkPose(1, 0, 650).leftArm).toBeCloseTo(enemyWalkPose(1, 650, 650).leftArm);
  for (let tick = 0; tick < 60; tick++) { enemyRunFrame(1, tick * 16, 650); sim.step(1 / 60, { targetX: 0 }, tuning); }
  expect(sim.getState().enemies[0].z).toBeCloseTo(19.88);
});

it('awards each penetrating kill and retained rocket kill through the same kill boundary', () => {
  for (const kind of ['rifle', 'rocket'] as const) {
    const sim = make(); const state = sim.getState();
    state.enemies = [1, 2].map(id => ({ id, tier: 1, archetype: 'grunt' as const, lane: 2, x: 0, z: 3 + id * .2, hp: 1 }));
    state.weapons.rifleCooldownRemainingSeconds = 10;
    state.projectiles = [{ id: 1, tier: kind === 'rifle' ? 2 : 0, kind, ...(kind === 'rifle' ? { lane: 2, slopeX: 0 } : {}), x: 0, z: 2, speed: 60,
      damage: 100, remainingRange: 30, blastRadius: kind === 'rocket' ? 2 : 0,
      hitRadiusBonus: 0, penetrationRemaining: kind === 'rifle' ? config.tiers.mergeCount : 0 }];
    state.weapons.nextProjectileId = 2;
    sim.restoreState(state); sim.step(.06, { targetX: 0 }, tuning);
    expect(sim.getState().enemies).toHaveLength(0);
    expect(sim.getState().progression!.xp).toBe(2);
  }
});
it('uses the tuned base rate in actual level-three scheduling', () => {
  const sim = make(); const state = sim.getState(); state.progression = { level: 3, xp: 0 }; sim.restoreState(state);
  const live = { ...tuning, rifle: { ...tuning.rifle, fireRate: 2.5 } };
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, live);
  expect(sim.getState().weapons.nextProjectileId - 1).toBe(9);
  expect(live.rifle.fireRate).toBe(2.5);
});

it('uses successive ceil growth beyond the table without a level cap', () => {
  expect(requiredXp(7, curve)).toBe(609);
  expect(requiredXp(8, curve)).toBe(884);
  expect(requiredXp(9, { ...curve, xpFallbackMultiplier: 2 })).toBe(3360);
  expect(grantXp({ level: 6, xp: 419 }, 620, curve)).toEqual({ level: 8, xp: 10 });
});
it('validates the table balance in snapshots and rejects superseded linear fields', () => {
  const sim = make(); const state = sim.getState();
  state.catharsis!.balance.progression.xpRequirements = [30, 70];
  state.progression = { level: 3, xp: 100 };
  sim.restoreState(JSON.parse(JSON.stringify(state)));
  expect(requiredXp(3, sim.getState().catharsis!.balance.progression)).toBe(102);
  const bad = sim.getState(); bad.catharsis!.balance.progression.xpRequirements = [];
  expect(() => sim.restoreState(bad)).toThrow();
  const old = sim.getState() as any;
  old.catharsis.balance.progression = { firstLevelXp: 16, xpRequirementStep: 12, gruntKillXp: 1, heavyKillXp: 10, fireRatePerLevel: 1 };
  expect(() => sim.restoreState(old)).toThrow();
});

it('keeps LV1–4 rates fixed and tapers LV5 and later gains without changing base or enemies', () => {
  expect([1,2,3,4,5,6,7,8].map(level => effectiveRifleFireRate(3, level, curve)))
    .toEqual([3,4,5,6,6.5,6.9,6.9,7.22]);
  expect(effectiveRifleFireRate(2.5, 5, curve)).toBe(6);
  const sim = make(); const state = sim.getState(); state.progression = { level: 5, xp: 0 };
  sim.restoreState(state);
  for (let tick=0;tick<120;tick++) sim.step(1/60,{targetX:0},tuning);
  expect(sim.getState().weapons.nextProjectileId - 1).toBe(13);
  expect(sim.getState().catharsis!.balance.heavyHp).toBe(15);
  expect(sim.getState().catharsis!.balance.groupSize).toBe(24);
});


it('restores and validates runtime Rifle taper balance independently from XP costs', () => {
  const sim = make(); const state = sim.getState();
  state.catharsis!.balance.progression.fireRateTaperFirstGain = .3;
  state.catharsis!.balance.progression.fireRateTaperDecay = .5;
  state.progression = { level: 6, xp: 10 };
  sim.restoreState(JSON.parse(JSON.stringify(state)));
  const restored = sim.getState();
  expect(effectiveRifleFireRate(3, 6, restored.catharsis!.balance.progression)).toBe(6.45);
  expect(restored.progression).toEqual({ level: 6, xp: 10 });
  expect(restored.catharsis!.balance.progression.xpRequirements).toEqual([28,60,110,180,280,420]);
  restored.catharsis!.balance.progression.fireRateTaperDecay = 1;
  expect(() => sim.restoreState(restored)).toThrow();
});
