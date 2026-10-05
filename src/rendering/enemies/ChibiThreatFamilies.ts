import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toyEllipsoid as ball, toyShoe, toyHelmetShell } from '../characters/ToyGeometry';
import { lethalUpperMatrix } from './LethalReaction';
import { tagDeathPiece } from './DeathAssembly';
import { ART } from '../../art/ArtDirection';
import { COMBAT_COLORS } from '../characters/ToyCombatGear';
import { paddedBarrel, heavyWebHarness, canvasFieldBag } from '../characters/StructuredToyParts';
import { HEAVY_GAIT_CYCLE_MS, type CrowdVisualFamily, type GiantVisualFamily } from '../CharacterVisualFamilies';

export const THREAT_COLORS = { shirt: COMBAT_COLORS.heavy.shirt, shorts: COMBAT_COLORS.heavy.trousers,
  stone: ART.raider.stone, helmet: ART.raider.helmet } as const;
type Part = { geometry: THREE.BufferGeometry; color?: string; lower?: number; lowerColor?: string; fixed?: boolean };
function merge(parts: Part[], reaction = 0, sink = .11): THREE.BufferGeometry {
  const giant = sink === .12;
  const labels = giant ? [(y: number) => y >= .65 ? 3 : y >= .40 ? 4 : 5, 5, 5, 8, 8, 2, 2, 2, 6, 9, 10]
    : [(y: number) => y >= .35 ? 2 : 3, 3, 3, 6, 6, 7, 1, 1, 1, 4, 5, 8, 9];
  const geometries = parts.map((part, index) => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
    if (!part.color) return reaction > 0 ? tagDeathPiece(geometry, giant ? 'giant' : 'heavy', labels[index]) : geometry;
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      color.set(part.lower !== undefined && y < part.lower ? part.lowerColor ?? THREAT_COLORS.shorts : part.color);
      for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (reaction > 0) tagDeathPiece(geometry, giant ? 'giant' : 'heavy', labels[index]);
    if (reaction && !part.fixed) geometry.applyMatrix4(lethalUpperMatrix(reaction, sink, .09));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  geometries.forEach(g => g.dispose());
  if (!result) throw new Error('Threat parts must merge into static vertex-colored geometry');
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
function face(y: number, z: number, radius = .018): Part[] {
  return [-1, 1].map(side => ({ geometry: ball(side * .095, y, z, radius, radius * 1.12, .012, 8, 4), color: ART.faction.weapon }));
}

function heavyPose(stride: number, liftLeft = 0, liftRight = 0, reaction = 0): THREE.BufferGeometry {
  return merge([
    { geometry: paddedBarrel(.34, .48, .275, .35, .10,20,.30), color: THREAT_COLORS.shirt, lower: .30 },
    ...[-1,1].map(side => ({ geometry: ball(side*.26,.205,0,.105,.045,.125,8,4), color: THREAT_COLORS.shorts })),
    { geometry: heavyWebHarness(), color: COMBAT_COLORS.heavy.harness },
    ...[-1,1].map(side => ({ geometry: canvasFieldBag(.18,.155,.10).rotateY(side*.16)
      .translate(side*.245,.245,.235), color: COMBAT_COLORS.heavy.pouch })),
    { geometry: ball(0, .65, 0, .32, .20, .26, 20, 12), color: ART.faction.skin },
    ...face(.655, .264, .027),
    ...[-1, 1].map(side => ({ geometry: ball(side * (.495 + reaction * .025), .34 + reaction * .18, side * stride * .12, .13, .13, .13, 16, 10), color: ART.faction.skin, fixed: true })),
    { fixed: true, geometry: toyShoe({ x: -.265 - reaction * .035 - (liftLeft > .05 ? .045 : 0), y: liftLeft, z: stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    { fixed: true, geometry: toyShoe({ x: .265 + reaction * .035 + (liftRight > .05 ? .045 : 0), y: liftRight, z: -stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
  ], reaction);
}

export function createChibiHeavyFamily(): CrowdVisualFamily<'heavy'> & { dispose(): void } {
  const idle = heavyPose(0), runs = [heavyPose(1, 0, .09), heavyPose(-.25, .018, 0),
    heavyPose(-1, .09, 0), heavyPose(.25, 0, .018)], death = heavyPose(0, 0, 0, 1), transition = heavyPose(0, 0, 0, .5);
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
  const deathHelmet = tagDeathPiece(helmetGeometry.clone(), 'heavy', 0);
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial);
  vest.visible = false;
  return { deathAssembly: { body: death, helmet: deathHelmet, pieceCount: 10 }, role: 'heavy', id: 'topwar-heavy', body, helmet, vest,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)), gaitCycleMs: HEAVY_GAIT_CYCLE_MS,
    presentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored', scaleY: .80, hitCompression: .025,
      stepWeight: { shift: .045, roll: .04, compression: .018 },
      hpAnchor: { top: 1.025, width: .78 }, shadow: { width: .84, depth: .44 } },
    lethalReaction: { transition: new THREE.Mesh(transition, bodyMaterial), final: new THREE.Mesh(death, bodyMaterial), sink: .11, tilt: .09 },
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(death, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, transition, death, helmetGeometry, deathHelmet, armorGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}

export const GIANT_WEAPON_GRIP = [.60, .40, .08] as const;

function giantPose(stride: number, liftLeft = 0, liftRight = 0, reaction = 0): THREE.BufferGeometry {
  return merge([
    // Taller padded barrel; crown/whole-role scale remain fixed, head gets smaller.
    { geometry: paddedBarrel(.42,.76,.29,.515,.145,24,.40), color: ART.raider.bodyDeep,
      lower: .40, lowerColor: ART.raider.shorts },
    ...[-1,1].map(side => ({ geometry: ball(side*.285,.235,0,.13,.045,.13,8,4), color: ART.raider.shorts })),
    { geometry: new THREE.CylinderGeometry(1,1,.055,16,1,true).scale(.44,1,.31).translate(0,.395,0),
      color: COMBAT_COLORS.giant.sash },
    { geometry: canvasFieldBag(.245,.275,.12).rotateY(-.35).translate(-.37,.33,.205), color: COMBAT_COLORS.giant.satchel },
    { geometry: ball(0,1.075,0,.232716,.1755,.204508,24,12), color: ART.faction.skin },
    ...face(1.045,.202,.020),
    // Only the offhand belongs to the baked body poses; grip hand is weapon-owned.
    { geometry: ball(-.48 - reaction * .035, .40 + reaction * .24, -stride * .10, .145, .145, .145, 16, 10), color: ART.faction.skin, fixed: true },
    { fixed: true, geometry: toyShoe({ x: -.28 - reaction * .03 - (liftLeft > .05 ? .035 : 0), y: liftLeft, z: stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
    { fixed: true, geometry: toyShoe({ x: .28 + reaction * .03 + (liftRight > .05 ? .035 : 0), y: liftRight, z: -stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }) },
  ], reaction, .12);
}

export function createChibiGiantFamily(): GiantVisualFamily & { dispose(): void } {
  const idle = giantPose(0), runs = [giantPose(1, 0, .085), giantPose(-.25, .018, 0),
    giantPose(-1, .085, 0), giantPose(.25, 0, .018)];
  const transition = giantPose(0, 0, 0, .5), death = giantPose(0, 0, 0, 1);
  const helmetGeometry = merge([
    { geometry: toyHelmetShell({ rx: .285606, ry: .22, rz: .250346, y: 1.095,
      front: 1.45, side: 1.94, rear: 2.05, segments: 24, rings: 10 }), color: THREAT_COLORS.helmet },
    // One thick soft fin, not a rectangular crest or spike.
    { geometry: ball(0,1.235,0,.081,.12,.1628,16,10), color: THREAT_COLORS.stone },
  ]);
  // The primary rounded torso needs no collar or chest equipment.
  const armorGeometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color'])
    armorGeometry.setAttribute(attribute, new THREE.Float32BufferAttribute([], 3));
  armorGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  armorGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  const weaponGeometry = merge([
    { geometry: ball(...GIANT_WEAPON_GRIP, .145, .145, .145, 16, 10), color: ART.faction.skin },
    { geometry: new THREE.CylinderGeometry(.048, .055, .64, 12).translate(.60, .42, .08), color: ART.raider.hardware },
    { geometry: ball(.60, .77, .08, .23, .175, .19, 20, 12), color: THREAT_COLORS.helmet },
    // One soft limestone end region follows the maul's curved head.
    { geometry: ball(.755, .77, .08, .085, .155, .175, 16, 10), color: THREAT_COLORS.stone },
  ]);
  // Contact's bounded three-mesh adapter includes the signature maul explicitly.
  const contactGeometry = mergeGeometries([idle, weaponGeometry]);
  if (!contactGeometry) throw new Error('Giant contact requires body and maul');
  contactGeometry.computeBoundingBox(); contactGeometry.computeBoundingSphere();
  const stone = new THREE.Color(THREAT_COLORS.stone);
  const deathHelmet = tagDeathPiece(helmetGeometry.clone(), 'giant', (_y, color, i) =>
    color && Math.abs(color.getX(i)-stone.r) < .00001 ? 1 : 0);
  const deathWeapon = tagDeathPiece(weaponGeometry.clone(), 'giant', 7);
  const bodyMaterial = matte(), gearMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial), weapon = new THREE.Mesh(weaponGeometry, gearMaterial);
  vest.visible = false;
  return { deathAssembly: { body: death, helmet: deathHelmet, weapon: deathWeapon, pieceCount: 11 }, lethalReaction: { transition: new THREE.Mesh(transition, bodyMaterial), final: new THREE.Mesh(death, bodyMaterial), sink: .12, tilt: .09 },
    role: 'giant', id: 'topwar-colossus', body, helmet, vest, weapon, weaponGrip: GIANT_WEAPON_GRIP,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)),
    contactPresentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored' },
    presentation: { width: 1.60, height: 1.43, depth: .96, healthBar: { width: 1.20, height: .20 }, shadow: { width: 1.02, depth: .48 } },
    contact: { body: new THREE.Mesh(contactGeometry, bodyMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, transition, death, helmetGeometry, deathHelmet, deathWeapon, armorGeometry, weaponGeometry, contactGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial].forEach(m => m.dispose());
    } };
}
