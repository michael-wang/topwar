import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyRenderer, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
import type { EnemyRenderState } from '../src/rendering/RenderState';

const grunt = (id: number): EnemyRenderState => ({ id, tier: 1, x: 1, z: id, hp: 3 });
const brute = (id: number): EnemyRenderState => ({ id, tier: 2, x: -1, z: id, hp: 300 });
const tier3 = (id: number): EnemyRenderState => ({ id, tier: 3, x: 0, z: id, hp: 3000 });
const meshes = (scene: THREE.Scene) => scene.children.filter(
  (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
const named = (scene: THREE.Scene, name: string) => meshes(scene).find((mesh) => mesh.name === name)!;

describe('EnemyRenderer instanced humanoids', () => {
  it('keeps six shared instanced parts per tier at one scale and grows capacity', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    expect(meshes(scene)).toHaveLength(36);
    renderer.update([grunt(1), brute(2), tier3(3)], 0);
    const gruntMatrix = new THREE.Matrix4();
    const bruteMatrix = new THREE.Matrix4();
    named(scene, '0-torso').getMatrixAt(0, gruntMatrix);
    named(scene, '1-torso').getMatrixAt(0, bruteMatrix);
    expect(bruteMatrix.elements[0]).toBeCloseTo(1);
    expect(gruntMatrix.elements[0]).toBeCloseTo(1);
    const tier3Matrix = new THREE.Matrix4();
    named(scene, '2-torso').getMatrixAt(0, tier3Matrix);
    expect(tier3Matrix.elements[0]).toBeCloseTo(1);
    const bruteColor = new THREE.Color();
    named(scene, '1-torso').getColorAt(0, bruteColor);
    expect(bruteColor.getHexString()).toBe('cf4037');
    named(scene, '2-torso').getColorAt(0, bruteColor);
    expect(bruteColor.getHexString()).toBe('d72f82');
    for (const tier of ['0', '1', '2']) {
      for (const part of ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
        expect(named(scene, `${tier}-${part}`).count).toBe(1);
      }
    }
    const many = Array.from({ length: 900 }, (_, index) => brute(index + 1));
    const oldBruteLeg = named(scene, '1-leftLeg');
    const disposeOldBruteLeg = vi.spyOn(oldBruteLeg, 'dispose');
    renderer.update(many, 100);
    expect(disposeOldBruteLeg).toHaveBeenCalledOnce();
    expect(meshes(scene)).toHaveLength(36);
    expect(named(scene, '1-leftLeg').count).toBe(900);
    expect(named(scene, '1-leftLeg').instanceMatrix.count).toBeGreaterThanOrEqual(900);
    expect(named(scene, '0-torso').count).toBe(0);
    const manyTier3 = Array.from({ length: 900 }, (_, index) => tier3(index + 1));
    const oldTier3Leg = named(scene, '2-leftLeg');
    const disposeOldTier3Leg = vi.spyOn(oldTier3Leg, 'dispose');
    renderer.update(manyTier3, 200);
    expect(disposeOldTier3Leg).toHaveBeenCalledOnce();
    expect(named(scene, '2-leftLeg').count).toBe(900);
    expect(named(scene, '2-leftLeg').instanceMatrix.count).toBeGreaterThanOrEqual(900);
    expect(named(scene, '1-torso').count).toBe(0);
    const currentLeg = named(scene, '1-leftLeg');
    const disposeCurrentLeg = vi.spyOn(currentLeg, 'dispose');
    const disposeGeometry = vi.spyOn(currentLeg.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(currentLeg.material as THREE.Material, 'dispose');
    renderer.dispose();
    expect(disposeCurrentLeg).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });

  it('swings opposite limbs toward the player without moving enemy anchors', () => {
    const pose = enemyWalkPose(7, 100);
    expect(pose.leftArm).toBeCloseTo(-pose.rightArm);
    expect(pose.leftLeg).toBeCloseTo(-pose.rightLeg);
    expect(pose.leftArm).toBeCloseTo(-pose.leftLeg * 0.45 / 0.40);
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    renderer.update([grunt(7)], 100);
    const matrixA = new THREE.Matrix4();
    const matrixB = new THREE.Matrix4();
    named(scene, '0-leftArm').getMatrixAt(0, matrixA);
    named(scene, '0-rightArm').getMatrixAt(0, matrixB);
    expect(matrixA.elements[6]).toBeCloseTo(-matrixB.elements[6]);
    const firstSwing = matrixA.elements[6];
    const torso = new THREE.Matrix4();
    named(scene, '0-torso').getMatrixAt(0, torso);
    expect(torso.elements[12]).toBe(-1);
    expect(torso.elements[14]).toBe(7);
    named(scene, '0-head').getMatrixAt(0, matrixA);
    expect(matrixA.elements[14]).toBeLessThan(7); // Face protrudes toward the player (-Z).
    renderer.update([grunt(7)], 300);
    named(scene, '0-leftArm').getMatrixAt(0, matrixA);
    expect(matrixA.elements[6]).not.toBeCloseTo(firstSwing);
    named(scene, '0-torso').getMatrixAt(0, torso);
    expect(torso.elements[12]).toBe(-1);
    expect(torso.elements[14]).toBe(7);
    renderer.dispose();
  });

  it('flashes every body part on damage and restores red afterward', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    const color = new THREE.Color();
    renderer.update([grunt(1), brute(2)], 1000);
    renderer.update([{ ...grunt(1), hp: 2 }, brute(2)], 1001);
    for (const part of ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
      named(scene, `0-${part}`).getColorAt(0, color);
      expect(color.getHexString()).toBe(part === 'head' ? 'fff8d6' : 'ffe36e');
    }
    named(scene, '1-torso').getColorAt(0, color);
    expect(color.getHexString()).toBe('cf4037');
    renderer.update([{ ...grunt(1), hp: 2 }, brute(2)], 1082);
    named(scene, '0-leftLeg').getColorAt(0, color);
    expect(color.getHexString()).toBe('9b6863');
    renderer.dispose();
  });

  it('flashes the whole Tier-3 humanoid and restores its magenta colors', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    const color = new THREE.Color();
    renderer.update([tier3(1)], 1000);
    renderer.update([{ ...tier3(1), hp: 2700 }], 1001);
    for (const part of ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
      named(scene, `2-${part}`).getColorAt(0, color);
      expect(color.getHexString()).toBe(part === 'head' ? 'fff8d6' : 'ffe36e');
    }
    renderer.update([{ ...tier3(1), hp: 2700 }], 1082);
    named(scene, '2-torso').getColorAt(0, color);
    expect(color.getHexString()).toBe('d72f82');
    named(scene, '2-head').getColorAt(0, color);
    expect(color.getHexString()).toBe('ff69b3');
    renderer.dispose();
  });

  it('uses rigid gray humanoid death visuals with backward knockback and a 48 pool cap', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    renderer.update([grunt(1), brute(2), tier3(3)], 0);
    renderer.update([], 1);
    const deaths = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(deaths).toHaveLength(3);
    expect(deaths[0].children).toHaveLength(6);
    expect(deaths[0].scale.x).toBeGreaterThan(1);
    expect(deaths[1].scale.x).toBe(deaths[0].scale.x);
    expect(deaths[2].scale.x).toBe(deaths[0].scale.x);
    const grayMaterial = (deaths[0].children[0] as THREE.Mesh).material as THREE.Material;
    const disposeGray = vi.spyOn(grayMaterial, 'dispose');
    renderer.update([], 225);
    expect(deaths[0].scale.x).toBe(1);
    expect(deaths[1].scale.x).toBe(1);
    expect(deaths[2].scale.x).toBe(1);
    expect(deaths[0].rotation.x).toBeGreaterThan(1);
    expect(deaths[0].position.z).toBeGreaterThan(1);
    expect(deaths[0].position.y).toBeGreaterThan(0);
    renderer.update([], 500);
    renderer.update(Array.from({ length: 60 }, (_, index) => grunt(index + 1)), 600);
    renderer.update([], 601);
    expect(scene.children.filter((child) => child instanceof THREE.Group)).toHaveLength(48);
    renderer.reset();
    expect(deaths.every((death) => !death.visible)).toBe(true);
    renderer.dispose();
    expect(disposeGray).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
