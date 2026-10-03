import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function toyEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number,
  segments = 16, rings = 10): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, segments, rings).scale(rx, ry, rz).translate(x, y, z);
}

export interface ToyShoeOptions {
  width: number; height: number; depth: number;
  upper: string; sole: string;
  x: number; y: number; z: number;
  segments?: number;
}

// A short bean, never a beveled box. Flatten only the lowest latitude, keep a
// rounded toe and broad upper; the quiet sole is a color region in the same draw.
export function toyShoe(o: ToyShoeOptions): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, o.segments ?? 16, 8);
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const y = (p.getY(i) + 1) / 2, front = p.getZ(i);
    p.setXYZ(i, p.getX(i) * o.width / 2 * (1 + .06 * front),
      Math.max(0, (y - .12) / .88) * o.height, front * o.depth / 2);
    if (y <= .12) n.setXYZ(i, 0, -1, 0);
    else {
      const normal = new THREE.Vector3(n.getX(i) / (o.width / 2),
        n.getY(i) / (o.height / 2 / .88), n.getZ(i) / (o.depth / 2)).normalize();
      n.setXYZ(i, normal.x, normal.y, normal.z);
    }
  }
  const result = geometry.toNonIndexed(); geometry.dispose();
  const positions = result.getAttribute('position'), colors = new Float32Array(positions.count * 3);
  const upper = new THREE.Color(o.upper), sole = new THREE.Color(o.sole);
  for (let i = 0; i < positions.count; i += 3) {
    const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const color = y < o.height * .19 ? sole : upper;
    for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
  }
  result.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  result.translate(o.x, o.y, o.z); result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

export interface ToyShellOptions {
  rx: number; ry: number; rz: number; y: number;
  front: number; side: number; rear: number;
  segments?: number; rings?: number; thickness?: number;
}

// Curved shell opening, with side/rear drop authored explicitly by each role.
// Outer/inner ellipsoidal surfaces and their rolled edge are one geometry.
export function toyHelmetShell(o: ToyShellOptions): THREE.BufferGeometry {
  const segments = o.segments ?? 20, rings = o.rings ?? 8, thick = o.thickness ?? .015;
  const surface = (inner: boolean) => {
    const g = new THREE.SphereGeometry(1, segments, rings, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    const rx = o.rx - (inner ? thick : 0), ry = o.ry - (inner ? thick : 0), rz = o.rz - (inner ? thick : 0);
    for (let j = 0; j <= rings; j++) for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2, front = Math.cos(a);
      const end = o.side + (o.front - o.side) * Math.pow(Math.max(0, front), 4)
        + (o.rear - o.side) * Math.pow(Math.max(0, -front), 2);
      const t = j / rings * end, index = j * (segments + 1) + i;
      const x = Math.sin(a) * Math.sin(t), y = Math.cos(t), z = Math.cos(a) * Math.sin(t);
      p.setXYZ(index, x * rx, o.y + y * ry, z * rz);
      const normal = new THREE.Vector3(x / rx, y / ry, z / rz).normalize().multiplyScalar(inner ? -1 : 1);
      n.setXYZ(index, normal.x, normal.y, normal.z);
    }
    if (inner) {
      const index = g.index!;
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
      }
    }
    g.deleteAttribute('uv'); return g;
  };
  const outer = surface(false), inner = surface(true), edge = new THREE.BufferGeometry();
  const p = outer.getAttribute('position'), q = inner.getAttribute('position'), vertices: number[] = [];
  const row = rings * (segments + 1);
  for (let i = 0; i < segments; i++) for (const [attr, index] of [
    [p, row + i], [q, row + i], [p, row + i + 1],
    [q, row + i], [q, row + i + 1], [p, row + i + 1],
  ] as const) vertices.push(attr.getX(index), attr.getY(index), attr.getZ(index));
  edge.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); edge.computeVertexNormals();
  const a = outer.toNonIndexed(), b = inner.toNonIndexed();
  const result = mergeGeometries([a, b, edge])!;
  [outer, inner, edge, a, b].forEach(g => g.dispose());
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
