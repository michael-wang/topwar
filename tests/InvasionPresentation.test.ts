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
  const opening = new InvasionPresentation(projected, config.catharsis!), references = new Map();
  let previous = 0;
  const positions = new Map<number, { x: number; z: number }>();
  let walkers = 0;
  for (let frame = 0; frame < 900; frame++) {
    const state = opening.sample(frame / 60);
    expect(state.enemies.length).toBeGreaterThanOrEqual(previous);
    if (frame / 60 < 7) expect(state.enemies.length - previous).toBeLessThanOrEqual(1);
    for (const enemy of state.enemies) {
      const previousPosition = positions.get(enemy.id);
      if (previousPosition) {
        const speed = Math.hypot(enemy.x-previousPosition.x,enemy.z-previousPosition.z)*60;
        expect(speed).toBeLessThanOrEqual((enemy.archetype==='heavy'?config.catharsis!.heavySpeed:config.catharsis!.gruntSpeed)+1e-9);
        if(speed>0)walkers++;
      }
      positions.set(enemy.id,{x:enemy.x,z:enemy.z});
      if (references.has(enemy.id)) expect(enemy).toBe(references.get(enemy.id));
      references.set(enemy.id, enemy);
    }
    previous = state.enemies.length;
  }
  expect(walkers).toBeGreaterThan(60);
  expect(opening.sample(0).enemies).toHaveLength(0);
  expect(opening.sample(5.1).enemies).toHaveLength(1);
  expect(opening.sample(8).enemies.length).toBeGreaterThan(10);
  for (const reduced of [false, true]) expect([...opening.sample(11.074, reduced).enemies].sort((a,b)=>a.id-b.id))
    .toEqual([...projected.enemies].sort((a,b)=>a.id-b.id));
  expect(sim.getState()).toEqual(before);
  expect([...opening.poseTimes.values()].every(t=>t===0)).toBe(true);
  const mixed = { ...projected, enemies: projected.enemies.map((e,i)=>({...e,archetype:i%2?'heavy' as const:'grunt' as const})) };
  const heavyTrial = new InvasionPresentation(mixed,config.catharsis!);
  const previousMixed = new Map<number,{x:number;z:number}>();
  for(let frame=0;frame<840;frame++) for(const e of heavyTrial.sample(frame/60).enemies) {
    const last=previousMixed.get(e.id);
    if(last)expect(Math.hypot(e.x-last.x,e.z-last.z)*60).toBeLessThanOrEqual((e.archetype==='heavy'?.72:.85)+1e-9);
    previousMixed.set(e.id,{x:e.x,z:e.z});
  }
  opening.setBriefing(3.7, 13.924);
  expect(opening.sample(5.69).enemies).toHaveLength(0);
  for (let i = 0; i < 6; i++) expect(opening.sample(5.701 + i * .35).enemies).toHaveLength(i + 1);
  expect([...opening.sample(13.574).enemies].sort((a,b)=>a.id-b.id)).toEqual([...projected.enemies].sort((a,b)=>a.id-b.id));
  const tuning = { moveSpeed: config.player.moveSpeed, forwardSpeed: config.player.forwardSpeed,
    trackHalfWidth: config.track.halfWidth, defenseLineOffset: config.track.defenseLineOffset,
    formationSpacing: config.player.formationSpacing, memberRadius: config.player.memberRadius,
    normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
    rifle: config.weapon.rifle, rocket: config.weapon.rocket };
  for (let tick = 0; tick < 120; tick++) { sim.step(1/60,{targetX:0},tuning); control.step(1/60,{targetX:0},tuning); }
  expect(sim.getState()).toEqual(control.getState());
});
