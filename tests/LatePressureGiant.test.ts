import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { pressureGroupSize } from '../src/simulation/enemies/latePressure';
import { laneCompositionForRow } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';
const config = GameConfigSchema.parse(data), balance = config.catharsis!;
const make = () => new Simulation({ seed: 17, level: LevelDefinitionSchema.parse(levelData),
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: .6, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: config.weapon.rifle, rocket: config.weapon.rocket };
const step = (sim: Simulation, count: number) => { for (let i = 0; i < count; i++) sim.step(1 / 60, { targetX: 0 }, tuning); };

it('spawns the authored Giant on the exact ordinary kill tick reaching Lv4, alongside retained waves', () => {
  const sim = make(), s = sim.getState();
  s.progression = { level: 3, xp: 109 };
  s.enemies.push({ id: s.enemyStream!.nextEnemyId++, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 3, hp: 1 });
  s.projectiles = [{ id: 1, kind: 'rifle', tier: 1, lane: 2, x: 0, z: 2.5, slopeX: 0,
    speed: 60, damage: config.tiers.tier1Power, remainingRange: 80, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 }];
  s.weapons.nextProjectileId = 2;
  sim.restoreState(s); step(sim, 1);
  const first = sim.getState(), giant = first.enemies.find(e => e.archetype === 'giant')!;
  expect(first.progression).toEqual({ level: 4, xp: 0 });
  expect(first.giantEncounter).toEqual({ scheduledAtSeconds: first.elapsedSeconds, spawned: true });
  expect(giant).toMatchObject({ hp: 172, z: first.player.z + 38 });
  const counts = [1, 2, 3].map(lane => ({ lane, count: first.enemies.filter(e => e.id !== giant.id && e.lane === lane).length }));
  counts.sort((a, b) => a.count - b.count || Math.abs(a.lane - 2) - Math.abs(b.lane - 2) || a.lane - b.lane);
  expect(giant.lane).toBe(counts[0].lane);
  expect(first.enemies.some(e => e.archetype === 'grunt')).toBe(true);
  expect(first.enemies.some(e => e.archetype === 'heavy')).toBe(true);
  const clone = make(); clone.restoreState(JSON.parse(JSON.stringify(first)));
  step(sim, 360); step(clone, 360);
  expect(clone.getState()).toEqual(sim.getState());
  expect(sim.getState().enemies.filter(e => e.archetype === 'giant')).toHaveLength(1);
  const killed = sim.getState(); killed.enemies = killed.enemies.filter(e => e.id !== giant.id);
  sim.restoreState(killed); step(sim, 360);
  expect(sim.getState().enemies.some(e => e.archetype === 'giant')).toBe(false);
  expect(make().getState().giantEncounter).toEqual({ scheduledAtSeconds: null, spawned: false });
});

it('changes only future group quantity from LV5 and retains bounded deterministic crowds', () => {
  expect([1,2,3,4,5,6,7].map(l => pressureGroupSize(balance, l))).toEqual([24,24,24,24,30,60,35]);
  expect(pressureGroupSize(balance, 100)).toBe(40);
  const live = { ...balance, groupSize: pressureGroupSize(balance, 7) };
  const group = laneCompositionForRow(120, 17, live, 3.2);
  expect(group).toEqual(laneCompositionForRow(120, 17, live, 3.2));
  expect(group).toHaveLength(35);
  expect(group.every(e => e.z >= -9 && e.z <= 0 && Math.abs(e.x) <= 2.8 + 1e-12)).toBe(true);
  expect(new Set(group.map(e => e.lane)).size).toBe(3);
  expect(balance.heavyHp).toBe(15); expect(balance.gruntSpeed).toBe(.85);
  expect(config.weapon.rifle.fireRate).toBe(3);
});

it('preserves the old LV1–4 stream exactly before any progression unlock', () => {
  const sim = make(); const before = sim.getState();
  const old = new Simulation({ seed: 17, level: LevelDefinitionSchema.parse(levelData),
    startSquad: 1, startRocketCount: 0, tiers: config.tiers,
    catharsis: { balance: { ...balance, pressureMultipliers: [1], giant: { ...balance.giant, enabled: false } }, trackHalfWidth: 3.2 } });
  step(sim, 1200); step(old, 1200);
  expect(sim.getState().enemies).toEqual(old.getState().enemies);
  expect(sim.getState().progression).toEqual(old.getState().progression);
  expect(before.enemies).toHaveLength(120);
  expect(sim.getState().giantEncounter).toEqual({ scheduledAtSeconds: null, spawned: false });
});

it('preserves a historical Lv5 six-second introduction, restores its pending clock and never respawns after death', () => {
  const sim = make(), state = sim.getState();
  state.catharsis!.balance.giant = { ...balance.giant, unlockLevel: 5, introDelaySeconds: 6 };
  state.progression = { level: 5, xp: 0 }; state.weapons.rifleCooldownRemainingSeconds = 1000;
  sim.restoreState(state); step(sim, 1);
  const pending = sim.getState(); expect(pending.giantEncounter!.scheduledAtSeconds).toBeCloseTo(6 + 1 / 60);
  const restored = make(); restored.restoreState(JSON.parse(JSON.stringify(pending)));
  pending.giantEncounter!.spawned = true;
  expect(sim.getState().giantEncounter!.spawned).toBe(false);
  step(sim, 365); step(restored, 365);
  expect(sim.getState()).toEqual(restored.getState());
  const introduced = sim.getState(), giant = introduced.enemies.find(e => e.archetype === 'giant')!;
  expect(giant.hp).toBe(172); expect(giant.lane).toBeGreaterThan(0); expect(giant.lane).toBeLessThan(4);
  expect(giant.z - introduced.player.z).toBeGreaterThan(balance.defenseSpawnAheadDistance - balance.crowdDepthSpan - .1);
  introduced.enemies = introduced.enemies.filter(e => e.id !== giant.id);
  sim.restoreState(introduced); step(sim, 600);
  expect(sim.getState().enemies.some(e => e.archetype === 'giant')).toBe(false);
  expect(sim.getState().giantEncounter!.spawned).toBe(true);
  expect(make().getState().giantEncounter).toEqual({ scheduledAtSeconds: null, spawned: false });
});

it('awards Giant XP only on a player kill, while HP and movement stay independent from power', () => {
  const sim = make(), state = sim.getState();
  state.progression = { level: 1, xp: 0 }; state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 3, hp: 28 }];
  state.weapons.rifleCooldownRemainingSeconds = 1000;
  sim.restoreState(state); step(sim, 60);
  expect(sim.getState().enemies[0].z).toBeCloseTo(2.32);
  const injured = sim.getState(); injured.enemies[0].hp = 1; injured.weapons.rifleCooldownRemainingSeconds = 0;
  sim.restoreState(injured); step(sim, 60);
  expect(sim.getState().progression).toEqual({level:3,xp:32});
  step(sim, 60); expect(sim.getState().progression).toEqual({level:3,xp:32});
  injured.enemies[0].z = injured.player.z - 2; injured.weapons.rifleCooldownRemainingSeconds = 1000;
  sim.restoreState(injured); step(sim, 1);
  expect(sim.getState().progression!.xp).toBe(0);
});

