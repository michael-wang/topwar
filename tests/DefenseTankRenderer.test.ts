import { expect, it } from 'vitest';
import * as THREE from 'three';
import { DefenseTankRenderer, TANK_DEATH_MS } from '../src/rendering/DefenseTankRenderer';
import { startDefenseTank } from '../src/simulation/defenseTank';
import config from './helpers/ShippingConfig';

const c = config.catharsis!.defenseTank!;
it('shows the landing ramp, doors and articulated tank, and freezes movement and recoil at the same simulation time', () => {
  const scene = new THREE.Scene(), r = new DefenseTankRenderer(scene), tank = startDefenseTank(0, 17, c);
  r.update({ state: tank, config: c, elapsedSeconds: 0 }, 0);
  const landing = scene.getObjectByName('tank-landing-ramp')!;
  expect(landing.visible).toBe(true); expect(r.group.position.y).toBeGreaterThan(0);
  expect(r.group.visible).toBe(false);
  r.presentEntrance({ z: 51.2, victims: [{ id: 1, x: 0, z: 32, archetype: 'heavy' }] }, 500);
  r.update({ state: tank, config: c, elapsedSeconds: .5 }, 500);
  expect(r.group.visible).toBe(true);
  const shock = scene.getObjectByName('tank-entrance-shockwave')!;
  r.update({ state: tank, config: c, elapsedSeconds: .7 }, 700);
  expect(shock.visible).toBe(true); const scale = shock.scale.clone();
  r.update({ state: tank, config: c, elapsedSeconds: .7 }, 700);
  expect(shock.scale).toEqual(scale);
  expect(scene.getObjectByName('tank-tracks')).toBeInstanceOf(THREE.InstancedMesh);
  const tracks = scene.getObjectByName('tank-tracks') as THREE.InstancedMesh;
  const first = Array.from(tracks.instanceMatrix.array);
  tank.status = 'active'; tank.z = c.battleZ;
  r.update({ state: tank, config: c, elapsedSeconds: 3 }, 3000); r.recoil(2.9, 3);
  const turret = scene.getObjectByName('defense-tank-turret')!;
  expect(turret.position.z).toBeGreaterThan(0); const pose = Array.from(tracks.instanceMatrix.array);
  expect(pose).not.toEqual(first);
  r.update({ state: tank, config: c, elapsedSeconds: 3 }, 9000); r.recoil(2.9, 3);
  expect(Array.from(tracks.instanceMatrix.array)).toEqual(pose);
  r.dispose(); expect(scene.children).toHaveLength(0);
});
it('keeps a damaged wreck and bounded consecutive/final explosions; restoring a finished Boss does not replay them', () => {
  const scene = new THREE.Scene(), r = new DefenseTankRenderer(scene), tank = startDefenseTank(0, 17, c);
  tank.status = 'defeated'; tank.hp = 0; tank.phase = 3; tank.z = c.battleZ; tank.defeatedAtSeconds = 10;
  const frame = { state: tank, config: c, elapsedSeconds: 10 };
  const count = scene.children.length;
  for (let cycle = 0; cycle < 3; cycle++) {
    r.reset();
    for (const t of [0, 350, 700, 1050, 1400, 1800, 2200, TANK_DEATH_MS]) r.update(frame, cycle * 5000 + t);
    expect(r.group.visible).toBe(true); expect(r.group.position.y).toBeLessThan(0); expect(scene.children.length).toBe(count);
  }
  r.restore(frame, 20000); r.update(frame, 20000);
  expect(scene.children.filter(o => o.name.startsWith('grenade-') && o.visible)).toHaveLength(0);
  expect(r.group.visible).toBe(true); r.dispose(); expect(scene.children).toHaveLength(0);
});
