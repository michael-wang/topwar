import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StreamRewardRenderer } from '../src/rendering/rewards/StreamRewardRenderer';

describe('StreamRewardRenderer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders distinct stationary Tier-1 and Tier-2 panels and reuses them by ID', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    const tier1 = { id: 1, tier: 1 as const, x: -0.6, z: 24, hitProgress: 0, hitsRequired: 10 };
    const tier2 = { id: 2, tier: 2 as const, x: 0.6, z: 25, hitProgress: 3, hitsRequired: 10 };
    renderer.update([tier1, tier2]);
    expect(scene.children).toHaveLength(2);
    const [blue, gold] = scene.children as THREE.Mesh[];
    expect((blue.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('1ac1ed');
    expect((gold.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('edc242');
    expect(blue.position.x).toBe(0.6);
    expect(gold.scale.x).toBeGreaterThan(blue.scale.x);
    const geometryDispose = vi.spyOn(blue.geometry, 'dispose');
    const materialDispose = vi.spyOn(blue.material as THREE.Material, 'dispose');
    renderer.update([{ ...tier1, z: 30, hitProgress: 1 }, tier2]);
    expect(scene.children[0]).toBe(blue);
    expect(blue.position.z).toBe(30);
    renderer.update([]);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('updates the progress texture only when progress changes and disposes it', () => {
    const fillText = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ fillText }) }) });
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    const reward = { id: 2, tier: 2 as const, x: 0, z: 20, hitProgress: 0, hitsRequired: 10 };
    renderer.update([reward]);
    expect(fillText.mock.calls.map((call) => call[0])).toEqual(['+1 T2', '0/10']);
    const label = scene.children[1] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    const textureDispose = vi.spyOn(label.material.map!, 'dispose');
    renderer.update([{ ...reward, z: 21 }]);
    expect(scene.children[1]).toBe(label);
    expect(fillText).toHaveBeenCalledTimes(2);
    renderer.update([{ ...reward, hitProgress: 1 }]);
    expect(fillText.mock.calls.map((call) => call[0])).toEqual(['+1 T2', '0/10', '+1 T2', '1/10']);
    expect(textureDispose).toHaveBeenCalledOnce();
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
