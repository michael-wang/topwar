import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ART } from '../../art/ArtDirection';
import { HEAVY_GAIT_CYCLE_MS, type CrowdVisualFamily, type GiantVisualFamily } from '../CharacterVisualFamilies';

export const THREAT_COLORS = { shirt: '#9d3045', shorts: '#303e4c', ochre: '#b09a63', helmet: '#b9324c' } as const;
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
function face(y: number, z: number): Part[] {
  return [-1, 1].map(side => ({ geometry: ball(side * .095, y, z, .018, .02, .01, 4, 2), color: ART.faction.weapon }));
}

function heavyPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  return merge([
    { geometry: ball(0, .35, 0, .34, .23, .235, 16, 7), color: THREAT_COLORS.shirt, lower: .30 },
    { geometry: ball(0, .65, 0, .29, .20, .25), color: ART.faction.skin },
    ...face(.65, .238),
    ...[-1, 1].map(side => ({ geometry: ball(side * .355, .34, side * stride * .085, .10, .105, .105, 8, 4), color: ART.faction.skin })),
    { geometry: block(-.235, .07 + liftLeft, stride * .10, .32, .14, .38), color: ART.faction.equipment },
    { geometry: block(.235, .07 + liftRight, -stride * .10, .32, .14, .38), color: ART.faction.equipment },
  ]);
}

export function createChibiHeavyFamily(): CrowdVisualFamily<'heavy'> & { dispose(): void } {
  const idle = heavyPose(0), runs = [heavyPose(1, .025), heavyPose(.2, .035, .005),
    heavyPose(-1, 0, .025), heavyPose(-.2, .005, .035)], death = gray(idle);
  const helmetGeometry = merge([
    { geometry: new THREE.SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(.44, .22, .32).translate(0, .77, 0), color: THREAT_COLORS.helmet },
    { geometry: band(.76, .465, .345, .065), color: '#8e293e' },
    { geometry: band(.715, .47, .35, .035), color: THREAT_COLORS.helmet },
    { geometry: block(0, .775, .304, .67, .065, .085), color: THREAT_COLORS.ochre },
  ]);
  const armorGeometry = merge([{ geometry: ball(0, .36, .22, .27, .17, .07, 12, 6), color: THREAT_COLORS.ochre }]);
  const bodyMaterial = matte(), gearMaterial = matte(), deathMaterial = matte();
  const body = new THREE.Mesh(idle, bodyMaterial), helmet = new THREE.Mesh(helmetGeometry, gearMaterial),
    vest = new THREE.Mesh(armorGeometry, gearMaterial);
  return { role: 'heavy', id: 'topwar-heavy-prototype', body, helmet, vest,
    runFrames: runs.map(g => new THREE.Mesh(g, bodyMaterial)), gaitCycleMs: HEAVY_GAIT_CYCLE_MS,
    presentation: { materialStyle: 'vertex-colors', bodyTint: 'authored', gearTint: 'authored', scaleY: .80, hitCompression: .025,
      hpAnchor: { top: 1.025, width: .78 }, shadow: { width: .84, depth: .44 } },
    contact: { body, helmet, vest }, death: { body: new THREE.Mesh(death, deathMaterial), helmet, vest },
    dispose(): void {
      [idle, ...runs, death, helmetGeometry, armorGeometry].forEach(g => g.dispose());
      [bodyMaterial, gearMaterial, deathMaterial].forEach(m => m.dispose());
    } };
}

function giantPose(stride: number, liftLeft = 0, liftRight = 0): THREE.BufferGeometry {
  return merge([
    { geometry: ball(0, .46, 0, .42, .32, .29, 16, 7), color: '#862d40', lower: .33 },
    { geometry: ball(0, .94, 0, .33, .22, .29, 12, 6), color: ART.faction.skin },
    ...face(.885, .28),
    ...[-1, 1].map(side => ({ geometry: ball(side * .46, .40, side * stride * .08, .14, .145, .145, 8, 4), color: ART.faction.skin })),
    { geometry: block(-.27, .085 + liftLeft, stride * .10, .38, .17, .45), color: ART.faction.equipment },
    { geometry: block(.27, .085 + liftRight, -stride * .10, .38, .17, .45), color: ART.faction.equipment },
  ]);
}

export function createChibiGiantFamily(): GiantVisualFamily & { dispose(): void } {
  const idle = giantPose(0), runs = [giantPose(1, .02), giantPose(.2, .035, .005),
    giantPose(-1, 0, .02), giantPose(-.2, .005, .035)], death = gray(idle);
  const helmetGeometry = merge([
    { geometry: new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(.405, .255, .355).translate(0, .97, 0), color: THREAT_COLORS.helmet },
    { geometry: band(.96, .425, .37, .065), color: THREAT_COLORS.ochre },
    // One broad longitudinal fin, no spikes or little fittings.
    { geometry: block(0, 1.21, 0, .11, .29, .47), color: THREAT_COLORS.ochre },
  ]);
  const armorGeometry = merge([{ geometry: ball(0, .48, .265, .31, .245, .08, 12, 6), color: THREAT_COLORS.ochre }]);
  // Weapon authored in character space; the renderer adds only small delayed rotation.
  const weaponGeometry = merge([
    { geometry: new THREE.CylinderGeometry(.044, .055, .64, 8).translate(.60, .42, .08), color: ART.faction.weapon },
    { geometry: block(.60, .77, .08, .44, .30, .34), color: THREAT_COLORS.helmet },
    { geometry: block(.60, .77, .08, .11, .32, .36), color: THREAT_COLORS.ochre },
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
