import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import type { PlayerVisualFamily } from '../CharacterVisualFamilies';
import { ChibiPlayerMotion } from './ChibiPlayerMotion';

type Part = { geometry: THREE.BufferGeometry; color: string; region?: number };

function ellipsoid(x: number, y: number, z: number, sx: number, sy: number, sz: number,
  segments = 8, rings = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, segments, rings).scale(sx, sy, sz).translate(x, y, z);
}

function block(x: number, y: number, z: number, sx: number, sy: number, sz: number,
  round = .035): THREE.BufferGeometry {
  return new RoundedBoxGeometry(sx, sy, sz, 1, round).translate(x, y, z);
}

function merged(parts: Part[], moving = false): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const count = geometry.getAttribute('position').count;
    const color = new THREE.Color(part.color), colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set(color.toArray(), i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (moving) geometry.setAttribute('playerPart', new THREE.BufferAttribute(new Float32Array(count).fill(part.region ?? 0), 1));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  for (const geometry of geometries) geometry.dispose();
  if (!result) throw new Error('Player prototype parts must merge into one geometry');
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

// Deterministic original geometry. Parts use ground origin, +Y up and +Z forward.
// Crown 1.025 keeps the legacy total height; head zone starts at .51 (~50%).
export function createChibiPlayerFamily(): PlayerVisualFamily & { dispose(): void } {
  const rootScale = .85, weaponPosition = [.31, .425, .04] as const;
  const weaponRotation = [0, THREE.MathUtils.degToRad(8), 0] as const;
  const muzzleAnchor = [0, .012, .49] as const;
  const weaponRest = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(weaponPosition),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...weaponRotation)), new THREE.Vector3(1, 1, 1));
  const offhandGrip = new THREE.Vector3(.09, -.055, .19), weaponGrip = new THREE.Vector3(0, -.10, -.055);
  const offhand = offhandGrip.clone().applyMatrix4(weaponRest), weaponHand = weaponGrip.clone().applyMatrix4(weaponRest);
  const mitten = (center: THREE.Vector3, region: number): Part[] => [
    { geometry: block(center.x, center.y, center.z, .13, .115, .10, .04), color: ART.faction.skin, region },
    { geometry: ellipsoid(center.x - .055, center.y + .005, center.z + .025, .032, .028, .042, 6, 3), color: ART.faction.skin, region },
    { geometry: new THREE.CylinderGeometry(.057, .055, .04, 8).scale(1, 1, .8)
      .translate(center.x, center.y - .069, center.z - .01), color: ART.faction.equipment, region },
  ];
  const tunic = block(0, 0, 0, .51, .27, .34, .09);
  const points = tunic.getAttribute('position');
  const normals = tunic.getAttribute('normal'), normal = new THREE.Vector3();
  // Broad bevels and a gentle top taper keep a short uniform volume, not anatomy.
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), taper = .94 - .06 * points.getY(i) / .135;
    normal.fromBufferAttribute(normals, i);
    normal.set(normal.x / taper, normal.y + (.06 / .135) * x * normal.x / taper, normal.z).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
    points.setX(i, x * taper);
  }
  tunic.translate(0, .36, 0);
  const bodyGeometry = merged([
    { geometry: tunic, color: ART.faction.player },
    { geometry: ellipsoid(0, .685, -.025, .275, .18, .26, 12, 6), color: ART.faction.skin },
    ...mitten(offhand, 3), ...mitten(weaponHand, 4),
    { geometry: block(-.17, .075, -.015, .235, .15, .35, .045), color: ART.faction.shoes, region: 1 },
    { geometry: block(.17, .075, .025, .235, .15, .35, .045), color: ART.faction.shoes, region: 2 },
    ...[-1, 1].map(side => ({ geometry: ellipsoid(side * .095, .69, .218, .019, .025, .011, 4, 2), color: ART.faction.weapon })),
    { geometry: ellipsoid(0, .654, .239, .026, .023, .027, 4, 2), color: ART.faction.skin },
    { geometry: new THREE.BoxGeometry(.045, .008, .012).translate(0, .608, .22), color: ART.faction.weapon },
  ], true);
  const shell = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    .scale(.315, .25, .285).translate(0, .775, 0);
  const helmetGeometry = merged([
    { geometry: shell, color: 'white' },
    { geometry: new THREE.CylinderGeometry(.325, .31, .05, 16).scale(1, 1, .93).translate(0, .77, 0), color: '#d6e5ef' },
    // One broad rear panel makes the clean defender helmet readable from behind.
    { geometry: block(0, .81, -.278, .15, .075, .03, .012), color: '#d6e5ef' },
  ]);
  const chestGeometry = merged([
    // One shallow wrap panel reads on the rear camera as well as the front.
    { geometry: block(0, .315, 0, .46, .11, .345, .045), color: '#91b7d0' },
  ]);
  const weaponGeometry = merged([
    { geometry: block(0, 0, .045, .145, .14, .29, .02), color: ART.faction.weapon },
    { geometry: block(0, -.01, -.17, .12, .115, .17, .025), color: ART.faction.equipment },
    { geometry: block(0, -.045, .035, .075, .13, .08, .012), color: ART.faction.weapon },
    { geometry: new THREE.CylinderGeometry(.045, .045, .30, 6).rotateX(Math.PI / 2).translate(0, .012, .34), color: ART.faction.weapon },
  ]);
  const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
  const bodyMaterial = matte(), gearMaterial = matte(), weaponMaterial = matte();
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial);
  const vest = new THREE.Mesh(chestGeometry, gearMaterial), weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
  const muzzleRest = new THREE.Vector3().fromArray(muzzleAnchor).applyMatrix4(weaponRest).multiplyScalar(rootScale);
  return {
    role: 'player', id: 'topwar-two-head-prototype', body, helmet, vest, weapon,
    presentation: {
      rootScale,
      createMotion: (normal, level) => new ChibiPlayerMotion(normal, level, offhandGrip, weaponGrip, offhand, weaponHand),
      prepareMaterial: material => material,
      weaponPosition, weaponRotation, muzzleAnchor,
      shadow: { width: .64, depth: .46 },
      levelUp: { radius: .51, height: 1.025 * rootScale * 1.2 },
      tracer: { height: muzzleRest.y, offsetX: muzzleRest.x },
    },
    dispose(): void {
      for (const geometry of [bodyGeometry, helmetGeometry, chestGeometry, weaponGeometry]) geometry.dispose();
      for (const material of [bodyMaterial, gearMaterial, weaponMaterial]) material.dispose();
    },
  };
}
