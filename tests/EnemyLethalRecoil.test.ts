import * as THREE from 'three';
import { expect, it } from 'vitest';
import { LETHAL_RECOIL, lethalRecoilPose, writeLethalDirection, writeLethalRecoil, LETHAL_FOOT_PIVOT_Y } from '../src/rendering/enemies/EnemyLethalRecoil';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';

function closeMatrix(a: THREE.Matrix4, b: THREE.Matrix4) { a.elements.forEach((v, i) => expect(v).toBeCloseTo(b.elements[i], 5)); }
it('has role-weighted force, an away direction, a low pivot and a held peak without scale/physics', () => {
  const roles = ['grunt', 'heavy', 'giant'] as const;
  expect(roles.map(r => LETHAL_RECOIL[r].distance)).toEqual([.19, .15, .10]);
  expect(roles.map(r => LETHAL_RECOIL[r].angleDegrees)).toEqual([32, 26, 16]);
  const captured = new THREE.Matrix4().compose(new THREE.Vector3(.5, .01, 8),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12, Math.PI, .04)), new THREE.Vector3(1.4, 1.12, 1.4));
  const direction = new THREE.Vector2(); writeLethalDirection(direction, captured);
  expect(direction.toArray()).toEqual([0, 1]); writeLethalDirection(direction, captured, -.5, 0);
  expect(direction.x).toBeGreaterThan(0); expect(direction.y).toBeGreaterThan(.9);
  for (const role of roles) {
    const matrix = new THREE.Matrix4(); writeLethalRecoil(matrix, captured, 0, role, direction.x, direction.y);
    expect(matrix.equals(captured)).toBe(true);
    let distance = 0, angle = 0;
    for (let age = 0; age <= ENEMY_DEATH_TIMING[role].totalMs; age += 10) {
      const p = lethalRecoilPose(age, role); expect(p.distance).toBeGreaterThanOrEqual(distance); expect(p.angle).toBeGreaterThanOrEqual(angle); distance = p.distance; angle = p.angle;
    }
    writeLethalRecoil(matrix, captured, LETHAL_RECOIL[role].peakMs, role, direction.x, direction.y);
    const pivot = new THREE.Vector3(.5, .01 + LETHAL_FOOT_PIVOT_Y, 8), local = pivot.clone().applyMatrix4(captured.clone().invert());
    const displaced = local.applyMatrix4(matrix).sub(pivot);
    expect(displaced.y).toBeCloseTo(0); expect(displaced.x).toBeCloseTo(direction.x * LETHAL_RECOIL[role].distance); expect(displaced.z).toBeCloseTo(direction.y * LETHAL_RECOIL[role].distance);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix); expect(scale.x).toBeCloseTo(1.4); expect(scale.y).toBeCloseTo(1.12); expect(scale.z).toBeCloseTo(1.4);
    const held = new THREE.Matrix4(); writeLethalRecoil(held, captured, ENEMY_DEATH_TIMING[role].totalMs, role, direction.x, direction.y); closeMatrix(held, matrix);
  }
});
it('shares the tipped root with body, fluid ribbon and detached ballistic release while leaving enemy state untouched', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
    const scene = new THREE.Scene(), r = new EnemyRenderer(scene, families), enemy = { id: 5, archetype: role, tier: 1, hp: 1, x: .4, z: 8, visualScale: 1.8 };
    r.update([enemy], 0, true, 0, 0); r.update([enemy], 2000, true, 0, 0); r.update([], 2010, true, 0, 0);
    const group = scene.getObjectByName(role === 'giant' ? 'giant-assault-soldier' : 'enemy-pale-death-body')!, captured = group.matrix.clone();
    const direction = new THREE.Vector2(); writeLethalDirection(direction, captured, 0, 0);
    const age = ENEMY_DEATH_TIMING[role].breakupStartMs + 10;
    r.update([], 2010 + age, true, 0, 0);
    const expected = new THREE.Matrix4(); writeLethalRecoil(expected, captured, age, role, direction.x, direction.y); closeMatrix(group.matrix, expected);
    const ribbons = scene.getObjectByName(`enemy-blood-ribbons-${role}`) as THREE.InstancedMesh, matrix = new THREE.Matrix4(); ribbons.getMatrixAt(0, matrix); closeMatrix(matrix, expected);
    r.update([], 2010 + LETHAL_RECOIL[role].peakMs + 300, true, 0, 0);
    const slots = (r as unknown as { blood: { slots: { startedAt: number; matrix: THREE.Matrix4 }[] } }).blood.slots;
    closeMatrix(slots.find(s => Number.isFinite(s.startedAt))!.matrix, group.matrix);
    expect(enemy).toEqual({ id: 5, archetype: role, tier: 1, hp: 1, x: .4, z: 8, visualScale: 1.8 });
    r.dispose(); Object.values(families).forEach(f => f.dispose()); expect(scene.children).toHaveLength(0);
  }
});
