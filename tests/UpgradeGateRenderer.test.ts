import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UpgradeGateRenderer } from '../src/rendering/gates/UpgradeGateRenderer';

describe('UpgradeGateRenderer', () => {
  it('reuses a thick wall, shows the active generator, and disposes resources without canvas', () => {
    const scene = new THREE.Scene();
    const renderer = new UpgradeGateRenderer(scene);
    const gate = { id: 'left', x: -2.7, z: 14, width: 0.9, hp: 100, maxHp: 100,
      rewardMode: 'pickup' as const, rewardKind: 'rifle' as const,
      rewardAmount: 1, rewardIntervalSeconds: 1 };
    renderer.update([gate]);
    expect(scene.children).toHaveLength(1);
    const panel = scene.children[0] as THREE.Mesh;
    expect((panel.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('18b8e8');
    expect(panel.position.x).toBe(2.7);
    expect((panel.geometry as THREE.BoxGeometry).parameters.depth).toBeGreaterThan(0.7);
    const disposeGeometry = vi.spyOn(panel.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(panel.material as THREE.Material, 'dispose');
    renderer.update([{ ...gate, hp: 70, z: 20 }]);
    expect(scene.children[0]).toBe(panel);
    expect(panel.position.z).toBe(20);
    renderer.update([{ ...gate, hp: 0 }]);
    expect(panel.visible).toBe(true);
    expect(panel.scale.z).toBeLessThan(1);
    renderer.update([gate, { ...gate, id: 'right', x: 2.7, rewardAmount: 99, hp: 1000, maxHp: 1000 }]);
    const jackpot = scene.children.find((child) => child !== panel) as THREE.Mesh;
    expect((jackpot.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('efbd36');
    renderer.update([]);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
