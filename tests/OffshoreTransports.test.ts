import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OffshoreTransports, NAVAL_PALETTE } from '../src/rendering/environment/OffshoreTransports';
import { ART } from '../src/art/ArtDirection';
it('keeps three asymmetric background carriers and a shoreward visual craft outside gameplay', () => {
  const transports = new OffshoreTransports();
  const ships = transports.group.children.filter(child => child.name.startsWith('troop-carrier'));
  expect(ships).toHaveLength(3);
  expect(new Set(ships.map(ship => ship.position.z)).size).toBe(3);
  expect(new Set(ships.map(ship => ship.scale.x)).size).toBe(3);
  expect(ships.every(ship => ship.position.z > 53 && ship.children.length === 4)).toBe(true);
  transports.update(100, 1000, true, -4);
  expect(transports.group.position.z).toBe(100);
  const craft = transports.group.children.at(-1)!; expect(craft.position.z).toBe(61);
  transports.update(100, 2000, true, 4); expect(craft.position.z).toBe(53);
  transports.update(100, 2000, false); expect(transports.group.visible).toBe(false);
  transports.dispose();
});
it('uses painted coastal hulls, ivory cabins, readable wells and a timber ramp without extra actor draws', () => {
  const transports = new OffshoreTransports(), craft = transports.group.children.at(-1)!;
  const hull = craft.getObjectByName('landing-craft-hull') as THREE.Mesh;
  const colors = hull.geometry.getAttribute('color');
  const swatches = new Set(Array.from({ length: colors.count }, (_, i) => new THREE.Color().fromBufferAttribute(colors, i).getHexString()));
  expect(swatches).toEqual(new Set([NAVAL_PALETTE.hull, NAVAL_PALETTE.accent].map(c => new THREE.Color(c).getHexString())));
  const material = (name: string) => (craft.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  expect(material('pilot-house').color.getHexString()).toBe(new THREE.Color(ART.coastalDefense.plaster).getHexString());
  expect(material('open-troop-well').color.getHexString()).toBe(new THREE.Color(NAVAL_PALETTE.well).getHexString());
  expect(material('bow-ramp').color.getHexString()).toBe(new THREE.Color(NAVAL_PALETTE.timber).getHexString());
  expect(material('open-troop-well').color.r).toBeGreaterThan(new THREE.Color(ART.coastalDefense.shadow).r * 4);
  expect(craft.children).toHaveLength(7);
  for (const ship of transports.group.children.slice(0, 3)) {
    expect(ship.children).toHaveLength(4);
    expect((ship.children[0] as THREE.Mesh).material).toBe(hull.material);
    expect((ship.children[0] as THREE.Mesh).geometry.getAttribute('color')).toBeDefined();
    expect((ship.children[2] as THREE.Mesh).material).toBe(material('open-troop-well'));
  }
  const meshes: THREE.Mesh[] = []; transports.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  const disposals = [...new Set(meshes.map(m => m.geometry))].map(g => vi.spyOn(g, 'dispose'));
  const materials = [...new Set(meshes.map(m => m.material))].map(m => vi.spyOn(m as THREE.Material, 'dispose'));
  transports.dispose(); for (const spy of [...disposals, ...materials]) expect(spy).toHaveBeenCalledTimes(1);
});
