import * as THREE from 'three';
import { expect, it } from 'vitest';
import { COASTAL_BUILDINGS, CoastalArchitecture } from '../src/rendering/environment/CoastalArchitecture';
import { COASTAL_TREES, CoastalVegetation } from '../src/rendering/environment/CoastalVegetation';
import { CoastalForeground } from '../src/rendering/environment/CoastalForeground';
import { coastalCameraFov } from '../src/rendering/renderSize';

it('opens the shoreline showcase while retaining asymmetric near/mid village masses', () => {
  expect(COASTAL_BUILDINGS).toHaveLength(2);
  for (const b of COASTAL_BUILDINGS) expect(b.z + b.depth / 2 + .5).toBeLessThan(24);
  expect(COASTAL_TREES).toHaveLength(2);
  for (const tree of COASTAL_TREES) expect(tree.z + tree.size).toBeLessThan(39);
});

it.each([2.4, 3.2, 4, 5])('keeps opaque village and vegetation outside %.1f track edge plus clearance', halfWidth => {
  const architecture = new CoastalArchitecture(), foreground = new CoastalForeground(), vegetation = new CoastalVegetation();
  architecture.update(halfWidth); foreground.update(halfWidth); vegetation.update(halfWidth, 0);
  for (const root of [architecture.group, foreground.group, vegetation.group]) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if ((object.material as THREE.Material).transparent) return;
      object.geometry.computeBoundingBox();
      const matrices = object instanceof THREE.InstancedMesh
        ? Array.from({ length: object.count }, (_, i) => { const m = new THREE.Matrix4(); object.getMatrixAt(i, m); return m.premultiply(object.matrixWorld); })
        : [object.matrixWorld];
      for (const m of matrices) {
        const bounds = object.geometry.boundingBox!.clone().applyMatrix4(m);
        expect(bounds.min.x >= halfWidth + .4 || bounds.max.x <= -halfWidth - .4).toBe(true);
      }
    });
  }
  architecture.dispose(); foreground.dispose(); vegetation.dispose();
});

it('retains a ground shadow and grounded main trunk for each tree', () => {
  const vegetation = new CoastalVegetation(); vegetation.update(3.2, 0);
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3(), scale = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const side of vegetation.group.children) {
    const trunks = side.getObjectByName('olive-trunks-and-branches') as THREE.InstancedMesh;
    const shadows = side.getObjectByName('olive-ground-shadows') as THREE.InstancedMesh;
    expect(trunks.count).toBe(shadows.count * 3);
    for (let i = 0; i < shadows.count; i++) {
      trunks.getMatrixAt(i * 3, matrix); matrix.decompose(p, q, scale);
      expect(p.y - scale.y / 2).toBeCloseTo(0);
      const trunkZ = p.z;
      shadows.getMatrixAt(i, matrix); matrix.decompose(p, q, scale);
      expect(p.y).toBeCloseTo(.024); expect(p.z - trunkZ).toBeCloseTo(.8);
    }
  }
  vegetation.dispose();
});

it('exposes retained trunks at the portrait camera, including the relocated tree foot', () => {
  const architecture = new CoastalArchitecture(), foreground = new CoastalForeground(), vegetation = new CoastalVegetation();
  architecture.update(3.2); foreground.update(3.2); vegetation.update(3.2, 0);
  const scene = new THREE.Scene(); scene.add(architecture.group, foreground.group, vegetation.group); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(coastalCameraFov(390 / 844), 390 / 844, .1, 180);
  camera.position.set(0, 6.5, -10); camera.lookAt(0, 0, 12.5); camera.updateMatrixWorld(true);
  const opaque: THREE.Object3D[] = [];
  scene.traverse(o => { if (o instanceof THREE.Mesh && !(o.material as THREE.Material).transparent) opaque.push(o); });
  const ray = new THREE.Raycaster(), matrix = new THREE.Matrix4();
  for (const side of vegetation.group.children) {
    const trunk = side.getObjectByName('olive-trunks-and-branches') as THREE.InstancedMesh;
    trunk.getMatrixAt(0, matrix); matrix.premultiply(trunk.matrixWorld);
    // The short near arch crosses the rear tree's middle; its lower trunk/foot
    // remain exposed through the opening rather than disappearing behind a house.
    for (const height of side.position.x > 0 ? [-.4, -.2] : [0]) {
      const screen = new THREE.Vector3(0, height, 0).applyMatrix4(matrix).project(camera);
      expect(Math.abs(screen.x)).toBeLessThan(1); expect(Math.abs(screen.y)).toBeLessThan(1);
      ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
      expect(ray.intersectObjects(opaque, false)[0]?.object === trunk).toBe(true);
    }
  }
  architecture.dispose(); foreground.dispose(); vegetation.dispose();
});

it('leaves at least 90% of the primary surf sightline clear at the unchanged portrait camera', () => {
  const architecture = new CoastalArchitecture(), foreground = new CoastalForeground();
  architecture.update(3.2); foreground.update(3.2);
  const scene = new THREE.Scene(); scene.add(architecture.group, foreground.group); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(coastalCameraFov(390 / 844), 390 / 844, .1, 180);
  camera.position.set(0, 6.5, -10); camera.lookAt(0, 0, 12.5); camera.updateMatrixWorld(true);
  const opaque: THREE.Object3D[] = [];
  scene.traverse(o => { if (o instanceof THREE.Mesh && !(o.material as THREE.Material).transparent) opaque.push(o); });
  const ray = new THREE.Raycaster(), sand = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.02), point = new THREE.Vector3();
  for (const shore of [53, 49, 47, 45]) {
    const screenY = new THREE.Vector3(0, .02, shore).project(camera).y;
    let clear = 0;
    for (let i = 0; i < 100; i++) {
      ray.setFromCamera(new THREE.Vector2(-.9 + i * 1.8 / 99, screenY), camera);
      ray.ray.intersectPlane(sand, point);
      const hit = ray.intersectObjects(opaque, false)[0];
      if (!hit || hit.distance > ray.ray.origin.distanceTo(point)) clear++;
    }
    expect(clear).toBeGreaterThanOrEqual(90);
  }
  architecture.dispose(); foreground.dispose();
});
