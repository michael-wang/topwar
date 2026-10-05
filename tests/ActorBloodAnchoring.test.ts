import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { hitBloodVariation, HIT_BLOOD_ANCHORS } from '../src/rendering/enemies/HitBloodVariation';

it('pins each surviving splash to a real local surface point through recoil, lean and nonuniform scale', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
    const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, families);
    const enemy = { id: 9, tier: 1, archetype: role, hp: 20, x: .6, z: 13,
      visualScaleX: 1.4, visualScaleY: 1.1, visualScaleZ: .9 };
    renderer.update([enemy], 0); renderer.update([enemy], 2000);
    const blood = scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh;
    const bodyMatrix = new THREE.Matrix4(), burstMatrix = new THREE.Matrix4();
    for (let sequence = 1; sequence <= HIT_BLOOD_ANCHORS[role].length; sequence++) {
      const start = 2000 + sequence * 300, struck = { ...enemy, hp: 20 - sequence };
      for (const age of [0, 20, 70, 120]) {
        renderer.update([struck], start + age);
        if (role === 'giant') {
          const body = scene.getObjectByName('giant-body')!; body.updateWorldMatrix(true, false); bodyMatrix.copy(body.matrixWorld);
        } else {
          const mesh = scene.children.find(o => o instanceof THREE.InstancedMesh && o.count > 0 && families[role].runFrames.some(f => f.geometry === o.geometry)) as THREE.InstancedMesh;
          mesh.getMatrixAt(0, bodyMatrix);
        }
        const expected = new THREE.Vector3().fromArray(hitBloodVariation(enemy.id, sequence, role).localAnchor).applyMatrix4(bodyMatrix);
        expect(blood.count).toBe(1); blood.getMatrixAt(0, burstMatrix);
        expect(new THREE.Vector3().setFromMatrixPosition(burstMatrix).distanceTo(expected)).toBeLessThan(.00001);
        expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(0);
      }
    }
    expect(enemy.hp).toBe(20); expect(enemy.z).toBe(13);
    renderer.dispose(); Object.values(families).forEach(f => f.dispose()); expect(scene.children).toHaveLength(0);
  }
});
