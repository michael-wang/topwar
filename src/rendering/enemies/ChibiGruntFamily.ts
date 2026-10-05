import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toyEllipsoid as sphere, toyShoe, toyHelmetShell } from '../characters/ToyGeometry';
import { ART } from '../../art/ArtDirection';
import { COMBAT_COLORS, toyWaistBand } from '../characters/ToyCombatGear';
import { ENEMY_GAIT_CYCLE_MS, type CrowdVisualFamily } from '../CharacterVisualFamilies';

export const GRUNT_CLOTHING = { shirt: ART.raider.body, shorts: ART.raider.shorts } as const;
type Part = { geometry: THREE.BufferGeometry; color?: string; shortsBelowY?: number };

function merge(parts: Part[]): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    if (!part.color) return geometry;
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      if (part.shortsBelowY !== undefined) {
        // One continuous rounded volume, two plain color blocks. The boundary
        // follows a latitude ring; field gear is merged into this same draw.
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
      .057, .057, .057, 12, 6), color: ART.faction.skin,
  }));
  return merge([
    { geometry: sphere(0, .34, 0, .25, .17, .19, 20, 12), color: GRUNT_CLOTHING.shirt,
      shortsBelowY: .34 + .17 * Math.cos(Math.PI * 7 / 12) },
    ...[-1,1].map(side => ({ geometry: sphere(side*.15,.185,0,.075,.045,.09,8,4), color: GRUNT_CLOTHING.shorts })),
    { geometry: toyWaistBand(.25,.17,.19,.34,.30,.032), color: COMBAT_COLORS.grunt.belt },
    { geometry: sphere(-.25,.26,.04,.06,.067,.055,10,5), color: COMBAT_COLORS.grunt.canteen },
    { geometry: sphere(0, .67, 0, .28, .20, .255, 20, 12), color: ART.faction.skin },
    ...hands,
    { geometry: toyShoe({ x: -.165 - Math.abs(stride) * .02 - (liftLeft > .05 ? .035 : 0), y: liftLeft, z: stride * .16,
      width: .26, height: .12, depth: .22, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    { geometry: toyShoe({ x: .165 + Math.abs(stride) * .02 + (liftRight > .05 ? .035 : 0), y: liftRight, z: -stride * .16,
      width: .26, height: .12, depth: .22, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    ...[-1, 1].map(side => ({ geometry: sphere(side * .095, .675, .236, .015, .019, .009, 8, 4), color: ART.faction.weapon })),

  ]);
}

export function createChibiGruntFamily(): CrowdVisualFamily<'grunt'> & { dispose(): void } {
  const idle = bodyPose(0);
  const runs = [bodyPose(1, 0, .11), bodyPose(-.25, .025, 0),
    bodyPose(-1, .11, 0), bodyPose(.25, 0, .025)];
  // Wide, low pot shell and thick lip distinguish landing troops from the
  // defender dome/rear panel. Crown stays at the legacy 1.025 authored height.
  const helmetGeometry = merge([{ geometry: toyHelmetShell({ rx: .35, ry: .245, rz: .32, y: .78,
    front: 1.62, side: 1.80, rear: 1.88 }), color: 'white' }]);
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
    role: 'grunt', id: 'topwar-grunt', body, helmet, vest,
    presentation: { materialStyle: 'vertex-colors', bodyTint: 'authored',
      stepWeight: { shift: .028, roll: .028, compression: .012 } },
    runFrames: runs.map(geometry => new THREE.Mesh(geometry, bodyMaterial)), gaitCycleMs: ENEMY_GAIT_CYCLE_MS,
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(idle, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, helmetGeometry, waistGeometry].forEach(geometry => geometry.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(material => material.dispose());
    },
  };
}
