import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StreamRewardRenderer } from '../src/rendering/rewards/StreamRewardRenderer';
import { helmetModel } from './characterModel';
import { PLAYER_PALETTE } from '../src/rendering/tierPalettes';

const reward = { id: 1, tier: 1, x: 0, z: 10, hitProgress: 0, hitsRequired: 10 };

function part(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('StreamRewardRenderer', () => {
  it('shows a tier-colored player helmet on a gold crate with a shrinking durability bar', () => {
    const scene = new THREE.Scene();
    const sourceHelmet = helmetModel();
    const renderer = new StreamRewardRenderer(scene, sourceHelmet);
    renderer.update([reward], 1000);
    const crate = scene.children[0] as THREE.Group;
    expect(crate.name).toBe('soldier-reward-crate');
    expect((part(crate, 'crate-body').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('f2c94c');
    expect((part(crate, 'crate-lid').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('ffd86a');
    expect((part(crate, 'crate-strap').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('c98c28');
    const helmet = part(crate, 'reward-soldier-helmet');
    expect(helmet.geometry).toBe(sourceHelmet.geometry);
    expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('2879cb');
    expect(helmet.position.z).toBeLessThan(-.2);
    expect(helmet.scale.z).toBeLessThan(helmet.scale.x);
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
    const warning = part(crate, 'near-break-warning');
    expect(warning.visible).toBe(true);
    expect((warning.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('ff9545');
    expect((lid.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffd86a');
    expect((part(crate, 'crate-body').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('f2c94c');
    renderer.update([{ ...reward, hitProgress: 9 }], 1350);
    expect((warning.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('ff553b');
    expect((lid.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffd86a');
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps crate gold across tiers and reuses resources across hit updates', () => {
    const scene = new THREE.Scene();
    const sourceHelmet = helmetModel();
    const renderer = new StreamRewardRenderer(scene, sourceHelmet);
    renderer.update([reward, { ...reward, id: 2, tier: 2, x: .6 }], 0);
    const [first, second] = scene.children as THREE.Group[];
    expect(part(first, 'crate-lid').material).toBe(part(second, 'crate-lid').material);
    expect((part(first, 'crate-lid').material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffd86a');
    expect((part(first, 'reward-soldier-helmet').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('2879cb');
    expect((part(second, 'reward-soldier-helmet').material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe('10429b');
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

  it('matches the player helmet palette through Tier 20 with bounded shared geometry', () => {
    const scene = new THREE.Scene();
    const sourceHelmet = helmetModel();
    const renderer = new StreamRewardRenderer(scene, sourceHelmet);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ ...reward, id: tier, tier }], tier * 1000);
      const helmet = part(scene.children[0] as THREE.Group, 'reward-soldier-helmet');
      expect(helmet.geometry).toBe(sourceHelmet.geometry);
      expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(PLAYER_PALETTE[(tier - 1) % PLAYER_PALETTE.length].body.slice(1));
      renderer.reset();
    }
    renderer.dispose();
  });

  it('briefly pops upward when acquired, then removes the crate', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene, helmetModel());
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
