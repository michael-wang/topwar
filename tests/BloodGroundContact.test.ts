import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
import { GroundBloodStains, groundBloodAtlas, BLOOD_STAIN_GROW_MS } from '../src/rendering/enemies/BloodSplat';
import { IntegratedDeathBlood, BLOOD_PIECE_COUNTS, BLOOD_RELEASE_MS, writeBloodFlight } from '../src/rendering/enemies/IntegratedDeathBlood';

it('uses deterministic analytic contacts, reveals internal blood first, and hands off into a growing persistent stain', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const scene = new THREE.Scene(), texture = groundBloodAtlas(), stains = new GroundBloodStains(scene, texture);
    const blood = new IntegratedDeathBlood(scene, stains), timing = ENEMY_DEATH_TIMING[role];
    const scale = role === 'giant' ? 2.66 : role === 'heavy' ? 1.89 : 1.4;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(.2, 0, 8),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-.11, .05, 0)), new THREE.Vector3(scale, scale * .8, scale));
    const stainMesh = scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
    const growth = stainMesh.geometry.getAttribute('stainGrowth');
    const slots = (blood as unknown as { slots: { variant: number; jitter:number; gravity: number; contactAgeMs: number; endAgeMs: number }[] }).slots;
    for (let id = 0; id < 3; id++) {
      blood.reset(); stains.reset(); blood.spawn(id, role, 1000, matrix, .2, 8);
      const slot = slots[0], a = new Float64Array(11), b = new Float64Array(11);
      for (let piece = 0; piece < BLOOD_PIECE_COUNTS[role]; piece++) {
        writeBloodFlight(role, slot.variant, piece, matrix, slot.gravity, a,slot.jitter);
        writeBloodFlight(role, slot.variant, piece, matrix, slot.gravity, b,slot.jitter);
        expect(a).toEqual(b);
        expect(a[1] + a[4] * a[5] - .5 * slot.gravity * a[5] ** 2).toBeCloseTo(a[3]);
        expect(a[3]).toBeGreaterThan(.025); expect(a[6]).toBeCloseTo(a[0] + a[8] * a[5]); expect(a[7]).toBeCloseTo(a[2] + a[10] * a[5]);
      }
      expect(slot.contactAgeMs).toBeGreaterThan(BLOOD_RELEASE_MS[role]);
      expect(slot.endAgeMs).toBeLessThanOrEqual(timing.totalMs);
      blood.update(1000 + slot.contactAgeMs - .01); expect(stainMesh.count).toBe(0);
      blood.update(1000 + slot.contactAgeMs); expect(stainMesh.count).toBe(1); expect(growth.getX(0)).toBeCloseTo(.3);
      stains.update(1000 + slot.contactAgeMs + BLOOD_STAIN_GROW_MS / 2); expect(growth.getX(0)).toBeCloseTo(.65);
      stains.update(1000 + slot.contactAgeMs + BLOOD_STAIN_GROW_MS); expect(growth.getX(0)).toBe(1);
      blood.update(1000 + timing.totalMs); expect((scene.getObjectByName(`enemy-3d-blood-${role}`) as THREE.InstancedMesh).count).toBe(0);
      blood.update(100000); expect(stainMesh.count).toBe(1);
    }
    blood.reset(); stains.reset(); expect(stainMesh.count).toBe(0);
    blood.dispose(); stains.dispose(); texture.dispose(); expect(scene.children).toHaveLength(0);
  }
});

it('keeps dense blood bounded and creates one stain per contact without allocating new scene hierarchies', () => {
  const scene = new THREE.Scene(), texture = groundBloodAtlas(), stains = new GroundBloodStains(scene, texture);
  const blood = new IntegratedDeathBlood(scene, stains), matrix = new THREE.Matrix4().makeScale(1.4, 1.12, 1.4);
  const count = scene.children.length;
  for (const kills of [8, 24, 48]) {
    blood.reset(); stains.reset();
    for (let id = 0; id < kills; id++) blood.spawn(id, 'grunt', 0, matrix);
    blood.update(200); expect((scene.getObjectByName('enemy-3d-blood-grunt') as THREE.InstancedMesh).count).toBe(kills);
    expect(scene.children).toHaveLength(count);
    blood.update(520); expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(kills);
    blood.update(10000); expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(kills);
  }
  blood.dispose(); stains.dispose(); texture.dispose();
});
