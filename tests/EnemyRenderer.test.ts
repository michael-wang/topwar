import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import type { EnemyRenderState } from '../src/rendering/RenderState';

const enemies: EnemyRenderState[] = Array.from({ length: 240 }, (_, index) => ({
  id: index + 1, type: 'grunt', x: index === 0 ? 1 : 0, z: index,
}));

describe('EnemyRenderer instancing', () => {
  it('keeps grunt and brute instances separate and disposes replaced and final resources', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    expect(scene.children).toHaveLength(4);
    const initial = scene.children as THREE.InstancedMesh[];
    const oldBodyDispose = vi.spyOn(initial[0], 'dispose');
    const oldHeadDispose = vi.spyOn(initial[1], 'dispose');

    renderer.update([...enemies, { id: 241, type: 'brute', x: -1, z: 5 }]);
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
    renderer.update([{ id: 242, type: 'brute', x: 0, z: 4 },
      { id: 243, type: 'brute', x: 0.5, z: 4 }]);
    expect(oldBruteBodyDispose).toHaveBeenCalledOnce();
    expect(oldBruteHeadDispose).toHaveBeenCalledOnce();
    const currentBrutes = (scene.children as THREE.InstancedMesh[]).filter((mesh) =>
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
