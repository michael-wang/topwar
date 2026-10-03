import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily, THREAT_COLORS } from '../src/rendering/enemies/ChibiThreatFamilies';
import { stepWeightPose } from '../src/presentation/CharacterMotion';

function region(geometry: THREE.BufferGeometry, color: string | string[], side?: number): THREE.Box3 {
  const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  const targets = (Array.isArray(color) ? color : [color]).map(c => new THREE.Color(c)), bounds = new THREE.Box3();
  for (let i = 0; i < positions.count; i++) {
    const c = new THREE.Color().fromBufferAttribute(colors, i);
    if (!targets.some(target => Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) < .00001)) continue;
    if (side !== undefined && positions.getX(i) * side <= 0) continue;
    bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i));
  }
  return bounds;
}

it('alternates a grounded support shoe and visibly lifted outward swing shoe without adding pose resources', () => {
  for (const [create, cycle, lift] of [[createChibiGruntFamily, 360, .11],
    [createChibiHeavyFamily, 650, .09], [createChibiGiantFamily, 850, .085]] as const) {
    const family = create();
    const shoes = [ART.footwear.enemyUpper, ART.footwear.enemySole];
    expect(family.runFrames).toHaveLength(4);
    for (const [index, side] of [[0, 1], [2, -1]]) {
      const shoe = region(family.runFrames[index].geometry, shoes, side);
      const support = region(family.runFrames[index].geometry, shoes, -side);
      expect(shoe.min.y - support.min.y).toBeCloseTo(lift);
      expect(support.min.y).toBeCloseTo(0);
      const idle = region(family.body.geometry, shoes, side);
      expect(Math.abs(shoe.getCenter(new THREE.Vector3()).x)).toBeGreaterThan(Math.abs(idle.getCenter(new THREE.Vector3()).x));
    }
    expect(stepWeightPose(0, 0, cycle).support).toBeCloseTo(1);
    expect(stepWeightPose(0, cycle / 2, cycle).support).toBeCloseTo(-1);
    expect(stepWeightPose(0, cycle / 4, cycle).landing).toBeCloseTo(1);
    expect(stepWeightPose(1, 0, cycle)).not.toEqual(stepWeightPose(0, 0, cycle));
    family.dispose();
  }
});

it('keeps Heavy free of stone accents and secondary gear with clear eyes inside its deep shell', () => {
  const family = createChibiHeavyFamily();
  expect(family.vest.visible).toBe(false);
  expect(family.vest.geometry.getAttribute('position').count).toBe(0);
  for (const mesh of [family.body, ...family.runFrames, family.helmet, family.contact.body])
    expect(region(mesh.geometry, THREAT_COLORS.stone).isEmpty()).toBe(true);
  const eyes = region(family.body.geometry, ART.faction.weapon);
  expect(eyes.isEmpty()).toBe(false);
  expect(eyes.getSize(new THREE.Vector3()).y).toBeGreaterThan(.05);
  expect(eyes.min.z).toBeGreaterThan(.24);
  const helmet = family.helmet.geometry.boundingBox!;
  expect(helmet.max.y).toBeCloseTo(.99);
  expect(helmet.getSize(new THREE.Vector3()).z).toBeGreaterThan(.70);
  // Cheek and rear protection deliberately drop below the front opening.
  const positions = family.helmet.geometry.getAttribute('position');
  let front = Infinity, side = Infinity, rear = Infinity;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (Math.abs(x) < .03 && z > .2) front = Math.min(front, y);
    if (Math.abs(x) > .3 && Math.abs(z) < .03) side = Math.min(side, y);
    if (Math.abs(x) < .03 && z < -.2) rear = Math.min(rear, y);
  }
  expect(front).toBeGreaterThan(eyes.max.y + .1);
  expect(side).toBeLessThan(front - .1); expect(rear).toBeLessThan(side);
  const mesh = new THREE.Mesh(family.helmet.geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  for (const x of [-.095,.095]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x,.655,1), new THREE.Vector3(0,0,-1));
    // No shell blocks a straight frontal eye sightline.
    expect(ray.intersectObject(mesh).filter(hit=>hit.point.z>.264).length).toBe(0);
  }
  (mesh.material as THREE.Material).dispose();
  expect(family.contact.vest.visible).toBe(false); expect(family.death.vest.visible).toBe(false);
  const frontSurface = new THREE.Raycaster(new THREE.Vector3(0,.90,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
  expect(frontSurface.length).toBeGreaterThan(0);
  expect(frontSurface[0].face!.normal.z).toBeGreaterThan(0);
  family.dispose();
});

it('gives Giant one rounded broad crest and an uninterrupted body with no chest geometry', () => {
  const family = createChibiGiantFamily(), crest = new THREE.Box3();
  const p = family.helmet.geometry.getAttribute('position'), colors = family.helmet.geometry.getAttribute('color');
  const stone = new THREE.Color(THREAT_COLORS.stone);
  for (let i = 0; i < p.count; i++) {
    const c = new THREE.Color().fromBufferAttribute(colors,i);
    if (Math.abs(c.r-stone.r)+Math.abs(c.g-stone.g)+Math.abs(c.b-stone.b)<.00001)
      crest.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  }
  expect(crest.getSize(new THREE.Vector3()).x).toBeCloseTo(.18);
  expect(crest.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
  expect(crest.max.y).toBeCloseTo(1.355);
  expect(family.vest.visible).toBe(false);
  expect(family.vest.geometry.getAttribute('position').count).toBe(0);
  expect(family.contact.vest.visible).toBe(false);
  family.dispose();
});
