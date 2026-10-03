import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ART } from '../../art/ArtDirection';
import { HEAVY_GAIT_CYCLE_MS, type CrowdVisualFamily, type GiantVisualFamily } from '../CharacterVisualFamilies';

export const THREAT_COLORS = { shirt: ART.raider.body, shorts: ART.raider.shorts,
  stone: ART.raider.stone, helmet: ART.raider.helmet } as const;
type Part = { geometry: THREE.BufferGeometry; color: string; lower?: number };
const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, segments = 12, rings = 6) =>
  new THREE.SphereGeometry(1, segments, rings).scale(rx, ry, rz).translate(x, y, z);
const block = (x: number, y: number, z: number, w: number, h: number, d: number) =>
  new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .2).translate(x, y, z);
const band = (y: number, rx: number, rz: number, h: number) =>
  new THREE.CylinderGeometry(rx, rx, h, 16).scale(1, 1, rz / rx).translate(0, y, 0);

function merge(parts: Part[]): THREE.BufferGeometry {
  const geometries = parts.map(part => {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute('uv');
    const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color(part.color);
    for (let i = 0; i < positions.count; i += 3) {
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      color.set(part.lower !== undefined && y < part.lower ? THREAT_COLORS.shorts : part.color);
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
  return [-1, 1].map(side => ({ geometry: ball(side * .095, y, z, radius, radius * 1.12, .012, 4, 2), color: ART.faction.weapon }));
}

function heavyPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  return merge([
    { geometry: ball(0, .35, 0, .34, .23, .235, 16, 7), color: THREAT_COLORS.shirt, lower: .30 },
    { geometry: ball(0, .65, 0, .32, .20, .26), color: ART.faction.skin },
    ...face(.655, .264, .028),
    ...[-1, 1].map(side => ({ geometry: ball(side * .41, .34, side * stride * .12, .11, .115, .115, 8, 4), color: ART.faction.skin })),
    { geometry: block(-.25 - (liftLeft > .05 ? .045 : 0), .07 + liftLeft, stride * .13, .32, .14, .38), color: ART.faction.shoes },
    { geometry: block(.25 + (liftRight > .05 ? .045 : 0), .07 + liftRight, -stride * .13, .32, .14, .38), color: ART.faction.shoes },
  ]);
}

export function createChibiHeavyFamily(): CrowdVisualFamily<'heavy'> & { dispose(): void } {
  const idle = heavyPose(0), runs = [heavyPose(1, 0, .09), heavyPose(-.25, .018, 0),
    heavyPose(-1, .09, 0), heavyPose(.25, 0, .018)], death = gray(idle);
  const helmetGeometry = merge([
    // Thick bucket crown with a nearly flush lip; the face opening stays clear.
    { geometry: new THREE.LatheGeometry([
      new THREE.Vector2(0, .99), new THREE.Vector2(.22, .975),
      new THREE.Vector2(.36, .925), new THREE.Vector2(.425, .86),
      new THREE.Vector2(.44, .79), new THREE.Vector2(.43, .765),
    ].reverse(), 16).scale(1, 1, .32 / .44), color: THREAT_COLORS.helmet },
    { geometry: band(.775, .445, .325, .035), color: ART.raider.rim },
  ]);
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
    { geometry: ball(0, .46, 0, .42, .32, .29, 16, 7), color: ART.raider.bodyDeep, lower: .46 + .32 * Math.cos(4 * Math.PI / 7) },
    { geometry: ball(0, .94, 0, .33, .22, .29, 12, 6), color: ART.faction.skin },
    ...face(.885, .28),
    ...[-1, 1].map(side => ({ geometry: ball(side * .46, .40, side * stride * .10, .14, .145, .145, 8, 4), color: ART.faction.skin })),
    { geometry: block(-.27 - (liftLeft > .05 ? .035 : 0), .085 + liftLeft, stride * .14, .38, .17, .45), color: ART.faction.shoes },
    { geometry: block(.27 + (liftRight > .05 ? .035 : 0), .085 + liftRight, -stride * .14, .38, .17, .45), color: ART.faction.shoes },
  ]);
}

export function createChibiGiantFamily(): GiantVisualFamily & { dispose(): void } {
  const idle = giantPose(0), runs = [giantPose(1, 0, .085), giantPose(-.25, .018, 0),
    giantPose(-1, .085, 0), giantPose(.25, 0, .018)], death = gray(idle);
  const helmetGeometry = merge([
    { geometry: new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(.405, .255, .355).translate(0, .97, 0), color: THREAT_COLORS.helmet },
    { geometry: band(.96, .425, .37, .065), color: THREAT_COLORS.stone },
    // One broad longitudinal fin, no spikes or little fittings.
    { geometry: block(0, 1.21, 0, .165, .29, .47), color: THREAT_COLORS.stone },
  ]);
  // A shallow annular shoulder yoke leaves the torso and neck opening readable.
  const armorGeometry = merge([{ geometry: new THREE.LatheGeometry([
    new THREE.Vector2(.25, .735), new THREE.Vector2(.29, .755),
    new THREE.Vector2(.39, .755), new THREE.Vector2(.43, .715),
    new THREE.Vector2(.40, .665), new THREE.Vector2(.29, .665),
    new THREE.Vector2(.25, .695), new THREE.Vector2(.25, .735),
  ].reverse(), 16).scale(1, 1, .68), color: THREAT_COLORS.stone }]);
  // Weapon authored in character space; the renderer adds only small delayed rotation.
  const weaponGeometry = merge([
    { geometry: new THREE.CylinderGeometry(.044, .055, .64, 8).translate(.60, .42, .08), color: ART.raider.hardware },
    { geometry: block(.60, .77, .08, .44, .30, .34), color: THREAT_COLORS.helmet },
    { geometry: block(.60, .77, .08, .11, .32, .36), color: THREAT_COLORS.stone },
  ]);
  // Contact's bounded three-mesh adapter includes the signature maul explicitly.
  const contactGeometry = mergeGeometries([idle, weaponGeometry]);
  if (!contactGeometry) throw new Error('Giant contact requires body and maul');
  contactGeometry.computeBoundingBox(); contactGeometry.computeBoundingSphere();
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial), weapon = new THREE.Mesh(weaponGeometry, gearMaterial);
  return { role: 'giant', id: 'topwar-colossus-prototype', body, helmet, vest, weapon,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)), grayBody: new THREE.Mesh(death, deathMaterial),
    contactPresentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored' },
    presentation: { width: 1.60, height: 1.43, depth: .96, shadow: { width: 1.02, depth: .48 } },
    contact: { body: new THREE.Mesh(contactGeometry, bodyMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, death, helmetGeometry, armorGeometry, weaponGeometry, contactGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}
