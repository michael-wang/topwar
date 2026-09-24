import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ENEMY_PALETTE, PLAYER_PALETTE, REWARD_PALETTE, paletteIndex } from '../src/rendering/tierPalettes';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { BossRenderer } from '../src/rendering/boss/BossRenderer';
import { StreamRewardRenderer } from '../src/rendering/rewards/StreamRewardRenderer';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';

const renderState = (tier: number): GameRenderState => ({
  player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0,
    rifleCounts: [...Array(tier - 1).fill(0), 1], formationSpacing: 0.45 },
  track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null,
  streamRewards: [], gates: [], pickups: [], projectiles: [],
});

describe('bounded palette rendering', () => {
  it('cycles enemy, player, and reward palettes for Tier 7 and Tier 10', () => {
    expect(ENEMY_PALETTE).toHaveLength(6);
    expect(PLAYER_PALETTE).toHaveLength(5);
    expect(REWARD_PALETTE).toHaveLength(4);
    expect(paletteIndex(7, 6)).toBe(0);
    expect(paletteIndex(10, 6)).toBe(3);
    expect(paletteIndex(7, 5)).toBe(1);
    expect(paletteIndex(10, 5)).toBe(4);
    expect(paletteIndex(10, 4)).toBe(1);
  });

  it('keeps exactly six enemy instanced mesh families through Tier 20', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene);
    const meshCount = () => scene.children.filter((child) => child instanceof THREE.InstancedMesh).length;
    expect(meshCount()).toBe(36);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, tier, x: 0, z: 10, hp: 3 }], tier * 1000);
      expect(meshCount()).toBe(36);
      expect(scene.children.filter((child) => child instanceof THREE.InstancedMesh
        && child.count === 1)).toHaveLength(6);
    }
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('uses shared reward materials for every tier without growing material families', () => {
    const scene = new THREE.Scene();
    const renderer = new StreamRewardRenderer(scene);
    const materials = new Set<THREE.Material>();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, tier, x: 0, z: 10, hitProgress: 0, hitsRequired: 10 }], tier * 300);
      const panel = scene.children.find((child) => child instanceof THREE.Mesh) as THREE.Mesh;
      materials.add(panel.material as THREE.Material);
      expect((panel.material as THREE.MeshBasicMaterial).color.getHexString())
        .toBe(REWARD_PALETTE[paletteIndex(tier, 4)].slice(1));
      renderer.update([], tier * 300 + 200);
      renderer.update([], tier * 300 + 400);
    }
    expect(materials.size).toBe(4);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('uses six Boss palettes at a constant role scale', () => {
    const scene = new THREE.Scene();
    const renderer = new BossRenderer(scene);
    const active = scene.children[0] as THREE.Group;
    const bodyMaterials = new Set<THREE.Material>();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update({ id: tier, tier, x: 0, z: 10, hp: 100, maxHp: 100,
        visualScale: 7 }, tier * 1000);
      expect(active.scale.x).toBe(7);
      const material = (active.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      bodyMaterials.add(material);
      expect(material.color.getHexString()).toBe(ENEMY_PALETTE[paletteIndex(tier, 6)].body.slice(1));
    }
    expect(bodyMaterials.size).toBe(6);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('cycles player palettes at one body scale and retains tier-up ring', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const materials = new Set<THREE.Material>();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update(renderState(tier), tier * 1000);
      const soldier = scene.children.find((child) => child instanceof THREE.Group) as THREE.Group;
      expect(soldier.scale.x).toBe(tier === 1 ? 1.35 : 1.25);
      renderer.update(renderState(tier), tier * 1000 + 400);
      expect(soldier.scale.x).toBe(1);
      const material = (soldier.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      materials.add(material);
      expect(material.color.getHexString()).toBe(PLAYER_PALETTE[paletteIndex(tier, 5)].body.slice(1));
    }
    expect(materials.size).toBeLessThanOrEqual(5);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('does not present high-tier casualty demotion as a tier-up', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    renderer.update(renderState(4), 0);
    renderer.update(renderState(4), 400);
    const demoted = renderState(4);
    demoted.squad = { count: 27, rocketCount: 0, rifleCounts: [9, 9, 9], formationSpacing: 0.45 };
    renderer.update(demoted, 500);
    expect(scene.children.find((child) => child instanceof THREE.Mesh)?.visible).toBe(false);
    renderer.dispose();
  });

  it('caps rifle projectile geometry and color materials at high tiers', () => {
    const scene = new THREE.Scene();
    const renderer = new ProjectileRenderer(scene);
    const bodies = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, kind: 'rifle', tier, x: 0, z: 10 }], tier * 1000);
      const group = scene.children[0] as THREE.Group;
      const body = group.children.find((child) => child instanceof THREE.Mesh && child.visible) as THREE.Mesh;
      bodies.add(body.geometry);
      materials.add(body.material as THREE.Material);
      expect(group.scale.x).toBeCloseTo(1.35);
    }
    expect(bodies.size).toBe(3);
    expect(materials.size).toBeLessThanOrEqual(7);
    const geometry = [...bodies][0];
    const dispose = vi.spyOn(geometry, 'dispose');
    renderer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
