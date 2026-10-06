import * as THREE from 'three';
import { toyEllipsoid as ellipsoid, toyShoe, toyHelmetShell } from '../characters/ToyGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ART } from '../../art/ArtDirection';
import type { PlayerVisualFamily } from '../CharacterVisualFamilies';
import { ChibiPlayerMotion } from './ChibiPlayerMotion';
import { COMBAT_COLORS, toyWaistBand } from '../characters/ToyCombatGear';

type Part = { geometry: THREE.BufferGeometry; color?: string; region?: number; trousersBelow?: number };

function merged(parts: Part[], moving = false): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const count = geometry.getAttribute('position').count;
    if (part.color) {
      const color = new THREE.Color(part.color), colors = new Float32Array(count * 3);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < count; i += 3) {
        const y = (positions.getY(i) + positions.getY(i+1) + positions.getY(i+2)) / 3;
        color.set(part.trousersBelow !== undefined && y < part.trousersBelow ? COMBAT_COLORS.player.trousers : part.color);
        for (let j = i; j < i+3; j++) color.toArray(colors, j*3);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (moving) geometry.setAttribute('playerPart', new THREE.BufferAttribute(new Float32Array(count).fill(part.region ?? 0), 1));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  for (const geometry of geometries) geometry.dispose();
  if (!result) throw new Error('Player parts must merge into one geometry');
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
  const hand = (center: THREE.Vector3, region: number): Part => ({
    geometry: ellipsoid(center.x, center.y, center.z, .062, .058, .059, 12, 8), color: ART.faction.skin, region,
  });
  const torso = ellipsoid(0, .345, 0, .24, .19, .165, 20, 10);
  // A uniform color surface follows the same bean, with no additional torso mass.
  const panel = torso.toNonIndexed(), pp = panel.getAttribute('position'), pn = panel.getAttribute('normal');
  const panelPositions: number[] = [], panelNormals: number[] = [];
  for (let i = 0; i < pp.count; i += 3) {
    if ((pp.getY(i) + pp.getY(i + 1) + pp.getY(i + 2)) / 3 > .29) continue;
    for (let j = i; j < i + 3; j++) {
      panelPositions.push(pp.getX(j) * 1.002, .345 + (pp.getY(j) - .345) * 1.002, pp.getZ(j) * 1.002);
      panelNormals.push(pn.getX(j), pn.getY(j), pn.getZ(j));
    }
  }
  panel.dispose();
  const uniform = new THREE.BufferGeometry();
  uniform.setAttribute('position', new THREE.Float32BufferAttribute(panelPositions, 3));
  uniform.setAttribute('normal', new THREE.Float32BufferAttribute(panelNormals, 3));
  const bodyGeometry = merged([
    { geometry: torso, color: ART.faction.player, trousersBelow: .30 },
    ...[-1,1].map(side => ({ geometry: ellipsoid(side*.15,.205,.01,.085,.045,.085,8,4), color: COMBAT_COLORS.player.trousers })),
    { geometry: toyWaistBand(.24,.19,.165,.345,.31,.036), color: COMBAT_COLORS.player.gear },
    { geometry: ellipsoid(-.23,.295,.035,.075,.075,.055,10,5), color: COMBAT_COLORS.player.gear },
    { geometry: ellipsoid(0, .685, -.015, .275, .20, .255, 20, 12), color: ART.faction.skin },
    hand(offhand, 3), hand(weaponHand, 4),
    { geometry: toyShoe({ x: -.17, y: 0, z: -.015, width: .27, height: .14, depth: .23,
      upper: ART.footwear.playerUpper, sole: ART.footwear.playerSole }), region: 1 },
    { geometry: toyShoe({ x: .17, y: 0, z: .025, width: .27, height: .14, depth: .23,
      upper: ART.footwear.playerUpper, sole: ART.footwear.playerSole }), region: 2 },
    ...[-1, 1].map(side => ({ geometry: ellipsoid(side * .095, .69, .224, .015, .019, .009, 8, 4), color: ART.faction.weapon })),
  ], true);
  const helmetGeometry = merged([{ geometry: toyHelmetShell({ rx: .325, ry: .27, rz: .285, y: .755,
    front: Math.PI / 2, side: 1.77, rear: 1.88, segments: 24, rings: 10 }), color: 'white' }]);
  const chestGeometry = merged([{ geometry: uniform, color: '#91b7d0' }]);
  const weaponGeometry = merged([
    { geometry: ellipsoid(0, 0, .045, .075, .07, .145, 12, 8), color: ART.faction.weapon },
    { geometry: ellipsoid(0, -.01, -.17, .065, .06, .09, 12, 6), color: ART.faction.equipment },
    { geometry: ellipsoid(0, -.065, .035, .04, .09, .045, 10, 6), color: ART.faction.weapon },
    { geometry: new THREE.CylinderGeometry(.04, .04, .30, 12).rotateX(Math.PI / 2).translate(0, .012, .34), color: ART.faction.weapon },
  ]);
  const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
  // Larger rounded receiver, belt box and ribbed barrel. Accepted body/grip
  // anchors are unchanged; this is one reusable geometry with the Rifle material.
  const machineGunGeometry = merged([
    { geometry: new RoundedBoxGeometry(.24, .18, .34, 2, .035).translate(0, .015, .06), color: ART.faction.weapon },
    { geometry: ellipsoid(0, -.01, -.20, .075, .065, .115, 12, 6), color: ART.faction.equipment },
    { geometry: ellipsoid(0, -.065, -.055, .04, .09, .045, 10, 6), color: ART.faction.weapon },
    { geometry: new RoundedBoxGeometry(.20, .19, .21, 2, .03).translate(-.10, -.11, .08), color: '#6E8272' },
    { geometry: new THREE.CylinderGeometry(.065, .065, .28, 12).rotateX(Math.PI / 2).translate(0, .012, .35), color: ART.faction.weapon },
    ...[.27, .35, .43].map(z => ({ geometry: new THREE.CylinderGeometry(.082, .082, .035, 12)
      .rotateX(Math.PI / 2).translate(0, .012, z), color: ART.faction.equipment })),
  ]);
  const bodyMaterial = matte(), gearMaterial = matte(), weaponMaterial = matte();
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial);
  const vest = new THREE.Mesh(chestGeometry, gearMaterial), weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
  const machineGunWeapon = new THREE.Mesh(machineGunGeometry, weaponMaterial);
  const muzzleRest = new THREE.Vector3().fromArray(muzzleAnchor).applyMatrix4(weaponRest).multiplyScalar(rootScale);
  return {
    role: 'player', id: 'topwar-player', body, helmet, vest, weapon, machineGunWeapon,
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
      for (const geometry of [bodyGeometry, helmetGeometry, chestGeometry, weaponGeometry, machineGunGeometry]) geometry.dispose();
      for (const material of [bodyMaterial, gearMaterial, weaponMaterial]) material.dispose();
    },
  };
}
