import * as THREE from 'three';
import { ENEMY_DEATH_TIMING, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const DEATH_VARIANTS = ['lateral', 'upper-lower', 'diagonal'] as const;
export const DEATH_PIECE_COUNTS = { heavy: 10, giant: 11 } as const;
export const BODY_SEPARATION = { heavy: ENEMY_DEATH_TIMING.heavy.breakupDistance, giant: ENEMY_DEATH_TIMING.giant.breakupDistance } as const;
export const deathVariant = (id: number): number => (Math.imul(id + 1, 1597334677) >>> 0) % 3;
const DIRECTIONS = {
  heavy: [[.35,.8,.2],[-.3,.35,-.1],[.9,.35,.12],[-.8,-.5,-.1],[-.9,.3,.1],[.9,.3,.1],[-.8,-.2,.3],[.8,-.2,.3],[-.5,-.3,.2],[.5,-.3,.2]],
  giant: [[.35,.65,.2],[-.15,.95,.2],[-.3,.35,-.1],[.9,.4,.12],[-.8,.1,-.12],[.25,-.8,.1],[-.9,.3,.1],[.85,.2,.25],[-.7,-.3,.3],[-.5,-.3,.2],[.5,-.3,.2]],
} as const;
export const DEATH_DIRECTION_GLSL = `vec3 pieceDirection(vec3 d, float variant) {
  if (variant < .5) return d;
  if (variant < 1.5) return vec3(-d.y, d.x, d.z);
  return vec3((d.x-d.y)*.70710678, (d.x+d.y)*.70710678, d.z);
}
vec3 openedPieceDirection(vec3 d, float id, float role, float variant) {
  bool shell = (role == 1. && (id == 2. || id == 3.)) || (role == 2. && (id == 3. || id == 4.));
  // Main torso bands open oppositely sideways in every composition. Other pieces
  // retain their varied rigid directions, including the coupled Giant grip/maul.
  return shell ? normalize(vec3(sign(d.x), d.y * .35, d.z)) : pieceDirection(d, variant);
}`;

// Bake only: preserve primitive topology, positions/normals/colors exactly.
// Logical bands, hands, shoes and equipment each share a rigid direction;
// nothing is fractured or rebuilt when an enemy dies.
export function tagDeathPiece(geometry: THREE.BufferGeometry, role: Exclude<EnemyDeathRole, 'grunt'>,
  piece: number | ((y: number, color: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined, vertex: number) => number)): THREE.BufferGeometry {
  const p = geometry.getAttribute('position'), color = geometry.getAttribute('color');
  const direction = new Float32Array(p.count * 3), ids = new Float32Array(p.count);
  for (let i = 0; i < p.count; i += 3) {
    const id = typeof piece === 'number' ? piece : piece((p.getY(i)+p.getY(i+1)+p.getY(i+2))/3, color, i);
    const d = DIRECTIONS[role][id], length = Math.hypot(...d);
    for (let v = i; v < i+3; v++) { ids[v] = id; for (let c = 0; c < 3; c++) direction[v*3+c] = d[c]/length; }
  }
  geometry.setAttribute('deathPieceDirection', new THREE.BufferAttribute(direction, 3));
  geometry.setAttribute('deathPieceId', new THREE.BufferAttribute(ids, 1));
  geometry.userData.deathShellRole = role === 'heavy' ? 1 : role === 'giant' ? 2 : 0;
  return geometry;
}
export function assemblyBatchGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  // Frozen gait stays intact; Heavy/Giant transition and final poses are tagged.
  if (!geometry.hasAttribute('deathPieceDirection')) geometry.setAttribute('deathPieceDirection',
    new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3), 3));
  if (!geometry.hasAttribute('deathPieceId')) geometry.setAttribute('deathPieceId',
    new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
  return geometry;
}
