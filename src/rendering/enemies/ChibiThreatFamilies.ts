import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toyEllipsoid as ball, toyShoe, toyHelmetShell } from '../characters/ToyGeometry';
import { ART } from '../../art/ArtDirection';
import { COMBAT_COLORS, toyClothBand, toyWaistBand } from '../characters/ToyCombatGear';
import { HEAVY_GAIT_CYCLE_MS, type CrowdVisualFamily, type GiantVisualFamily } from '../CharacterVisualFamilies';

export const THREAT_COLORS = { shirt: COMBAT_COLORS.heavy.shirt, shorts: COMBAT_COLORS.heavy.trousers,
  stone: ART.raider.stone, helmet: ART.raider.helmet } as const;
type Part = { geometry: THREE.BufferGeometry; color?: string; lower?: number; lowerColor?: string };
function merge(parts: Part[]): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
    if (!part.color) return geometry;
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      color.set(part.lower !== undefined && y < part.lower ? part.lowerColor ?? THREAT_COLORS.shorts : part.color);
      for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geometry;
  });
  const result = mergeGeometries(geometries);
  geometries.forEach(g => g.dispose());
  if (!result) throw new Error('Threat parts must merge into static vertex-colored geometry');
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
function gray(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const result = geometry.clone(), colors = result.getAttribute('color');
  for (let i = 0; i < colors.count; i++) {
    const value = colors.getX(i) * .2126 + colors.getY(i) * .7152 + colors.getZ(i) * .0722;
    colors.setXYZ(i, value, value, value);
  }
  return result;
}
const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
function face(y: number, z: number, radius = .018): Part[] {
  return [-1, 1].map(side => ({ geometry: ball(side * .095, y, z, radius, radius * 1.12, .012, 8, 4), color: ART.faction.weapon }));
}

function heavyPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  return merge([
    { geometry: ball(0, .35, 0, .34, .24, .275, 20, 12), color: THREAT_COLORS.shirt, lower: .30 },
    ...[-1,1].map(side => ({ geometry: ball(side*.26,.205,0,.105,.045,.125,8,4), color: THREAT_COLORS.shorts })),
    { geometry: toyClothBand(.34,.24,.275,.35,Math.PI/2,.18,-.85), color: COMBAT_COLORS.heavy.harness },
    ...[-1,1].map(side => ({ geometry: ball(side*.33,.225,.12,.085,.09,.095,8,5), color: COMBAT_COLORS.heavy.pouch })),
    { geometry: ball(0, .65, 0, .32, .20, .26, 20, 12), color: ART.faction.skin },
    ...face(.655, .264, .027),
    ...[-1, 1].map(side => ({ geometry: ball(side * .495, .34, side * stride * .12, .13, .13, .13, 16, 10), color: ART.faction.skin })),
    { geometry: toyShoe({ x: -.265 - (liftLeft > .05 ? .045 : 0), y: liftLeft, z: stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    { geometry: toyShoe({ x: .265 + (liftRight > .05 ? .045 : 0), y: liftRight, z: -stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
  ]);
}

export function createChibiHeavyFamily(): CrowdVisualFamily<'heavy'> & { dispose(): void } {
  const idle = heavyPose(0), runs = [heavyPose(1, 0, .09), heavyPose(-.25, .018, 0),
    heavyPose(-1, .09, 0), heavyPose(.25, 0, .018)], death = gray(idle);
  const helmetGeometry = merge([{ geometry: toyHelmetShell({
    // Unique deep shell: open forehead, lowered curved cheek sides and rear.
    rx: .425, ry: .225, rz: .37, y: .765, front: 1.30, side: 2.05, rear: 2.30,
    segments: 24, rings: 10, thickness: .02,
  }), color: COMBAT_COLORS.heavy.helmet }]);
  // Invisible contract adapter, matching Grunt. Heavy has no secondary armor region.
  const armorGeometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color'])
    armorGeometry.setAttribute(attribute, new THREE.Float32BufferAttribute([], 3));
  armorGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  armorGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial);
  vest.visible = false;
  return { role: 'heavy', id: 'topwar-heavy-prototype', body, helmet, vest,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)), gaitCycleMs: HEAVY_GAIT_CYCLE_MS,
    presentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored', scaleY: .80, hitCompression: .025,
      stepWeight: { shift: .045, roll: .04, compression: .018 },
      hpAnchor: { top: 1.025, width: .78 }, shadow: { width: .84, depth: .44 } },
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(death, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, death, helmetGeometry, armorGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}

function giantPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  return merge([
    // Follow a latitude ring for a clean shorts color boundary.
    { geometry: ball(0, .46, 0, .42, .32, .29, 24, 12), color: ART.raider.bodyDeep,
      lower: .40, lowerColor: ART.raider.shorts },
    ...[-1,1].map(side => ({ geometry: ball(side*.285,.235,0,.13,.045,.13,8,4), color: ART.raider.shorts })),
    { geometry: toyWaistBand(.42,.32,.29,.46,.39,.055), color: COMBAT_COLORS.giant.sash },
    { geometry: ball(-.425,.31,.13,.125,.16,.12,10,5), color: COMBAT_COLORS.giant.satchel },
    { geometry: ball(0, .94, 0, .33, .22, .29, 24, 12), color: ART.faction.skin },
    ...face(.885, .28),
    ...[-1, 1].map(side => ({ geometry: ball(side * .48, .40, side * stride * .10, .145, .145, .145, 16, 10), color: ART.faction.skin })),
    { geometry: toyShoe({ x: -.28 - (liftLeft > .05 ? .035 : 0), y: liftLeft, z: stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    { geometry: toyShoe({ x: .28 + (liftRight > .05 ? .035 : 0), y: liftRight, z: -stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
  ]);
}

export function createChibiGiantFamily(): GiantVisualFamily & { dispose(): void } {
  const idle = giantPose(0), runs = [giantPose(1, 0, .085), giantPose(-.25, .018, 0),
    giantPose(-1, .085, 0), giantPose(.25, 0, .018)], death = gray(idle);
  const helmetGeometry = merge([
    { geometry: toyHelmetShell({ rx: .405, ry: .285, rz: .355, y: .94,
      front: 1.45, side: 1.94, rear: 2.05, segments: 24, rings: 10 }), color: THREAT_COLORS.helmet },
    // One thick soft fin, not a rectangular crest or spike.
    { geometry: ball(0, 1.19, 0, .09, .165, .225, 16, 10), color: THREAT_COLORS.stone },
  ]);
  // The primary rounded torso needs no collar or chest equipment.
  const armorGeometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color'])
    armorGeometry.setAttribute(attribute, new THREE.Float32BufferAttribute([], 3));
  armorGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  armorGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  const weaponGeometry = merge([
    { geometry: new THREE.CylinderGeometry(.048, .055, .64, 12).translate(.60, .42, .08), color: ART.raider.hardware },
    { geometry: ball(.60, .77, .08, .23, .175, .19, 20, 12), color: THREAT_COLORS.helmet },
    // One soft limestone end region follows the maul's curved head.
    { geometry: ball(.755, .77, .08, .085, .155, .175, 16, 10), color: THREAT_COLORS.stone },
  ]);
  // Contact's bounded three-mesh adapter includes the signature maul explicitly.
  const contactGeometry = mergeGeometries([idle, weaponGeometry]);
  if (!contactGeometry) throw new Error('Giant contact requires body and maul');
  contactGeometry.computeBoundingBox(); contactGeometry.computeBoundingSphere();
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial), weapon = new THREE.Mesh(weaponGeometry, gearMaterial);
  vest.visible = false;
  return { role: 'giant', id: 'topwar-colossus-prototype', body, helmet, vest, weapon,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)), grayBody: new THREE.Mesh(death, deathMaterial),
    contactPresentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored' },
    presentation: { width: 1.60, height: 1.43, depth: .96, healthBar: { width: 1.20, height: .20 }, shadow: { width: 1.02, depth: .48 } },
    contact: { body: new THREE.Mesh(contactGeometry, bodyMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, death, helmetGeometry, armorGeometry, weaponGeometry, contactGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}