it('projects Giant maximum, proportions and gait without persisting renderer state', () => {
  const sim = make(), state = sim.getState();
  state.progression = { level: 6, xp: 0 }; state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 20, hp: balance.giant.hp }];
  sim.restoreState(state);
  const render = projectRenderState(sim.getFrameState(), { catharsis: state.catharsis,
    formationSpacing: .45, trackHalfWidth: 3.2, defenseLineOffset: 1.5, bossVisualScale: 7 });
  expect(render.enemies[0].maxHp).toBe(172); expect(render.enemies[0].gaitCycleMs).toBe(850);
  expect(render.enemies[0].visualScaleY).toBeCloseTo(1.4 * 1.9);
  expect(sim.getState().enemies[0]).not.toHaveProperty('maxHp');
  sim.setCatharsisBalance({ ...balance, giant: { ...balance.giant, hp: 280 } });
  expect(sim.getState().enemies[0].hp).toBe(280);
  expect(sim.getState().catharsis!.balance.heavyHp).toBe(15);
  const bad = sim.getState(); bad.giantEncounter!.scheduledAtSeconds = -1;
  expect(() => sim.restoreState(bad)).toThrow();
});


it.each([[1, 44], [17, 38], [42, 30]])('takes 37–39 seconds of retained Rifle Stage III focused fire to kill the fixed Giant (seed %i)', (seed, distance) => {
  const sim = new Simulation({ seed, level: { id: 'focus', length: 1000, enemyGroups: [], upgradeGates: [] },
    startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance: { ...balance, progression: { ...balance.progression, levelPlan: balance.progression.levelPlan.slice(0,5), xpRequirements: balance.progression.xpRequirements.slice(0,4) } }, trackHalfWidth: 3.2 } });
  const initial = sim.getState(); initial.progression = { level: 6, xp: 0 };
  initial.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  initial.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane: 2, x: 0, z: distance, hp: balance.giant.hp }];
  sim.restoreState(initial);
  let firstHit: number | undefined;
  while (sim.getFrameState().enemies.length && sim.getFrameState().elapsedSeconds < 45) {
    step(sim, 1);
    const frame = sim.getFrameState();
    if (firstHit === undefined && frame.enemies[0]?.hp < balance.giant.hp) firstHit = frame.elapsedSeconds;
  }
  const result = sim.getFrameState();
  expect(balance.giant.hp).toBe(172);
  expect(result.enemies).toHaveLength(0);
  expect(result.squad.count).toBe(1);
  expect(result.progression).toEqual({ level: 6, xp: 0 });
  expect(firstHit).toBeDefined();
  expect(result.elapsedSeconds - firstHit!).toBeGreaterThanOrEqual(37);
  expect(result.elapsedSeconds - firstHit!).toBeLessThanOrEqual(39);
});
