import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import type { ProjectileRenderState } from '../src/rendering/RenderState';

const shot = (id: number, kind: 'rifle' | 'rocket' = 'rifle',
  hitRadiusBonus = 0): ProjectileRenderState => ({
  id, kind, tier: kind === 'rocket' ? 0 : 3, x: id / 10, z: 4 + id,
  hitRadiusBonus,
});

function instanceMatrix(mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

describe('batched projectile renderer', () => {
  it('grows geometrically while keeping exactly two scene meshes and pruning pulse entries', () => {
    const scene = new THREE.Scene();
    const bullet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const renderer = new ProjectileRenderer(scene);
    expect(scene.children).toHaveLength(2);
    expect(renderer.getDebugStats()).toEqual({ live: 0, pool: 8, pulseTrackers: 0 });
    const oldBody = scene.children[0] as THREE.InstancedMesh;
    const oldGlow = scene.children[1] as THREE.InstancedMesh;
    const disposeBody = vi.spyOn(oldBody, 'dispose');
    const disposeGlow = vi.spyOn(oldGlow, 'dispose');
    renderer.update(Array.from({ length: 9 }, (_, index) => shot(index + 1)), 100, projectileTestCamera, 844);
    expect(renderer.getDebugStats()).toEqual({ live: 9, pool: 16, pulseTrackers: 9 });
    expect(scene.children).toHaveLength(2);
    expect(scene.children).not.toContain(oldBody);
    expect(disposeBody).toHaveBeenCalledOnce();
    expect(disposeGlow).toHaveBeenCalledOnce();
    for (const batch of scene.children as THREE.InstancedMesh[]) {
      expect(batch.isInstancedMesh).toBe(true);
      expect(batch.frustumCulled).toBe(false);
      expect(batch.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
      expect(batch.count).toBe(9);
      expect(batch.visible).toBe(true);
      expect(batch.geometry).toBe((scene.children[0] as THREE.InstancedMesh).geometry);
    }
    renderer.update([shot(1), shot(2)], 200, projectileTestCamera, 844);
    expect(renderer.getDebugStats()).toEqual({ live: 2, pool: 16, pulseTrackers: 2 });
    renderer.reset();
    expect(renderer.getDebugStats()).toEqual({ live: 0, pool: 16, pulseTrackers: 0 });
    expect((scene.children[0] as THREE.InstancedMesh).count).toBe(0);
    expect((scene.children[1] as THREE.InstancedMesh).count).toBe(0);
    expect(scene.children.every((batch) => !batch.visible)).toBe(true);
    renderer.dispose();
    bullet.geometry.dispose();
    (bullet.material as THREE.Material).dispose();
  });



  it('removes batches and disposes owned resources and releases its single owned tracer geometry', () => {
    const scene = new THREE.Scene();
    const bullet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const renderer = new ProjectileRenderer(scene);
    const body = scene.children[0] as THREE.InstancedMesh;
    const glow = scene.children[1] as THREE.InstancedMesh;
    const bodyDispose = vi.spyOn(body, 'dispose');
    const glowDispose = vi.spyOn(glow, 'dispose');
    const bodyMaterialDispose = vi.spyOn(body.material as THREE.Material, 'dispose');
    const glowMaterialDispose = vi.spyOn(glow.material as THREE.Material, 'dispose');
    const geometryDispose = vi.spyOn(body.geometry, 'dispose');
    renderer.update([shot(1)], 0, projectileTestCamera, 844);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(bodyDispose).toHaveBeenCalledOnce();
    expect(glowDispose).toHaveBeenCalledOnce();
    expect(bodyMaterialDispose).toHaveBeenCalledOnce();
    expect(glowMaterialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    bullet.geometry.dispose();
    (bullet.material as THREE.Material).dispose();
  });
});

const projectileTestCamera = new THREE.PerspectiveCamera(48, 350/844, .1, 180);
