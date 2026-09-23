import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import type { EnemyRenderState } from '../src/rendering/RenderState';

const enemies: EnemyRenderState[] = Array.from({ length: 240 }, (_, index) => ({
  id: index + 1, type: 'grunt', x: index === 0 ? 1 : 0, z: index,
}));

describe('EnemyRenderer instancing', () => {
  it('uses two reusable instanced meshes and disposes replaced and final resources', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    expect(scene.children).toHaveLength(2);
    const initial = scene.children as THREE.InstancedMesh[];
    const oldBodyDispose = vi.spyOn(initial[0], 'dispose');
    const oldHeadDispose = vi.spyOn(initial[1], 'dispose');

    renderer.update(enemies);
    expect(oldBodyDispose).toHaveBeenCalledOnce();
    expect(oldHeadDispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(2);
    const [body, head] = scene.children as THREE.InstancedMesh[];
    expect(body.count).toBe(240);
    expect(head.count).toBe(240);
    expect(body.isInstancedMesh && head.isInstancedMesh).toBe(true);
    const matrix = new THREE.Matrix4();
    body.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBe(-1);
    expect(matrix.elements[13]).toBeCloseTo(0.32);
    expect(matrix.elements[14]).toBe(0);
    head.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBe(-1);
    expect(matrix.elements[13]).toBeCloseTo(0.75);
    expect(matrix.elements[14]).toBe(0);

    renderer.update(enemies.slice(0, 1));
    expect(scene.children).toEqual([body, head]);
    expect(body.count).toBe(1);
    expect(head.count).toBe(1);

    const bodyDispose = vi.spyOn(body, 'dispose');
    const headDispose = vi.spyOn(head, 'dispose');
    const bodyGeometryDispose = vi.spyOn(body.geometry, 'dispose');
    const headGeometryDispose = vi.spyOn(head.geometry, 'dispose');
    const bodyMaterialDispose = vi.spyOn(body.material as THREE.Material, 'dispose');
    const headMaterialDispose = vi.spyOn(head.material as THREE.Material, 'dispose');
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    for (const dispose of [bodyDispose, headDispose, bodyGeometryDispose, headGeometryDispose,
      bodyMaterialDispose, headMaterialDispose]) expect(dispose).toHaveBeenCalledOnce();
  });
});
