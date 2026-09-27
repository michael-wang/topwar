import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StreamRewardRenderer } from '../src/rendering/rewards/StreamRewardRenderer';

const reward = { id: 1, tier: 1, x: 0, z: 10, hitProgress: 0, hitsRequired: 10 };

function part(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('StreamRewardRenderer', () => {
  it('shows a soldier crate with icon and a shrinking durability bar instead of hit-count text', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    renderer.update([reward], 1000);
    const crate = scene.children[0] as THREE.Group;
    expect(crate.name).toBe('soldier-reward-crate');
    expect(part(crate, 'crate-body')).toBeDefined();
    expect(part(crate, 'soldier-plus-icon')).toBeDefined();
    const fill = part(crate, 'remaining-durability');
    expect(fill.scale.x).toBe(1);
    expect(crate.children.some((child) => (child as THREE.Mesh).material
      && ((child as THREE.Mesh).material as THREE.Material).type === 'MeshBasicMaterial')).toBe(true);
    renderer.update([{ ...reward, hitProgress: 5 }], 1010);
    expect(fill.scale.x).toBeCloseTo(.5);
    expect(crate.scale.x).toBeGreaterThan(1);
    expect((crate.children.at(-2) as THREE.LineSegments).visible).toBe(true);
    expect((crate.children.at(-1) as THREE.LineSegments).visible).toBe(false);
    renderer.update([{ ...reward, hitProgress: 9 }], 1260);
    expect(fill.scale.x).toBeCloseTo(.1);
    expect((crate.children.at(-1) as THREE.LineSegments).visible).toBe(true);
    const lid = part(crate, 'crate-lid');
    expect((lid.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('fff0a0');
    expect((part(crate, 'crate-body').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('96938a');
    renderer.update([{ ...reward, hitProgress: 9 }], 1350);
    expect((lid.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('ff9b4a');
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps tier accent colors and reuses crate resources across hit updates', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    renderer.update([reward, { ...reward, id: 2, tier: 2, x: .6 }], 0);
    const [first, second] = scene.children as THREE.Group[];
    expect((part(first, 'crate-lid').material as THREE.MeshBasicMaterial).color.getHexString()).toBe('1ac1ed');
    expect((part(second, 'crate-lid').material as THREE.MeshBasicMaterial).color.getHexString()).toBe('edc242');
    const geometry = part(first, 'crate-body').geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    renderer.update([{ ...reward, z: 20, hitProgress: 3 }, { ...reward, id: 2, tier: 2, x: .6 }], 100);
    expect(scene.children[0]).toBe(first);
    expect(first.position.z).toBe(20);
    expect(part(first, 'crate-body').geometry).toBe(geometry);
    expect(part(second, 'crate-body').geometry).toBe(geometry);
    renderer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('briefly pops upward when acquired, then removes the crate', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    renderer.update([reward], 100);
    const crate = scene.children[0] as THREE.Group;
    renderer.update([], 110);
    expect(scene.children).toEqual([crate]);
    renderer.update([], 200);
    expect(crate.position.y).toBeGreaterThan(.39);
    expect(crate.scale.x).toBeGreaterThan(1);
    renderer.update([], 310);
    expect(scene.children).toHaveLength(0);
    renderer.dispose();
  });
});
