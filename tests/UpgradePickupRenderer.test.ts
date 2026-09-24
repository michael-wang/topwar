import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UpgradePickupRenderer } from '../src/rendering/gates/UpgradePickupRenderer';

describe('UpgradePickupRenderer', () => {
  it('reuses visible plaques, removes departed ones, and disposes shared resources', () => {
    const scene = new THREE.Scene();
    const renderer = new UpgradePickupRenderer(scene);
    renderer.update([{ id: 1, x: -2.7, z: 8, rewardAmount: 1 }]);
    const plaque = scene.children[0] as THREE.Group;
    expect(plaque.position.toArray()).toEqual([2.7, 0.9, 8]);
    const body = plaque.children[0] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(body.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(body.material as THREE.Material, 'dispose');
    renderer.update([{ id: 1, x: -2.7, z: 4, rewardAmount: 1 },
      { id: 2, x: 2.7, z: 8, rewardAmount: 99 }]);
    expect(scene.children[0]).toBe(plaque);
    expect(plaque.position.z).toBe(4);
    expect(scene.children).toHaveLength(2);
    const gold = (scene.children[1] as THREE.Group).children[0] as THREE.Mesh;
    expect((body.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('18b8e8');
    expect((gold.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('efbd36');
    const disposeGold = vi.spyOn(gold.material as THREE.Material, 'dispose');
    renderer.update([{ id: 2, x: 2.7, z: 6, rewardAmount: 99 }]);
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).not.toBe(plaque);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeGold).toHaveBeenCalledOnce();
  });
});
