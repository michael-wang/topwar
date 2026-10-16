import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { COMPARISON_LOOKS, COMPARISON_IMPACTS, ExplosionComparison } from '../src/dev/ExplosionComparison';
import { GrenadeExplosion } from '../src/rendering/GrenadeExplosion';
import { HeavyAirstrikeExplosion } from '../src/rendering/HeavyAirstrikeExplosion';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';

function snapshot(scene: THREE.Scene) {
  return scene.children.map(object => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    // Inactive pooled meshes intentionally retain old GPU data; only visibility is observable.
    if (!mesh.visible) return { name: mesh.name, visible: false };
    return { name: mesh.name, visible: mesh.visible, opacity: mesh.material.opacity,
      position: mesh.position.toArray(), scale: mesh.scale.toArray(),
      instances: mesh instanceof THREE.InstancedMesh ? Array.from(mesh.instanceMatrix.array) : null };
  });
}

it.each(['impact', 'airstrike'] as const)('Control delegates unchanged to the actual %s production effect', group => {
  const scene = new THREE.Scene(), reference = new THREE.Scene();
  const sample = new ExplosionComparison(scene, group, 'control');
  const fx = group === 'impact' ? new GrenadeExplosion(reference, 1, false, 'artillery') : new HeavyAirstrikeExplosion(reference);
  for (const ms of [30, 180, 1000, 2500, 4000, 8900]) {
    fx.reset();
    for (let i = 0; i < (group === 'impact' ? 1 : 9); i++) {
      const e = COMPARISON_IMPACTS[i]; if (e.at > ms) continue;
      if (fx instanceof GrenadeExplosion) fx.present(e.x, e.z, .588, e.at);
      else fx.present(i, e.x, e.z, e.at);
    }
    fx.update(ms, 0); sample.seek(ms); expect(snapshot(scene)).toEqual(snapshot(reference));
  }
  sample.dispose(); fx.dispose();
});

for (const group of ['impact', 'airstrike'] as const) for (const look of COMPARISON_LOOKS[group]) {
  it(`${group}/${look} seeks backwards, replays and freezes without resource growth`, () => {
    const scene = new THREE.Scene(), sample = new ExplosionComparison(scene, group, look);
    sample.seek(450); const early = snapshot(scene), children = [...scene.children];
    sample.seek(450); expect(snapshot(scene)).toEqual(early);
    sample.seek(1600); sample.seek(450); expect(snapshot(scene)).toEqual(early);
    for (let i = 0; i < 40; i++) sample.seek(i * 200);
    expect(scene.children).toEqual(children);
    sample.seek(sample.durationMs); expect(scene.children.every(m => !m.visible)).toBe(true);
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    for (const child of scene.children) { const mesh = child as THREE.Mesh; geometry.add(mesh.geometry);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m)); }
    const spies = [...geometry, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
    sample.dispose(); expect(scene.children).toHaveLength(0);
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
  });
}

it.each([350, 390])('three experimental tonal bands start immediately and drift screen-right at %ipx', width => {
  for (const look of ['A', 'B', 'C'] as const) {
    const scene = new THREE.Scene(), sample = new ExplosionComparison(scene, look === 'C' ? 'airstrike' : 'impact', look);
    const camera = new THREE.PerspectiveCamera(48, width / 844, .1, 180); applyCoastalCamera(camera);
    const centers: number[] = [];
    for (const time of [0, 900]) {
      sample.seek(time);
      for (let band = 0; band < 3; band++) {
        const mesh = scene.getObjectByName(`lab-0-band-${band}`) as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        expect(mesh.visible).toBe(true); expect(mesh.material.opacity).toBeGreaterThan(.1);
        let center = 0;
        for (let i = 0; i < mesh.count; i++) {
          const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
          expect(new THREE.Vector3().setFromMatrixScale(matrix).length()).toBeGreaterThan(.4);
          center += new THREE.Vector3().setFromMatrixPosition(matrix).project(camera).x;
        }
        if (band === 1) centers.push(center / mesh.count);
      }
    }
    expect(centers[1]).toBeGreaterThan(centers[0]); sample.dispose();
  }
});

it('rejects mismatched groups rather than silently replacing the selected comparison', () => {
  expect(() => new ExplosionComparison(new THREE.Scene(), 'impact', 'C')).toThrow('Invalid');
  expect(() => new ExplosionComparison(new THREE.Scene(), 'airstrike', 'A')).toThrow('Invalid');
});
