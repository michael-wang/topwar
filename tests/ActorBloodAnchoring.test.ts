import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { hitBloodVariation, HIT_BLOOD_ANCHORS } from '../src/rendering/enemies/HitBloodVariation';
import { lethalBloodVariation } from '../src/rendering/enemies/LethalBloodVariation';
import { lethalUpperMatrix } from '../src/rendering/enemies/LethalReaction';
import { ENEMY_DEATH_TIMING, ENEMY_REACTION_TIMING, enemyReactionStage } from '../src/presentation/EnemyDeathTiming';

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
      for (const age of [0, 20, 70, 150]) {
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

it('keeps lethal emission on the captured body throughout both authored reaction stages', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
    const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, families);
    const enemy = { id: 9, tier: 1, archetype: role, hp: 1, x: .6, z: 13, visualScale: 1.5 };
    renderer.update([enemy], 0); renderer.update([enemy], 2000); renderer.update([], 2010);
    const group = scene.getObjectByName(role === 'giant' ? 'giant-assault-soldier' : 'enemy-pale-death-body')!;
    const frozen = group.matrix.clone(), matrix = new THREE.Matrix4(), blood = scene.getObjectByName('enemy-blood-splats') as THREE.InstancedMesh;
    const local = new THREE.Vector3().fromArray(lethalBloodVariation(enemy.id, role).localAnchor), reaction = families[role].lethalReaction!;
    for (const age of [ENEMY_DEATH_TIMING[role].bloodStartMs + 1, ENEMY_REACTION_TIMING[role].startMs, ENEMY_REACTION_TIMING[role].endMs, ENEMY_DEATH_TIMING[role].fadeStartMs]) {
      renderer.update([], 2010 + age); group.updateMatrixWorld(true);
      const stage = enemyReactionStage(age, role), point = local.clone();
      if (stage) point.applyMatrix4(lethalUpperMatrix(stage / 2, reaction.sink, reaction.tilt));
      point.applyMatrix4(group.matrixWorld); blood.getMatrixAt(0, matrix);
      expect(blood.count).toBe(1); expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(point)).toBeLessThan(.00001);
      expect(group.matrix).toEqual(frozen);
    }
    renderer.dispose(); Object.values(families).forEach(f => f.dispose());
  }
});
