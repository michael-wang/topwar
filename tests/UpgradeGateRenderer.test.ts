import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UpgradeGateRenderer } from '../src/rendering/gates/UpgradeGateRenderer';

describe('UpgradeGateRenderer', () => {
  it('reuses a thick wall and sequential plaques, then disposes shared resources without a canvas context', () => {
    const scene = new THREE.Scene();
    const renderer = new UpgradeGateRenderer(scene);
    const gate = { id: 'left', x: -2.7, z: 14, width: 0.9, hp: 100, maxHp: 100,
      rewardKind: 'rifle' as const, rewardAmount: 1, rewardsRemaining: 5, rewardTotal: 5 };
    renderer.update([gate]);
    expect(scene.children).toHaveLength(6);
    const panel = scene.children[0] as THREE.Mesh;
    expect(panel.position.x).toBe(2.7);
    expect((panel.geometry as THREE.BoxGeometry).parameters.depth).toBeGreaterThan(0.7);
    const disposeGeometry = vi.spyOn(panel.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(panel.material as THREE.Material, 'dispose');
    renderer.update([{ ...gate, hp: 70, z: 20 }]);
    expect(scene.children[0]).toBe(panel);
    expect(panel.position.z).toBe(20);
    renderer.update([{ ...gate, hp: 0, rewardsRemaining: 4 }]);
    expect(panel.visible).toBe(false);
    expect(scene.children.slice(1).filter((item) => item.visible)).toHaveLength(4);
    renderer.update([]);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
