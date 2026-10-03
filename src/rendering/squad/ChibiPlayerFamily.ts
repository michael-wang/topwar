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
  const bodyGeometry = merged([
    { geometry: block(0, .36, 0, .51, .25, .31), color: ART.faction.player },
    { geometry: ellipsoid(0, .705, 0, .275, .195, .235, 12, 6), color: ART.faction.skin },
    { geometry: ellipsoid(-.34, .365, .23, .075, .075, .07), color: ART.faction.skin, region: 3 },
    { geometry: ellipsoid(.38, .365, .23, .075, .075, .07), color: ART.faction.skin, region: 4 },
    { geometry: block(-.155, .075, .015, .24, .15, .35), color: ART.faction.equipment, region: 1 },
    { geometry: block(.155, .075, .015, .24, .15, .35), color: ART.faction.equipment, region: 2 },
    ...[-1, 1].map(side => ({ geometry: ellipsoid(side * .095, .71, .218, .019, .025, .011, 4, 2), color: ART.faction.weapon })),
    { geometry: ellipsoid(0, .674, .239, .026, .023, .027, 4, 2), color: ART.faction.skin },
    { geometry: new THREE.BoxGeometry(.045, .008, .012).translate(0, .628, .22), color: ART.faction.weapon },
  ], true);
  const shell = new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    .scale(.315, .25, .285).translate(0, .775, 0);
  const helmetGeometry = merged([
    { geometry: shell, color: 'white' },
    { geometry: new THREE.CylinderGeometry(.325, .325, .035, 12).scale(1, 1, .93).translate(0, .775, 0), color: '#d6e5ef' },
    // One broad rear panel makes the clean defender helmet readable from behind.
    { geometry: block(0, .81, -.278, .15, .075, .03, .012), color: '#d6e5ef' },
  ]);
  const chestGeometry = merged([
    { geometry: block(0, .375, .145, .32, .17, .065, .02), color: 'white' },
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
  const rootScale = .85, weaponPosition = [.38, .425, .14] as const, muzzleAnchor = [0, .012, .49] as const;
  return {
    role: 'player', id: 'topwar-two-head-prototype', body, helmet, vest, weapon,
    presentation: {
      rootScale,
      createMotion: (normal, level) => new ChibiPlayerMotion(normal, level),
      prepareMaterial: material => material,
      weaponPosition, muzzleAnchor,
      shadow: { width: .64, depth: .46 },
      levelUp: { radius: .51, height: 1.025 * rootScale * 1.2 },
      tracer: { height: (weaponPosition[1] + muzzleAnchor[1]) * rootScale,
        offsetX: (weaponPosition[0] + muzzleAnchor[0]) * rootScale },
    },
    dispose(): void {
      for (const geometry of [bodyGeometry, helmetGeometry, chestGeometry, weaponGeometry]) geometry.dispose();
      for (const material of [bodyMaterial, gearMaterial, weaponMaterial]) material.dispose();
    },
  };
}
