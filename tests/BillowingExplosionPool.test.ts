import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BillowingExplosionPool } from '../src/rendering/BillowingExplosionPool';
import { ExplosionComparison } from '../src/dev/ExplosionComparison';

it('keeps B-fast shape, wind, fire and flash but lightens artillery smoke and fades it earlier than the reference', () => {
  const scene = new THREE.Scene(), reference = new THREE.Scene();
  const pool = new BillowingExplosionPool(scene, 8), lab = new ExplosionComparison(reference, 'impact', 'B-fast');
  pool.present(0, 5, .588, 0);
  const smoke = scene.getObjectByName('artillery-impact-smoke') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), other = new THREE.Matrix4(), color = new THREE.Color(), expected = new THREE.Color();
  expect(pool.durationMs).toBe(1050);
  for (const ms of [0, 30, 180, 350, 650, 900, 1050, 1200, 1500]) {
    pool.update(ms, 0); lab.seek(ms); expect(smoke.visible).toBe(ms < 1050);
    if (ms >= 1050) continue;
    for (let band = 0; band < 3; band++) {
      const mesh = reference.getObjectByName(`lab-0-band-${band}`) as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      expect(Array.from(smoke.geometry.attributes.position.array)).toEqual(Array.from(mesh.geometry.attributes.position.array));
      for (let i = 0; i < 8; i++) {
        smoke.getMatrixAt(band * 8 + i, matrix); mesh.getMatrixAt(i, other); expect(matrix.elements).toEqual(other.elements);
        smoke.getColorAt(band * 8 + i, color); mesh.getColorAt(i, expected); expected.multiply(mesh.material.color);
        color.toArray().forEach((value, j) => expect(value).toBeGreaterThan(expected.toArray()[j]));
        const alpha = smoke.geometry.attributes.fxOpacity.getX(band * 8 + i);
        expect(alpha).toBeLessThan(mesh.material.opacity);
        if (ms === 350) expect(alpha).toBeLessThan(.25);
        if (ms === 650) expect(alpha).toBeLessThan(.09);
        if (ms === 900) expect(alpha).toBeLessThan(.02);
      }
    }
    const fire = scene.getObjectByName('artillery-impact-fire') as THREE.InstancedMesh;
    const labFire = reference.getObjectByName('lab-0-fire') as THREE.InstancedMesh;
    expect(fire.visible).toBe(labFire.visible);
    if (fire.visible) for (let i = 0; i < 3; i++) { fire.getMatrixAt(i, matrix); labFire.getMatrixAt(i, other); expect(matrix.elements).toEqual(other.elements); }
    const core = scene.getObjectByName('artillery-impact-flash') as THREE.InstancedMesh;
    const labCore = reference.getObjectByName('lab-0-flash') as THREE.Mesh;
    expect(core.visible).toBe(labCore.visible);
    if (core.visible) { labCore.updateMatrix(); core.getMatrixAt(0, matrix); matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(labCore.matrix.elements[i], 6)); }
  }
  pool.dispose(); lab.dispose();
});

it('uses three pooled draws for eight overlapping impacts, freezes, clears and releases all owned resources once', () => {
  const scene = new THREE.Scene(), pool = new BillowingExplosionPool(scene, 8), objects = [...scene.children];
  const smoke = scene.getObjectByName('artillery-impact-smoke') as THREE.InstancedMesh;
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const mesh of scene.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[]) { resources.add(mesh.geometry); resources.add(mesh.material); }
  const releases = [...resources].map(r => vi.spyOn(r, 'dispose'));
  for (let cycle = 0; cycle < 10; cycle++) {
    for (let i = 0; i < 8; i++) pool.present(i, 12, .588, cycle * 2000);
    pool.update(cycle * 2000 + 30, 0); expect(pool.active).toBe(8); expect(scene.children.filter(m => m.visible)).toHaveLength(3);
    const frozen = Array.from(smoke.instanceMatrix.array); pool.update(cycle * 2000 + 30, 0); expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
    pool.update(cycle * 2000 + 1500, 0); expect(pool.active).toBe(0); expect(scene.children.every(m => !m.visible)).toBe(true);
    pool.reset(); expect(scene.children).toEqual(objects);
  }
  pool.dispose(); expect(scene.children).toHaveLength(0); releases.forEach(spy => expect(spy).toHaveBeenCalledOnce());
});
