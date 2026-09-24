import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import type { EnemyRenderState } from '../src/rendering/RenderState';

const enemies: EnemyRenderState[] = Array.from({ length: 240 }, (_, index) => ({
  id: index + 1, type: 'grunt', x: index === 0 ? 1 : 0, z: index, hp: 3,
}));

const activeMeshes = (scene: THREE.Scene): THREE.InstancedMesh[] =>
  scene.children.filter((child): child is THREE.InstancedMesh => (child as THREE.InstancedMesh).isInstancedMesh);

describe('EnemyRenderer instancing', () => {
  it('flashes only damaged instances and restores normal colors after 80ms', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    const pair: EnemyRenderState[] = [enemies[0], { id: 500, type: 'brute', x: 0, z: 5, hp: 300 }];
    const color = new THREE.Color();
    renderer.update(pair, 1000);
    const [gruntBody, , bruteBody] = activeMeshes(scene);
    gruntBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('c93332');
    renderer.update([{ ...pair[0], hp: 2 }, pair[1]], 1001);
    gruntBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('ffe36e');
    bruteBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('761a22');
    renderer.update([{ ...pair[0], hp: 2 }, pair[1]], 1050);
    gruntBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('ffe36e');
    renderer.update([{ ...pair[0], hp: 2 }, { ...pair[1], hp: 299 }], 1082);
    gruntBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('c93332');
    bruteBody.getColorAt(0, color);
    expect(color.getHexString()).toBe('ffe36e');
    renderer.dispose();
  });

  it('reuses gray flip bodies, scales brutes, and caps the death pool at 48', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    const pair: EnemyRenderState[] = [enemies[0], { id: 500, type: 'brute', x: 0, z: 5, hp: 300 }];
    renderer.update(pair, 0);
    renderer.update([], 1);
    const deaths = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(deaths).toHaveLength(2);
    expect(deaths[0].scale.x).toBe(1);
    expect(deaths[1].scale.x).toBe(1.9);
    expect((deaths[0].children[0] as THREE.Mesh).material).toBe((deaths[1].children[0] as THREE.Mesh).material);
    renderer.update([], 225);
    expect(deaths[0].rotation.x).toBeLessThan(-1);
    expect(deaths[0].position.y).toBeGreaterThan(0);
    renderer.update([], 500);
    expect(deaths.every((death) => !death.visible)).toBe(true);
    renderer.update(enemies.slice(0, 60), 600);
    renderer.update([], 601);
    expect(scene.children.filter((child) => child instanceof THREE.Group)).toHaveLength(48);
    const grayMaterial = (deaths[0].children[0] as THREE.Mesh).material as THREE.Material;
    const disposeGray = vi.spyOn(grayMaterial, 'dispose');
    renderer.reset();
    expect(deaths.every((death) => !death.visible)).toBe(true);
    renderer.dispose();
    expect(disposeGray).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });

  it('reuses separate meshes as all-grunt and all-brute crowds alternate', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    renderer.update(enemies.slice(0, 7));
    expect(activeMeshes(scene).map((mesh) => mesh.count)).toEqual([0, 0, 7, 7]);
    const brutes: EnemyRenderState[] = Array.from({ length: 900 }, (_, index) =>
      ({ id: index + 1, type: 'brute', x: index % 7, z: index, hp: 300 }));
    renderer.update(brutes);
    const meshes = activeMeshes(scene);
    expect(meshes.map((mesh) => mesh.count)).toEqual([0, 0, 900, 900]);
    expect(meshes[2].instanceMatrix.count).toBeGreaterThanOrEqual(900);
    renderer.update([...enemies.slice(0, 6), brutes[0]]);
    expect(activeMeshes(scene)).toEqual(meshes);
    expect(meshes.map((mesh) => mesh.count)).toEqual([6, 6, 1, 1]);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps grunt and brute instances separate and disposes replaced and final resources', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    expect(scene.children).toHaveLength(4);
    const initial = scene.children as THREE.InstancedMesh[];
    const oldBodyDispose = vi.spyOn(initial[0], 'dispose');
    const oldHeadDispose = vi.spyOn(initial[1], 'dispose');

    renderer.update([...enemies, { id: 241, type: 'brute', x: -1, z: 5, hp: 300 }]);
    expect(oldBodyDispose).toHaveBeenCalledOnce();
    expect(oldHeadDispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(4);
    const [bruteBody, bruteHead, body, head] = scene.children as THREE.InstancedMesh[];
    expect(body.count).toBe(240);
    expect(head.count).toBe(240);
    expect(bruteBody.count).toBe(1);
    expect(bruteHead.count).toBe(1);
    expect(scene.children.every((child) => (child as THREE.InstancedMesh).isInstancedMesh)).toBe(true);
    const matrix = new THREE.Matrix4();
    body.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBe(-1);
    expect(matrix.elements[13]).toBeCloseTo(0.32);
    expect(matrix.elements[14]).toBe(0);
    head.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBe(-1);
    expect(matrix.elements[13]).toBeCloseTo(0.75);
    expect(matrix.elements[14]).toBe(0);
    bruteBody.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeCloseTo(1.9);
    expect(matrix.elements[12]).toBe(1);
    expect(matrix.elements[13]).toBeCloseTo(0.32 * 1.9);
    bruteHead.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(0.75 * 1.9);

    renderer.update(enemies.slice(0, 1));
    expect(scene.children).toContain(body);
    expect(scene.children).toContain(bruteBody);
    expect(body.count).toBe(1);
    expect(head.count).toBe(1);
    expect(bruteBody.count).toBe(0);
    const oldBruteBodyDispose = vi.spyOn(bruteBody, 'dispose');
    const oldBruteHeadDispose = vi.spyOn(bruteHead, 'dispose');
    renderer.update([{ id: 242, type: 'brute', x: 0, z: 4, hp: 300 },
      { id: 243, type: 'brute', x: 0.5, z: 4, hp: 300 }]);
    expect(oldBruteBodyDispose).toHaveBeenCalledOnce();
    expect(oldBruteHeadDispose).toHaveBeenCalledOnce();
    const currentBrutes = activeMeshes(scene).filter((mesh) =>
      mesh !== body && mesh !== head);
    expect(currentBrutes.map((mesh) => mesh.count)).toEqual([2, 2]);
    expect(body.count).toBe(0);

    const bodyDispose = vi.spyOn(body, 'dispose');
    const headDispose = vi.spyOn(head, 'dispose');
    const bodyGeometryDispose = vi.spyOn(body.geometry, 'dispose');
    const headGeometryDispose = vi.spyOn(head.geometry, 'dispose');
    const bodyMaterialDispose = vi.spyOn(body.material as THREE.Material, 'dispose');
    const headMaterialDispose = vi.spyOn(head.material as THREE.Material, 'dispose');
    const bruteDisposals = currentBrutes.map((mesh) => vi.spyOn(mesh, 'dispose'));
    const bruteMaterials = currentBrutes.map((mesh) => vi.spyOn(mesh.material as THREE.Material, 'dispose'));
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    for (const dispose of [bodyDispose, headDispose, bodyGeometryDispose, headGeometryDispose,
      bodyMaterialDispose, headMaterialDispose, ...bruteDisposals, ...bruteMaterials]) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });
});
