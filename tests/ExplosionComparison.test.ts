import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { COMPARISON_LOOKS, COMPARISON_IMPACTS, ExplosionComparison } from '../src/dev/ExplosionComparison';
import { GrenadeExplosion } from '../src/rendering/GrenadeExplosion';
import { LabAirstrikeControl as HeavyAirstrikeExplosion } from '../src/dev/LabAirstrikeControl';
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
  for (const look of ['A', 'B', 'C', 'B-fast', 'D'] as const) {
    const scene = new THREE.Scene(), sample = new ExplosionComparison(scene, look === 'C' || look === 'D' ? 'airstrike' : 'impact', look);
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
  expect(() => new ExplosionComparison(new THREE.Scene(), 'airstrike', 'B-fast')).toThrow('Invalid');
  expect(() => new ExplosionComparison(new THREE.Scene(), 'impact', 'D')).toThrow('Invalid');
});

it('B-fast expands faster, disperses earlier and fades out by 1.5s without extending the original B lifetime', () => {
  const scene = new THREE.Scene(), reference = new THREE.Scene();
  const fast = new ExplosionComparison(scene, 'impact', 'B-fast'), original = new ExplosionComparison(reference, 'impact', 'B');
  const cloud = scene.getObjectByName('lab-0-band-2') as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  const b = reference.getObjectByName('lab-0-band-2') as typeof cloud;
  const matrix = new THREE.Matrix4(), other = new THREE.Matrix4();
  fast.seek(180); original.seek(180); cloud.getMatrixAt(0, matrix); b.getMatrixAt(0, other);
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeGreaterThan(new THREE.Vector3().setFromMatrixScale(other).x * 1.2);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBeLessThan(new THREE.Vector3().setFromMatrixPosition(other).x);
  for (const [ms, alpha] of [[900, .64], [1200, .08], [1350, .01]] as const) {
    fast.seek(ms); expect(cloud.material.opacity).toBeCloseTo(alpha);
  }
  fast.seek(1500); original.seek(1500); expect(cloud.visible).toBe(false); expect(b.visible).toBe(true);
  expect(scene.children).toHaveLength(reference.children.length);
  fast.dispose(); original.dispose();
});

it('Hybrid D selectively retains the Control white flash geometry and ground ring, with one restrained orange burst', () => {
  const scene = new THREE.Scene(), reference = new THREE.Scene();
  const hybrid = new ExplosionComparison(scene, 'airstrike', 'D'), control = new ExplosionComparison(reference, 'airstrike', 'control');
  const core = scene.getObjectByName('lab-0-flash') as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  const ring = scene.getObjectByName('lab-0-shockwave') as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  const fire = scene.getObjectByName('lab-0-fire') as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  hybrid.seek(30); control.seek(30);
  const controlCore = reference.getObjectByName('airstrike-0-core') as typeof core;
  const controlRing = reference.getObjectByName('airstrike-0-shockwave') as typeof ring;
  expect(core.geometry.parameters).toEqual(controlCore.geometry.parameters);
  expect(core.material.color).toEqual(controlCore.material.color); expect(core.position).toEqual(controlCore.position);
  expect(core.scale).toEqual(controlCore.scale); expect(core.visible).toBe(true); expect(fire.visible).toBe(false);
  expect(ring.geometry.parameters).toEqual(controlRing.geometry.parameters); expect(ring.position).toEqual(controlRing.position);
  expect(ring.scale).toEqual(controlRing.scale); expect(ring.rotation.toArray()).toEqual(controlRing.rotation.toArray());
  expect(ring.material.color).toEqual(controlRing.material.color); expect(ring.material.opacity).toEqual(controlRing.material.opacity);
  hybrid.seek(180); expect(core.visible).toBe(false); expect(fire.visible).toBe(true); expect(fire.material.opacity).toBeLessThan(.4);
  expect(scene.getObjectByName('lab-0-band-2')!.visible).toBe(true);
  hybrid.seek(300); expect(fire.visible).toBe(false); expect(ring.visible).toBe(true);
  hybrid.seek(600); expect(ring.visible).toBe(false);
  expect(scene.children).toHaveLength(9 * 6); // Only the requested ring adds a mesh to B's five-mesh slots.
  hybrid.dispose(); control.dispose();
});

it('Hybrid D ages every impact independently, retaining later plumes beyond the first impact expiration', () => {
  const scene = new THREE.Scene(), hybrid = new ExplosionComparison(scene, 'airstrike', 'D');
  for (let i = 0; i < COMPARISON_IMPACTS.length; i++) {
    const e = COMPARISON_IMPACTS[i];
    const smoke = scene.getObjectByName(`lab-${i}-band-2`) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    for (const [age, alpha] of [[30, .64], [1500, .64], [1800, .04096], [1990, .00000512]] as const) {
      hybrid.seek(e.at + age); expect(smoke.visible).toBe(true); expect(smoke.material.opacity).toBeCloseTo(alpha);
      if (age === 30) {
        expect(scene.getObjectByName(`lab-${i}-flash`)!.visible).toBe(true);
        expect(scene.getObjectByName(`lab-${i}-shockwave`)!.visible).toBe(true);
      }
      if (age >= 1800) expect(1 - (1 - smoke.material.opacity) ** 8).toBeLessThan(.3);
    }
    hybrid.seek(e.at + 2000); expect(smoke.visible).toBe(false);
  }
  hybrid.seek(4000);
  expect(scene.getObjectByName('lab-0-band-2')!.visible).toBe(false);
  expect(scene.getObjectByName('lab-8-band-2')!.visible).toBe(true);
  hybrid.seek(5100); expect(scene.children.every(m => !m.visible)).toBe(true);
  expect(hybrid.durationMs).toBe(9000); hybrid.dispose();
});
