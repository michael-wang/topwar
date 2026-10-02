import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ProjectileRenderer, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
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
    const renderer = new ProjectileRenderer(scene, bullet);
    expect(scene.children).toHaveLength(2);
    expect(renderer.getDebugStats()).toEqual({ live: 0, pool: 8, pulseTrackers: 0 });
    const oldBody = scene.children[0] as THREE.InstancedMesh;
    const oldGlow = scene.children[1] as THREE.InstancedMesh;
    const disposeBody = vi.spyOn(oldBody, 'dispose');
    const disposeGlow = vi.spyOn(oldGlow, 'dispose');
    renderer.update(Array.from({ length: 9 }, (_, index) => shot(index + 1)), 100);
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
      expect(batch.geometry).toBe(bullet.geometry);
    }
    renderer.update([shot(1), shot(2)], 200);
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

  it('uses the old body and child-glow world transforms for rifles and rockets', () => {
    const scene = new THREE.Scene();
    const bullet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const renderer = new ProjectileRenderer(scene, bullet);
    const projectiles = [shot(3, 'rifle', .9), shot(4, 'rocket')];
    renderer.update(projectiles, 100);
    const body = scene.children[0] as THREE.InstancedMesh;
    const glow = scene.children[1] as THREE.InstancedMesh;
    expect((body.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('fff7e8');
    expect((glow.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('f7cd76');
    expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(.28);
    expect((glow.material as THREE.MeshBasicMaterial).blending).toBe(THREE.AdditiveBlending);
    expect((glow.material as THREE.MeshBasicMaterial).toneMapped).toBe(false);
    for (let index = 0; index < projectiles.length; index++) {
      const projectile = projectiles[index];
      const oldBody = new THREE.Object3D();
      oldBody.position.set(-projectile.x, projectile.kind === 'rocket' ? .66 : .64, projectile.z);
      const pulse = projectilePulseScale(0);
      const length = Math.min(1.35, 1 + .025 * (projectile.tier - 1));
      if (projectile.kind === 'rocket') oldBody.scale.setScalar(1.8 * pulse);
      else oldBody.scale.set(1 + .45 * projectile.hitRadiusBonus,
        1 + .45 * projectile.hitRadiusBonus, length * pulse);
      const oldGlow = new THREE.Object3D();
      const glowWidth = projectile.kind === 'rocket' ? 2.4 : 2.4 + 1.7 * projectile.hitRadiusBonus;
      oldGlow.scale.set(glowWidth, glowWidth, 1.12);
      oldBody.add(oldGlow);
      oldBody.updateMatrixWorld(true);
      const actualBody = instanceMatrix(body, index);
      const actualGlow = instanceMatrix(glow, index);
      for (let component = 0; component < 16; component++) {
        expect(actualBody.elements[component]).toBeCloseTo(oldBody.matrixWorld.elements[component], 5);
        expect(actualGlow.elements[component]).toBeCloseTo(oldGlow.matrixWorld.elements[component], 5);
      }
    }
    renderer.dispose();
    bullet.geometry.dispose();
    (bullet.material as THREE.Material).dispose();
  });

  it('removes batches and disposes owned resources without disposing shared bullet geometry', () => {
    const scene = new THREE.Scene();
    const bullet = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const renderer = new ProjectileRenderer(scene, bullet);
    const body = scene.children[0] as THREE.InstancedMesh;
    const glow = scene.children[1] as THREE.InstancedMesh;
    const bodyDispose = vi.spyOn(body, 'dispose');
    const glowDispose = vi.spyOn(glow, 'dispose');
    const bodyMaterialDispose = vi.spyOn(body.material as THREE.Material, 'dispose');
    const glowMaterialDispose = vi.spyOn(glow.material as THREE.Material, 'dispose');
    const geometryDispose = vi.spyOn(bullet.geometry, 'dispose');
    renderer.update([shot(1)], 0);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(bodyDispose).toHaveBeenCalledOnce();
    expect(glowDispose).toHaveBeenCalledOnce();
    expect(bodyMaterialDispose).toHaveBeenCalledOnce();
    expect(glowMaterialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    bullet.geometry.dispose();
    (bullet.material as THREE.Material).dispose();
  });
});
