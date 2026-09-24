import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BossRenderer, bossWalkPose } from '../src/rendering/boss/BossRenderer';
import type { BossRenderState } from '../src/rendering/RenderState';

const boss: BossRenderState = { id: 6441, tier: 1, x: 0.5, z: 576,
  hp: 3000, maxHp: 3000, visualScale: 7 };

describe('BossRenderer', () => {
  it('shows one giant Tier-1 humanoid with a walking pose and a readable HP ratio', () => {
    const scene = new THREE.Scene();
    const renderer = new BossRenderer(scene);
    const [active, death] = scene.children as THREE.Group[];
    renderer.update(boss, 100);
    expect(active.visible).toBe(true);
    expect(death.visible).toBe(false);
    expect(active.children).toHaveLength(8);
    expect(active.scale.x).toBeCloseTo(7);
    expect(active.position.x).toBe(-0.5);
    expect(active.position.z).toBe(576);
    expect(((active.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial)
      .color.getHexString()).toBe('9b6863');
    expect(((active.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial)
      .color.getHexString()).toBe('bd8580');
    const pose = bossWalkPose(6441, 100);
    expect(pose.leftArm).toBeCloseTo(-pose.rightArm);
    expect(pose.leftLeg).toBeCloseTo(-pose.rightLeg);
    const armAngle = active.children[2].rotation.x;
    renderer.update(boss, 300);
    expect(active.children[2].rotation.x).not.toBeCloseTo(armAngle);
    expect(active.position.z).toBe(576);
    renderer.update({ ...boss, hp: 1500 }, 301);
    expect(active.scale.x).toBeGreaterThan(7);
    expect(active.scale.x).toBeLessThanOrEqual(7 * 1.04);
    expect((active.children[7] as THREE.Mesh).scale.x).toBeCloseTo(0.5);
    for (const part of active.children.slice(0, 6) as THREE.Mesh[]) {
      expect(((part.material as THREE.MeshStandardMaterial).color.getHexString()))
        .toBe(part === active.children[1] ? 'fff8d6' : 'ffe36e');
    }
    renderer.update({ ...boss, hp: 1500 }, 401);
    expect(active.scale.x).toBe(7);
    expect(((active.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial)
      .color.getHexString()).toBe('9b6863');
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps a same-size gray death temporarily, flips toward +Z, resets, and disposes', () => {
    const scene = new THREE.Scene();
    const renderer = new BossRenderer(scene);
    const [active, death] = scene.children as THREE.Group[];
    renderer.update(boss, 0);
    renderer.update(null, 1);
    expect(active.visible).toBe(false);
    expect(death.visible).toBe(true);
    expect(death.children).toHaveLength(6);
    expect(death.scale.x).toBeGreaterThan(7);
    const gray = ((death.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial);
    expect(gray.color.getHexString()).toBe('777b7c');
    const dispose = vi.spyOn(gray, 'dispose');
    renderer.update(null, 450);
    expect(death.scale.x).toBe(7);
    expect(death.position.z).toBeGreaterThan(576);
    expect(death.rotation.x).toBeGreaterThan(0);
    renderer.update(null, 900);
    expect(death.visible).toBe(false);
    renderer.update(boss, 1000);
    renderer.update(null, 1001);
    renderer.reset();
    expect(death.visible).toBe(false);
    renderer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
