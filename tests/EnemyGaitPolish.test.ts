import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily, THREAT_COLORS } from '../src/rendering/enemies/ChibiThreatFamilies';
import { stepWeightPose } from '../src/presentation/CharacterMotion';

function region(geometry: THREE.BufferGeometry, color: string, side?: number): THREE.Box3 {
  const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
  const target = new THREE.Color(color), bounds = new THREE.Box3();
  for (let i = 0; i < positions.count; i++) {
    const c = new THREE.Color().fromBufferAttribute(colors, i);
    if (Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) > .00001) continue;
    if (side !== undefined && positions.getX(i) * side <= 0) continue;
    bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i));
  }
  return bounds;
}

it('alternates a grounded support shoe and visibly lifted outward swing shoe without adding pose resources', () => {
  for (const [create, cycle, lift] of [[createChibiGruntFamily, 360, .11],
    [createChibiHeavyFamily, 650, .09], [createChibiGiantFamily, 850, .085]] as const) {
    const family = create();
    expect(family.runFrames).toHaveLength(4);
    for (const [index, side] of [[0, 1], [2, -1]]) {
      const shoe = region(family.runFrames[index].geometry, ART.faction.shoes, side);
      const support = region(family.runFrames[index].geometry, ART.faction.shoes, -side);
      expect(shoe.min.y - support.min.y).toBeCloseTo(lift);
      expect(support.min.y).toBeCloseTo(0);
      const idle = region(family.body.geometry, ART.faction.shoes, side);
      expect(Math.abs(shoe.getCenter(new THREE.Vector3()).x)).toBeGreaterThan(Math.abs(idle.getCenter(new THREE.Vector3()).x));
    }
    expect(stepWeightPose(0, 0, cycle).support).toBeCloseTo(1);
    expect(stepWeightPose(0, cycle / 2, cycle).support).toBeCloseTo(-1);
    expect(stepWeightPose(0, cycle / 4, cycle).landing).toBeCloseTo(1);
    expect(stepWeightPose(1, 0, cycle)).not.toEqual(stepWeightPose(0, 0, cycle));
    family.dispose();
  }
});

it('keeps Heavy free of stone accents and secondary gear while keeping enlarged eyes clear below its rim', () => {
  const family = createChibiHeavyFamily();
  expect(family.vest.visible).toBe(false);
  expect(family.vest.geometry.getAttribute('position').count).toBe(0);
  for (const mesh of [family.body, ...family.runFrames, family.helmet, family.contact.body])
    expect(region(mesh.geometry, THREAT_COLORS.stone).isEmpty()).toBe(true);
  const eyes = region(family.body.geometry, ART.faction.weapon);
  expect(eyes.isEmpty()).toBe(false);
  expect(eyes.getSize(new THREE.Vector3()).y).toBeGreaterThan(.05);
  expect(eyes.max.y).toBeLessThan(family.helmet.geometry.boundingBox!.min.y);
  expect(eyes.min.z).toBeGreaterThan(.24);
  expect(family.contact.vest.visible).toBe(false); expect(family.death.vest.visible).toBe(false);
  family.dispose();
});

it('gives Giant one 50% wider crest and a shallow high chest slab instead of an oval belly', () => {
  const family = createChibiGiantFamily(), crest = new THREE.Box3();
  const p = family.helmet.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 1.23)
    crest.expandByPoint(new THREE.Vector3().fromBufferAttribute(p, i));
  expect(crest.getSize(new THREE.Vector3()).x).toBeCloseTo(.11 * 1.5);
  expect(crest.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
  const plate = family.vest.geometry.boundingBox!, size = plate.getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(.62); expect(size.y).toBeCloseTo(.36); expect(size.z).toBeCloseTo(.12);
  expect(plate.getCenter(new THREE.Vector3()).y).toBeCloseTo(.56);
  expect(plate.min.y).toBeGreaterThan(.33);
  family.dispose();
});
