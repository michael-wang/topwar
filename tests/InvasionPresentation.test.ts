import { expect, it } from 'vitest';
import { InvasionPresentation } from '../src/presentation/InvasionPresentation';
import { Simulation } from '../src/simulation/Simulation';
import { projectRenderState } from '../src/app/projectRenderState';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

it.each([17, 17476, 0xffffffff])('preserves T=0 and subsequent deterministic simulation for seed %s', seed => {
  const make = () => new Simulation({ seed, level: LevelDefinitionSchema.parse(levelData), startSquad: 1,
    startRocketCount: 0, tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } });
  const sim = make(), control = make(), before = sim.getState();
  const projected = projectRenderState(sim.getFrameState(), { formationSpacing: config.player.formationSpacing,
    trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset, catharsis: before.catharsis });
  const opening = new InvasionPresentation(projected), references = new Map();
  let previous = 0;
  for (let frame = 0; frame < 900; frame++) {
    const state = opening.sample(frame / 60);
    expect(state.enemies.length).toBeGreaterThanOrEqual(previous);
    if (frame / 60 < 4) expect(state.enemies.length - previous).toBeLessThanOrEqual(1);
    for (const enemy of state.enemies) {
      if (references.has(enemy.id)) expect(enemy).toBe(references.get(enemy.id));
      references.set(enemy.id, enemy);
    }
    previous = state.enemies.length;
  }
  expect(opening.sample(0).enemies).toHaveLength(0);
  expect(opening.sample(2.2).enemies).toHaveLength(1);
  expect(opening.sample(6).enemies.length).toBeGreaterThan(10);
  for (const reduced of [false, true]) expect([...opening.sample(10.9, reduced).enemies].sort((a,b)=>a.id-b.id))
    .toEqual([...projected.enemies].sort((a,b)=>a.id-b.id));
  expect(sim.getState()).toEqual(before);
  const tuning = { moveSpeed: config.player.moveSpeed, forwardSpeed: config.player.forwardSpeed,
    trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset,
    formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
    normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
    rifle: config.weapon.rifle, rocket: config.weapon.rocket };
  for (let tick = 0; tick < 120; tick++) { sim.step(1/60,{targetX:0},tuning); control.step(1/60,{targetX:0},tuning); }
  expect(sim.getState()).toEqual(control.getState());
});
