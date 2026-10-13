import { expect, it } from 'vitest';
import * as THREE from 'three';
import { DefenseTankRenderer, TANK_DEATH_MS } from '../src/rendering/DefenseTankRenderer';
import { startDefenseTank } from '../src/simulation/defenseTank';
import config from './helpers/ShippingConfig';

const c = config.catharsis!.defenseTank!;
it('keeps purple armor and tall turret while local flash layers pulse; ship doors never flash and Restore/Retry clear feedback', () => {
  const scene = new THREE.Scene(), r = new DefenseTankRenderer(scene), tank = startDefenseTank(0, 17, c);
  tank.status = 'active'; tank.z = c.battleZ;
  const frame = { state: tank, config: c, elapsedSeconds: 3 };
  r.update(frame, 3000);
  const flashes: THREE.Mesh[] = []; r.group.traverse(o => { if (o.name === 'tank-hit-flash') flashes.push(o as THREE.Mesh); });
  expect(flashes).toHaveLength(4); expect(flashes.every(m => !m.visible)).toBe(true);
  const armor = r.group.children.find(o => o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial
    && o.material.color.getHexString() === '8056ad') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const door = scene.getObjectByName('tank-landing-ramp')!.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const doorColor = door.material.color.clone();
  expect(scene.getObjectByName('defense-tank-turret')!.position.y).toBe(2.4);
  const material = flashes[0].material as THREE.MeshBasicMaterial, children = [...scene.children];
  tank.lastHitAtSeconds = 3; r.update(frame, 3000); expect(flashes.every(m => m.visible)).toBe(true);
  const initialOpacity = material.opacity;
  tank.lastHitAtSeconds = frame.elapsedSeconds = 3.045;
  r.update(frame, 3045); expect(material.opacity).toBeLessThan(initialOpacity);
  const pausedOpacity = material.opacity; r.update(frame, 3045); expect(material.opacity).toBe(pausedOpacity);
  tank.phase = 3; tank.hp = 1950; tank.lastHitAtSeconds = frame.elapsedSeconds = 3.1; r.update(frame, 3100);
  expect(flashes.every(m => !m.visible)).toBe(true); expect(armor.material.color.getHexString()).toBe('8056ad');
  expect(door.material.color).toEqual(doorColor); expect(door.material.emissive.getHex()).toBe(0);
  r.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [], tankDamage: 9 }], 3100);
  r.update(frame, 3100); expect(material.opacity).toBeGreaterThan(initialOpacity);
  r.update(frame, 3280); expect(flashes.every(m => m.visible)).toBe(true);
  r.restore(frame, 3280); r.update(frame, 3280); expect(flashes.every(m => !m.visible)).toBe(true);
  expect(scene.children).toEqual(children);
  tank.status = 'defeated'; tank.hp = 0; r.update(frame, 3500);
  r.reset(); expect(armor.material.color.getHexString()).toBe('8056ad');
  r.dispose(); expect(scene.children).toHaveLength(0);
});
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
  const smoke = r.group.children.find(o => o instanceof THREE.InstancedMesh && o.count === 8) as THREE.InstancedMesh;
  const flames = r.group.getObjectByName('tank-wreck-flames') as THREE.InstancedMesh;
  expect(flames.visible).toBe(true); expect(flames.count).toBe(3);
  const geometry = smoke.geometry, initialSmoke = Array.from(smoke.instanceMatrix.array);
  r.update(frame, 20100);
  const movingSmoke = Array.from(smoke.instanceMatrix.array);
  const fire = Array.from(flames.instanceMatrix.array);
  expect(movingSmoke).not.toEqual(initialSmoke); // Frozen combat time must not freeze victory smoke.
  r.update(frame, 20100); expect(Array.from(smoke.instanceMatrix.array)).toEqual(movingSmoke);
  expect(Array.from(flames.instanceMatrix.array)).toEqual(fire);
  expect(smoke.geometry).toBe(geometry); expect(smoke.count).toBe(8); expect(smoke.visible).toBe(true);
  expect(r.group.visible).toBe(true); r.reset(); expect(flames.visible).toBe(false);
  r.dispose(); expect(scene.children).toHaveLength(0);
});
