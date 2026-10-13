import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toyEllipsoid as ball, toyShoe, toyHelmetShell } from '../characters/ToyGeometry';
import { lethalUpperMatrix } from './LethalReaction';
import { THREAT_DEATH_COLLAPSE } from '../../presentation/ThreatDeathCollapse';
import { tagDeathPiece } from './DeathAssembly';
import { ART } from '../../art/ArtDirection';
import { COMBAT_COLORS } from '../characters/ToyCombatGear';
import { paddedBarrel, canvasFieldBag } from '../characters/StructuredToyParts';
import { paintedBlockGeometry } from '../art/PaintedGeometry';
import { HEAVY_GAIT_CYCLE_MS, type CrowdVisualFamily, type GiantVisualFamily } from '../CharacterVisualFamilies';

export const THREAT_COLORS = { shirt: ART.enemyArmory.armor, shorts: COMBAT_COLORS.heavy.trousers,
  stone: ART.enemyArmory.sand, helmet: ART.enemyArmory.armor } as const;
type Part = { geometry: THREE.BufferGeometry; color?: string; lower?: number; lowerColor?: string; fixed?: boolean;
  piece?: number | ((y: number) => number) };
const block = (x: number, y: number, z: number, w: number, h: number, d: number) =>
  paintedBlockGeometry().scale(w, h, d).translate(x, y, z);
function merge(parts: Part[], reaction = 0, sink = .11): THREE.BufferGeometry {
  const giant = sink === .12;
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
    if (reaction > 0 && part.piece === undefined) throw Error('Death pose needs a logical piece');
    const piece = part.piece ?? 0;
    if (!part.color) return reaction > 0 ? tagDeathPiece(geometry, giant ? 'giant' : 'heavy', piece) : geometry;
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      color.set(part.lower !== undefined && y < part.lower ? part.lowerColor ?? THREAT_COLORS.shorts : part.color);
      for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (reaction > 0) tagDeathPiece(geometry, giant ? 'giant' : 'heavy', piece);
    if (reaction && !part.fixed) geometry.applyMatrix4(lethalUpperMatrix(reaction, sink, .09, THREAT_DEATH_COLLAPSE[giant ? 'giant' : 'heavy'].compression));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  geometries.forEach(g => g.dispose());
  if (!result) throw new Error('Threat parts must merge into static vertex-colored geometry');
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
const matte = () => new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1, metalness: 0 });
function face(y: number, z: number, radius = .018): Part[] {
  return [-1, 1].map(side => ({ geometry: ball(side * .095, y, z, radius, radius * 1.12, .012, 8, 4), color: ART.faction.weapon, piece: 1 }));
}

function heavyPose(stride: number, liftLeft = 0, liftRight = 0, reaction = 0): THREE.BufferGeometry {
  return merge([
    { geometry: paddedBarrel(.34, .48, .275, .35, .10,20,.30), color: THREAT_COLORS.shirt, lower: .30, piece: (y) => y >= .35 ? 2 : 3 },
    ...[-1,1].map(side => ({ geometry: ball(side*.26,.205,0,.105,.045,.125,8,4), color: THREAT_COLORS.shorts, piece: 3 })),
    { geometry: block(0,.42,.26,.52,.32,.12), color: COMBAT_COLORS.heavy.harness, piece: 6 },
    ...[-1,1].map(side => ({ geometry: canvasFieldBag(.18,.155,.10).rotateY(side*.16)
      .translate(side*.245,.245,.235), color: COMBAT_COLORS.heavy.pouch, piece: side < 0 ? 6 : 7 })),
    { geometry: ball(0, .65, 0, .32, .20, .26, 20, 12), color: ART.faction.skin, piece: 1 },
    ...face(.655, .264, .027),
    ...[-1, 1].map(side => ({ geometry: ball(side * (.495 + reaction * .055), .34 - reaction * .10, side * stride * .12, .13, .13, .13, 16, 10), color: ART.faction.skin, fixed: true, piece: side < 0 ? 4 : 5 })),
    { fixed: true, geometry: toyShoe({ x: -.265 - reaction * .045 - (liftLeft > .05 ? .045 : 0), y: liftLeft, z: stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }), piece: 8 },
    { fixed: true, geometry: toyShoe({ x: .265 + reaction * .045 + (liftRight > .05 ? .045 : 0), y: liftRight, z: -stride * .13,
      width: .34, height: .15, depth: .27, upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole }), piece: 9 },
    ...[-1,1].map(side => ({ geometry: block(side*.36,.52,0,.36,.24,.44),
      color: ART.enemyArmory.steel, piece: 2 })),
    ...[-1,1].map(side => ({ geometry: block(side*(.495+reaction*.055),.34-reaction*.10,side*stride*.12,
      .24,.20,.28), color: ART.enemyArmory.iron, piece: side < 0 ? 4 : 5, fixed: true })),
  ], reaction);
}

