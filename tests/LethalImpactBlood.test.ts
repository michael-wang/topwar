import * as THREE from 'three';
import { expect, it } from 'vitest';
import { gruntDeathBody } from '../src/presentation/GruntDeathBody';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { GRUNT_LETHAL_CONTACT, lethalContactOwner } from '../src/rendering/enemies/LethalImpactBlood';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ENEMY_DEATH_TIMING, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';

it('captures one bounded non-following Grunt contact before fluid release and leaves stains to death contact', () => {
  const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
  const scene = new THREE.Scene(), r = new EnemyRenderer(scene, families);
  const e = { id: 12, tier: 1, archetype: 'grunt' as const, hp: 1, maxHp: 1, x: .2, z: 8 };
  r.update([e], 0, true); r.update([e], 2000, true); r.update([], 2010, true);
  const hit = scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh;
  const ribbons = scene.getObjectByName('enemy-blood-ribbons-grunt') as THREE.InstancedMesh;
  const stains = scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  expect(hit.count).toBe(1); expect(hit.instanceMatrix.count).toBe(128);
  const slots = (r as unknown as { hitBlood: { slots: { owner: number; attached: boolean; origin: THREE.Vector3 }[] } }).hitBlood.slots;
  const contact = slots.find(s => s.owner === lethalContactOwner(e.id))!;
  expect(contact.attached).toBe(false); const origin = contact.origin.clone();
  expect(origin.y).toBeGreaterThan(.2); expect(origin.z).toBeLessThan(e.z);
  expect(GRUNT_LETHAL_CONTACT.bloodScale).toBe(.25);
  expect(GRUNT_LETHAL_CONTACT.bloodEndMs).toBe(100);
  for (const age of [25, 50, 75, 99]) {
    r.update([], 2010 + age, true); expect(hit.count).toBe(1);
    const matrix = new THREE.Matrix4(); hit.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(origin)).toBeLessThan(.00001);
    expect(ribbons.count).toBe(0); expect(stains.count).toBe(0);
  }
  r.update([], 2110, true); expect(hit.count).toBe(0);
  r.update([], 2140, true); expect(ribbons.count).toBe(1); expect(stains.count).toBe(0);
  r.update([], 2530, true); expect(stains.count).toBe(1);
  r.reset(); expect(stains.count).toBe(0); expect(hit.count).toBe(0);
  expect(e.hp).toBe(1); r.dispose(); Object.values(families).forEach(f => f.dispose());
});

it('fades every role body, helmet and gear smoothly to zero on unchanged clocks, including the Giant maul', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
    const scene = new THREE.Scene(), r = new EnemyRenderer(scene, families), timing = ENEMY_DEATH_TIMING[role];
    const e = { id: 12, tier: 1, archetype: role, hp: 1, x: 0, z: 8 };
    r.update([e], 0, true); r.update([e], 2000, true); r.update([], 2010, true);
    const group = scene.getObjectByName(role === 'giant' ? 'giant-assault-soldier' : 'enemy-pale-death-body')!;
    let previous = 1;
    for (const age of [0, timing.fadeStartMs, timing.fadeStartMs + 10, (timing.fadeStartMs + timing.totalMs) / 2, timing.totalMs - 10, timing.totalMs - 1]) {
      r.update([], 2010 + age, true); const opacity = role==='grunt'?gruntDeathBody(age).opacity:enemyDeathPose(age, ENEMY_DEATH_TIMING[role]).bodyOpacity;
      expect(group.visible).toBe(true); expect(opacity).toBeLessThanOrEqual(previous); previous = opacity;
      group.traverse(o => { if (o instanceof THREE.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) expect(m.opacity).toBeCloseTo(opacity, 8);
      }});
      if (role !== 'grunt') expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(0);
    }
    expect(previous).toBeLessThan(.0001);
    r.update([], 2010 + timing.totalMs, true); expect(group.visible).toBe(false);
    expect(role==='grunt'?gruntDeathBody(timing.totalMs).opacity:enemyDeathPose(timing.totalMs, ENEMY_DEATH_TIMING[role]).bodyOpacity).toBe(0);
    group.traverse(o => { if (o instanceof THREE.Mesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) expect(m.opacity).toBe(0);
    }});
    r.dispose(); Object.values(families).forEach(f => f.dispose());
  }
});
