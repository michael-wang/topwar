import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UpgradeGateRenderer } from '../src/rendering/gates/UpgradeGateRenderer';

describe('UpgradeGateRenderer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reuses a thick hit generator and disposes resources without canvas', () => {
    const scene = new THREE.Scene();
    const renderer = new UpgradeGateRenderer(scene);
    const gate = { id: 'left', x: -2.7, z: 14, width: 0.9, hitProgress: 0,
      hitsRequired: 10, rewardKind: 'rifle' as const, rewardAmount: 1 };
    renderer.update([gate]);
    expect(scene.children).toHaveLength(1);
    const panel = scene.children[0] as THREE.Mesh;
    expect((panel.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('18b8e8');
    expect(panel.position.x).toBe(2.7);
    expect((panel.geometry as THREE.BoxGeometry).parameters.depth).toBeGreaterThan(0.7);
    const disposeGeometry = vi.spyOn(panel.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(panel.material as THREE.Material, 'dispose');
    renderer.update([{ ...gate, hitProgress: 7, z: 20 }]);
    expect(scene.children[0]).toBe(panel);
    expect(panel.position.z).toBe(20);
    renderer.update([{ ...gate, hitProgress: 0 }]);
    expect(panel.visible).toBe(true);
    expect(panel.scale.z).toBe(1);
    renderer.update([gate, { ...gate, id: 'right', x: 2.7, rewardKind: 'tier2Rifle',
      rewardAmount: 1, hitsRequired: 100 }]);
    const jackpot = scene.children.find((child) => child !== panel) as THREE.Mesh;
    expect((jackpot.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('efbd36');
    renderer.update([]);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('labels hit progress and recreates its texture only when the count changes', () => {
    const fillText = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ clearRect: vi.fn(), fillText }) }) });
    const scene = new THREE.Scene();
    const renderer = new UpgradeGateRenderer(scene);
    const gate = { id: 'right', x: 2.7, z: 8, width: 0.9, hitProgress: 0,
      hitsRequired: 100, rewardKind: 'tier2Rifle' as const, rewardAmount: 1 };
    renderer.update([gate]);
    expect(fillText.mock.calls.map((call) => call[0])).toEqual(['+1 T2 RIFLE', 'HITS 0/100']);
    const label = scene.children[1];
    renderer.update([{ ...gate, z: 12 }]);
    expect(scene.children[1]).toBe(label);
    expect(fillText).toHaveBeenCalledTimes(2);
    renderer.update([{ ...gate, hitProgress: 42 }]);
    expect(scene.children[1]).not.toBe(label);
    expect(fillText.mock.calls.map((call) => call[0])).toEqual([
      '+1 T2 RIFLE', 'HITS 0/100', '+1 T2 RIFLE', 'HITS 42/100',
    ]);
    renderer.dispose();
  });
});