export function createChibiHeavyFamily(): CrowdVisualFamily<'heavy'> & { dispose(): void } {
  const idle = heavyPose(0), runs = [heavyPose(1, 0, .09), heavyPose(-.25, .018, 0),
    heavyPose(-1, .09, 0), heavyPose(.25, 0, .018)], death = heavyPose(0, 0, 0, 1), transition = heavyPose(0, 0, 0, .5);
  const helmetGeometry = merge([{ geometry: toyHelmetShell({
    // Deep cheek guards and a single broad observation visor, above the human chin.
    rx: .425, ry: .225, rz: .37, y: .765, front: 1.30, side: 2.05, rear: 2.30,
    segments: 24, rings: 10, thickness: .02,
  }), color: ART.enemyArmory.armor },
    { geometry: block(0,.72,.30,.63,.20,.11), color: ART.enemyArmory.iron },
    { geometry: block(0,.735,.357,.49,.055,.025), color: ART.enemyArmory.warning },
  ]);
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
    presentation: {  gearTint: 'authored', scaleY: .80, hitCompression: .025,
      stepWeight: { shift: .045, roll: .04, compression: .018 },
      hpAnchor: { top: 1.025, width: .78 }, shadow: { width: .84, depth: .44 } },
    lethalReaction: { transition: new THREE.Mesh(transition, bodyMaterial), final: new THREE.Mesh(death, bodyMaterial), sink: .11, tilt: .09, compression: THREAT_DEATH_COLLAPSE.heavy.compression },
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(death, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, transition, death, helmetGeometry, deathHelmet, armorGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}

export const GIANT_WEAPON_GRIP = [.60, .40, .08] as const;

function giantPose(stride: number, liftLeft = 0, liftRight = 0, reaction = 0): THREE.BufferGeometry {
  return merge([
    // An offset ammunition vault, shield arm and short ram give this siege machine
    // its own silhouette. Rigid gait, grip and logical death pieces stay unchanged.
    { geometry: block(0,.72,0,.84,.55,.49), color: ART.enemyArmory.armor, piece: (y) => y >= .65 ? 3 : 4 },
    { geometry: block(0,.73,.28,.55,.36,.10), color: ART.enemyArmory.sand, piece: 3 },
    { geometry: block(0,.39,0,.54,.14,.35), color: COMBAT_COLORS.giant.sash, piece: 4 },
    { geometry: block(0,.29,0,.51,.16,.32), color: ART.raider.shorts, piece: 5 },
    { geometry: block(-.30,.91,-.12,.33,.49,.40), color: COMBAT_COLORS.giant.satchel, piece: 8 },
    { geometry: block(-.30,1.01,.10,.24,.16,.045), color: ART.enemyArmory.iron, piece: 8 },
    ...[.97,1.05].map(y => ({ geometry: block(-.30,y,.126,.18,.025,.012), color: ART.enemyArmory.copper, piece: 8 })),
    { geometry: block(.08,1.025,0,.22,.15,.24), color: ART.enemyArmory.iron, piece: 2 },
    { geometry: block(-.48-reaction*.035,.50+reaction*.24,-stride*.10,.29,.45,.39),
      color: ART.enemyArmory.steel, piece: 6, fixed: true },
    { geometry: block(-.48-reaction*.035,.52+reaction*.24,.21-stride*.10,.20,.30,.06),
      color: ART.enemyArmory.armor, piece: 6, fixed: true },
    ...[-1,1].map(side => ({ geometry: block(side*.28,.25+(side < 0 ? liftLeft : liftRight),side*stride*.14,.24,.28,.25),
      color: ART.raider.shorts, piece: 5, fixed: true })),
    ...[-1,1].map(side => ({ geometry: block(side*.28,.34+(side < 0 ? liftLeft : liftRight),.14+side*stride*.14,.27,.15,.14),
      color: ART.enemyArmory.steel, piece: 5, fixed: true })),
    { fixed: true, geometry: toyShoe({ x: -.28 - reaction * .03 - (liftLeft > .05 ? .035 : 0), y: liftLeft, z: stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.enemyArmory.iron, sole: ART.enemyArmory.steel }), piece: 9 },
    { fixed: true, geometry: toyShoe({ x: .28 + reaction * .03 + (liftRight > .05 ? .035 : 0), y: liftRight, z: -stride * .14,
      width: .40, height: .18, depth: .32, upper: ART.enemyArmory.iron, sole: ART.enemyArmory.steel }), piece: 10 },
  ], reaction, .12);
}

export function createChibiGiantFamily(): GiantVisualFamily & { dispose(): void } {
  const idle = giantPose(0), runs = [giantPose(1, 0, .085), giantPose(-.25, .018, 0),
    giantPose(-1, .085, 0), giantPose(.25, 0, .018)];
  const transition = giantPose(0, 0, 0, .5), death = giantPose(0, 0, 0, 1);
  const helmetGeometry = merge([
    { geometry: block(.08,1.16,0,.38,.25,.32), color: THREAT_COLORS.helmet },
    { geometry: block(.08,1.16,.17,.23,.15,.04), color: ART.enemyArmory.iron },
    // One vertical slit in a small offset rectangular sensor; no human face.
    { geometry: block(.08,1.16,.195,.055,.11,.015), color: ART.enemyArmory.warning },
    { geometry: block(.08,1.30,-.035,.44,.08,.37), color: THREAT_COLORS.stone },
  ]);
  // Equipment remains merged into the body; no secondary armor draw.
  const armorGeometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color'])
    armorGeometry.setAttribute(attribute, new THREE.Float32BufferAttribute([], 3));
  armorGeometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  armorGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  const weaponGeometry = merge([
    { geometry: block(...GIANT_WEAPON_GRIP,.23,.23,.27), color: ART.enemyArmory.iron },
    { geometry: new THREE.CylinderGeometry(.065, .065, .49, 8).translate(.60, .50, .08), color: ART.enemyArmory.copper },
    { geometry: block(.60,.77,.08,.42,.30,.34), color: THREAT_COLORS.helmet },
    { geometry: block(.755,.77,.08,.12,.27,.35), color: THREAT_COLORS.stone },
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
  return { deathAssembly: { body: death, helmet: deathHelmet, weapon: deathWeapon, pieceCount: 11 }, lethalReaction: { transition: new THREE.Mesh(transition, bodyMaterial), final: new THREE.Mesh(death, bodyMaterial), sink: .12, tilt: .09, compression: THREAT_DEATH_COLLAPSE.giant.compression },
    role: 'giant', id: 'topwar-colossus', body, helmet, vest, weapon, weaponGrip: GIANT_WEAPON_GRIP,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)),
    contactPresentation: {  gearTint: 'authored' },
    presentation: { width: 1.60, height: 1.43, depth: .96, healthBar: { width: 1.20, height: .20 }, shadow: { width: 1.02, depth: .48 } },
    contact: { body: new THREE.Mesh(contactGeometry, bodyMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, transition, death, helmetGeometry, deathHelmet, deathWeapon, armorGeometry, weaponGeometry, contactGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial].forEach(m => m.dispose());
    } };
}
