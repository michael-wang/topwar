import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DioramaFleet, DISTANT_FLEET_LAYOUT } from '../src/rendering/environment/DioramaFleet';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';

it.each([350, 390])('keeps three small distant silhouettes on the sea at %spx', width => {
  const fleet = new DioramaFleet(), camera = new THREE.PerspectiveCamera(48, width / 844, .1, 180);
  applyCoastalCamera(camera);
  expect(DISTANT_FLEET_LAYOUT).toHaveLength(3);
  for (const ship of DISTANT_FLEET_LAYOUT) {
    expect(ship.z).toBeGreaterThan(110);
    const left = new THREE.Vector3(ship.x - 3 * ship.scale, 0, ship.z).project(camera);
    const right = new THREE.Vector3(ship.x + 3 * ship.scale, 0, ship.z).project(camera);
    expect(Math.abs(left.x)).toBeLessThan(.95); expect(Math.abs(right.x)).toBeLessThan(.95);
    const span = Math.abs(right.x - left.x) * width / 2;
    expect(span).toBeGreaterThan(10); expect(span).toBeLessThan(40);
  }
  expect(fleet.mesh.material.opacity).toBeLessThan(.4);
  expect(fleet.mesh.geometry.getAttribute('position').count).toBeLessThan(600);
  fleet.dispose();
});

it('uses a single static draw, hides in combat, reuses resources and disposes once', () => {
  const fleet = new DioramaFleet(), geometry = fleet.mesh.geometry, material = fleet.mesh.material;
  const gd = vi.spyOn(geometry, 'dispose'), md = vi.spyOn(material, 'dispose');
  expect(fleet.mesh.visible).toBe(false);
  for (const diorama of [true, false, true]) {
    fleet.update(100, diorama); expect(fleet.mesh.visible).toBe(diorama); expect(fleet.mesh.position.z).toBe(100);
    expect(fleet.mesh.geometry).toBe(geometry); expect(fleet.mesh.material).toBe(material);
  }
  fleet.dispose(); expect(gd).toHaveBeenCalledTimes(1); expect(md).toHaveBeenCalledTimes(1);
});
