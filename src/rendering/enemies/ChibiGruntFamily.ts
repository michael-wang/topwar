import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { ENEMY_GAIT_CYCLE_MS, type CrowdVisualFamily } from '../CharacterVisualFamilies';

export const GRUNT_CLOTHING = { shirt: ART.raider.body, shorts: ART.raider.shorts } as const;
type Part = { geometry: THREE.BufferGeometry; color: string; shortsBelowY?: number };

function rounded(x: number, y: number, z: number, width: number, height: number, depth: number,
  radius = .035): THREE.BufferGeometry {
  // One bevel per edge: 44 triangles instead of 108 for a segmented rounded box.
  const half = [width / 2, height / 2, depth / 2], inset = half.map(value => value - radius);
  const positions: number[] = [];
  const polygon = (vertices: THREE.Vector3[]) => {
    const normal = new THREE.Vector3().subVectors(vertices[1], vertices[0])
      .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0]));
    const center = vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3());
    if (normal.dot(center) < 0) vertices.reverse();
    for (let i = 1; i < vertices.length - 1; i++) for (const point of [vertices[0], vertices[i], vertices[i + 1]]) positions.push(...point.toArray());
  };
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const a = (axis + 1) % 3, b = (axis + 2) % 3;
    polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sa, sb]) => {
      const point = [0, 0, 0]; point[axis] = sign * half[axis];
      point[a] = inset[a] * sa; point[b] = inset[b] * sb;
      return new THREE.Vector3(...point);
    }));
  }
  for (let axis = 0; axis < 3; axis++) {
    const a = (axis + 1) % 3, b = (axis + 2) % 3;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) polygon([[-1, 0], [-1, 1], [1, 1], [1, 0]].map(([sign, edge]) => {
      const point = [0, 0, 0]; point[axis] = sign * inset[axis];
      point[a] = sa * (edge ? inset[a] : half[a]); point[b] = sb * (edge ? half[b] : inset[b]);
      return new THREE.Vector3(...point);
    }));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const signs = [sx, sy, sz];
    polygon([0, 1, 2].map(axis => new THREE.Vector3(...signs.map((sign, index) => sign * (index === axis ? half[index] : inset[index])))));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry.translate(x, y, z);
}

function sphere(x: number, y: number, z: number, width: number, height: number, depth: number,
  segments = 8, rings = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, segments, rings).scale(width, height, depth).translate(x, y, z);
}

function merge(parts: Part[]): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      if (part.shortsBelowY !== undefined) {
        // One continuous rounded volume, two plain color blocks. The boundary
        // follows a latitude ring, without a separate belt or garment layer.
        const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
        color.set(y < part.shortsBelowY ? GRUNT_CLOTHING.shorts : part.color);
      }
      for (let vertex = i; vertex < i + 3; vertex++) color.toArray(colors, vertex * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  geometries.forEach(geometry => geometry.dispose());
  if (!result) throw new Error('Grunt parts must merge into one static geometry');
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

// Four authored rigid poses retain the existing asynchronous 360 ms crowd clock.
// +Z faces forward, ground origin is zero. No skeleton or per-entity motion object.
function bodyPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  const hands = [-1, 1].map(side => ({
    geometry: sphere(side * (.335 + Math.abs(stride) * .015), .365, side * stride * .18,
      .057, .057, .057), color: ART.faction.skin,
  }));
  return merge([
    { geometry: sphere(0, .34, 0, .25, .17, .19, 12, 7), color: GRUNT_CLOTHING.shirt,
      shortsBelowY: .34 + .17 * Math.cos(Math.PI * 4 / 7) },
    { geometry: sphere(0, .67, 0, .28, .20, .255, 12, 6), color: ART.faction.skin },
    ...hands,
    { geometry: rounded(-.165 - Math.abs(stride) * .02 - (liftLeft > .05 ? .035 : 0), .06 + liftLeft, stride * .16,
      .25, .12, .35, .04), color: ART.faction.shoes },
    { geometry: rounded(.165 + Math.abs(stride) * .02 + (liftRight > .05 ? .035 : 0), .06 + liftRight, -stride * .16,
      .25, .12, .35, .04), color: ART.faction.shoes },
    ...[-1, 1].map(side => ({ geometry: sphere(side * .095, .675, .236, .018, .022, .012, 4, 2), color: ART.faction.weapon })),
    { geometry: sphere(0, .645, .25, .027, .025, .029, 4, 2), color: ART.faction.skin },
    { geometry: new THREE.BoxGeometry(.042, .008, .012).translate(0, .60, .239), color: ART.faction.weapon },
  ]);
}

export function createChibiGruntFamily(): CrowdVisualFamily<'grunt'> & { dispose(): void } {
  const idle = bodyPose(0);
  const runs = [bodyPose(1, 0, .11), bodyPose(-.25, .025, 0),
    bodyPose(-1, .11, 0), bodyPose(.25, 0, .025)];
  const death = idle.clone();
  const deathColors = death.getAttribute('color');
  for (let i = 0; i < deathColors.count; i++) {
    const gray = deathColors.getX(i) * .2126 + deathColors.getY(i) * .7152 + deathColors.getZ(i) * .0722;
    deathColors.setXYZ(i, gray, gray, gray);
  }
  // Wide, low pot shell and thick lip distinguish landing troops from the
  // defender dome/rear panel. Crown stays at the legacy 1.025 authored height.
  const helmetGeometry = merge([
    { geometry: new THREE.SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(.35, .245, .32).translate(0, .78, 0), color: 'white' },
    { geometry: new THREE.CylinderGeometry(.35, .36, .065, 16).scale(1, 1, .92)
      .translate(0, .775, 0), color: '#e0d4d0' },
    { geometry: new THREE.CylinderGeometry(.37, .37, .035, 16).scale(1, 1, .92)
      .translate(0, .74, 0), color: '#c0aaaa' },
  ]);
  // The shared legacy contract still requires a vest resource. A zero-vertex
  // adapter removes visible secondary gear without changing other role renderers
  // or allocating a new material. It contributes no triangles or mesh draw.
  const waistGeometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color'])
    waistGeometry.setAttribute(attribute, new THREE.Float32BufferAttribute([], 3));
  waistGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  waistGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial);
  const vest = new THREE.Mesh(waistGeometry, gearMaterial);
  vest.visible = false;
  return {
    role: 'grunt', id: 'topwar-amphibious-prototype', body, helmet, vest,
    presentation: { materialStyle: 'vertex-colors', bodyTint: 'authored',
      stepWeight: { shift: .028, roll: .028, compression: .012 } },
    runFrames: runs.map(geometry => new THREE.Mesh(geometry, bodyMaterial)), gaitCycleMs: ENEMY_GAIT_CYCLE_MS,
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(death, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, death, helmetGeometry, waistGeometry].forEach(geometry => geometry.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(material => material.dispose());
    },
  };
}
