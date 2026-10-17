import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OffshoreTransports, NAVAL_PALETTE, LANDING_CRAFT_LAYOUT } from '../src/rendering/environment/OffshoreTransports';
import { ART } from '../src/art/ArtDirection';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';
import gameData from '../public/game-data/game.json';

it('keeps exactly three asymmetric beach-facing craft for lanes 1/3/5 without scenic carriers', () => {
  const transports = new OffshoreTransports(), ships = transports.group.children;
  expect(ships.map(ship => ship.userData.supportedLane)).toEqual([1, 3, 5]);
  expect(new Set(ships.map(ship => ship.position.z)).size).toBe(3);
  expect(new Set(ships.map(ship => ship.rotation.y)).size).toBe(3);
  expect(ships.every(ship => ship.name.startsWith('enemy-landing-craft') && ship.position.z > ART.coastalDefense.shorelineZ + 8)).toBe(true);
  transports.update(100, 1000, true); expect(transports.group.position.z).toBe(100);
  const poses = ships.map(ship => [ship.position.x, ship.position.z, ship.rotation.y]);
  transports.update(100, 2000, true); expect(ships.map(ship => [ship.position.x, ship.position.z, ship.rotation.y])).toEqual(poses);
  transports.update(100, 2000, false); expect(transports.group.visible).toBe(false); transports.dispose();
});

it.each([350, 390])('separates three readable craft across the sea at %s×844 without cropping', width => {
  const transports = new OffshoreTransports(), camera = new THREE.PerspectiveCamera(48, width / 844, .1, 180);
  applyCoastalCamera(camera); transports.group.updateMatrixWorld(true); let previous = -Infinity;
  for (const ship of transports.group.children) {
    const center = ship.position.clone().project(camera);
    expect(center.x - previous).toBeGreaterThan(.35); previous = center.x;
    const bounds = new THREE.Box3().setFromObject(ship), corners: THREE.Vector3[] = [];
    // Decorative bows must stay behind the real Destroyer's station/wake depth.
    expect(bounds.min.z).toBeGreaterThan(gameData.catharsis.destroyer.z + 4);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z).project(camera));
    const xs = corners.map(p => (p.x + 1) * width / 2);
    expect(Math.min(...xs)).toBeGreaterThan(20); expect(Math.max(...xs)).toBeLessThan(width - 20);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(40);
  }
  expect(LANDING_CRAFT_LAYOUT).toHaveLength(3); transports.dispose();
});

it('shares five military material/geometry batches across craft and disposes each resource once', () => {
  const transports = new OffshoreTransports(), ships = transports.group.children;
  const hull = ships[0].getObjectByName('landing-craft-hull') as THREE.Mesh;
  const colors = hull.geometry.getAttribute('color');
  const swatches = new Set(Array.from({ length: colors.count }, (_, i) => new THREE.Color().fromBufferAttribute(colors, i).getHexString()));
  expect(swatches).toEqual(new Set([NAVAL_PALETTE.hull, NAVAL_PALETTE.accent].map(c => new THREE.Color(c).getHexString())));
  const material = (name: string) => (ships[0].getObjectByName('landing-craft-' + name) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  expect(material('armor').color.getHexString()).toBe(ART.enemyArmory.armor.slice(1));
  expect(material('well').color.getHexString()).toBe(ART.enemyArmory.iron.slice(1));
  expect(material('ramp').color.getHexString()).toBe(ART.enemyArmory.steel.slice(1));
  expect(material('armor').color.getHexString()).not.toBe(ART.coastalDefense.plaster.slice(1));
  for (const ship of ships) {
    expect(ship.children).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect((ship.children[i] as THREE.Mesh).geometry).toBe((ships[0].children[i] as THREE.Mesh).geometry);
      expect((ship.children[i] as THREE.Mesh).material).toBe((ships[0].children[i] as THREE.Mesh).material);
    }
  }
  const meshes: THREE.Mesh[] = []; transports.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  const disposals = [...new Set(meshes.map(m => m.geometry))].map(g => vi.spyOn(g, 'dispose'));
  const materials = [...new Set(meshes.map(m => m.material))].map(m => vi.spyOn(m as THREE.Material, 'dispose'));
  transports.dispose(); for (const spy of [...disposals, ...materials]) expect(spy).toHaveBeenCalledTimes(1);
});
