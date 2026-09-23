import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UpgradeGateRenderer } from '../src/rendering/gates/UpgradeGateRenderer';

describe('UpgradeGateRenderer', () => {
  it('reuses panels, removes resolved gates, and disposes shared resources without a canvas context', () => {
    const scene = new THREE.Scene();
    const renderer = new UpgradeGateRenderer(scene);
    const gate = { id: 'left', x: -1.25, z: 14, width: 2.1, hp: 36, maxHp: 36,
      rewardKind: 'rifle' as const, rewardAmount: 1 };
    renderer.update([gate]);
    expect(scene.children).toHaveLength(1);
    const panel = scene.children[0] as THREE.Mesh;
    expect(panel.position.x).toBe(1.25);
    const disposeGeometry = vi.spyOn(panel.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(panel.material as THREE.Material, 'dispose');
    renderer.update([{ ...gate, hp: 30 }]);
    expect(scene.children[0]).toBe(panel);
    renderer.update([]);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
