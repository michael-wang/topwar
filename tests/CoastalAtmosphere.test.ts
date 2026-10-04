import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { CoastalClouds, coastalCloudTexture } from '../src/rendering/environment/CoastalClouds';
import { CoastalWater } from '../src/rendering/environment/CoastalWater';
import { ART } from '../src/art/ArtDirection';

it('paints a repeatable soft cloud atlas with transparent edges and shaded white interiors', () => {
  const a = coastalCloudTexture(), b = coastalCloudTexture();
  expect(a.image.data).toEqual(b.image.data);
  expect(a.image.width).toBe(1024); expect(a.image.height).toBe(128);
  const data = a.image.data;
  let soft = 0, opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < 200) soft++;
    if (data[i + 3] >= 200) { opaque++; expect(data[i]).toBeGreaterThan(194); }
  }
  expect(soft).toBeGreaterThan(1000); expect(opaque).toBeGreaterThan(1000);
  for (let x = 0; x < a.image.width; x++) {
    expect(data[x * 4 + 3]).toBe(0);
    expect(data[((a.image.height - 1) * a.image.width + x) * 4 + 3]).toBe(0);
  }
  a.dispose(); b.dispose();
});

it('drifts four sky cards gently with deterministic rewind and disposes owned resources', () => {
  const clouds = new CoastalClouds(), mesh = clouds.mesh;
  expect(mesh.count).toBe(4);
  const initial = Array.from(mesh.instanceMatrix.array);
  clouds.update(1000);
  const matrix = new THREE.Matrix4(), origin = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); origin.fromArray(initial, i * 16);
    p.setFromMatrixPosition(matrix); q.setFromMatrixPosition(origin);
    expect(p.distanceTo(q)).toBeLessThan(.1); expect(p.z).toBeGreaterThan(140);
    expect(p.y).toBeGreaterThan(12);
  }
  clouds.update(0); expect(Array.from(mesh.instanceMatrix.array)).toEqual(initial);
  const material = mesh.material as THREE.MeshBasicMaterial;
  expect(material.depthWrite).toBe(false); expect(material.fog).toBe(false);
  const disposals = [vi.spyOn(mesh, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'),
    vi.spyOn(material, 'dispose'), vi.spyOn(clouds.texture, 'dispose')];
  clouds.dispose(); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
});

it('animates surf only in shaders without moving the canonical shoreline or gameplay-space geometry', () => {
  const water = new CoastalWater(), sea = water.group.getObjectByName('defense-sea') as THREE.Mesh;
  const material = sea.material as THREE.ShaderMaterial;
  const positions = Array.from(sea.geometry.getAttribute('position').array), transform = sea.position.clone();
  for (const time of [0, 3500, 7000, 13000]) water.update(time);
  expect(Array.from(sea.geometry.getAttribute('position').array)).toEqual(positions);
  expect(sea.position).toEqual(transform);
  sea.geometry.computeBoundingBox();
  expect(sea.geometry.boundingBox!.min.z + sea.position.z).toBe(ART.coastalDefense.shorelineZ);
  expect(material.uniforms.foam.value.getHexString()).toBe(ART.coastalDefense.foam.slice(1));
  expect(material.fragmentShader).toContain('shoreOffset');
  expect(material.fragmentShader).toContain('color=mix(color,foam');
  water.dispose();
});
