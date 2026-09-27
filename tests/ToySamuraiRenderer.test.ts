import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyModel, armorModel, bowModel, arrowModel } from './characterModel';
import { ENEMY_PALETTE, PLAYER_PALETTE, paletteIndex } from '../src/rendering/tierPalettes';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { BossRenderer } from '../src/rendering/boss/BossRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import { ProjectilePulseTracker } from '../src/rendering/projectiles/ProjectileRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';

const state = (tier: number): GameRenderState => ({
  player: { x: 0, z: 0 },
  squad: { count: 1, rocketCount: 0, rifleCounts: [...Array(tier - 1).fill(0), 1], formationSpacing: .45 },
  track: { halfWidth: 2.5, defenseLineZ: -1.5 },
  enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [],
});
const samurai = (scene: THREE.Scene) => scene.children.find((child) =>
  child instanceof THREE.Group) as THREE.Group;
const armorOf = (group: THREE.Group) => group.getObjectByName('samurai-armor') as THREE.Mesh;

describe('Toy Samurai Army presentation', () => {
  it('keeps player armor blue through Tier 20, body fixed, and bow wood colored', () => {
    expect(PLAYER_PALETTE.map((entry) => entry.body)).toEqual([
      '#1769ee', '#10429b', '#2938c7', '#1b8fd6', '#5d5ee8',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const bow = bowModel();
    const renderer = new SquadRenderer(scene, body, armorModel(), bow);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update(state(tier), tier * 1000);
      renderer.update(state(tier), tier * 1000 + 400);
      const member = samurai(scene);
      expect((armorOf(member).material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(PLAYER_PALETTE[paletteIndex(tier, 5)].body.slice(1));
      expect((member.getObjectByName('samurai-body') as THREE.Mesh).material).toBe(body.material);
      expect((member.getObjectByName('wooden-bow') as THREE.Mesh).material).toBe(bow.material);
    }
    renderer.dispose();
  });

  it('shows bow release reaction and retains spawn and tier-up feedback', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, bodyModel(), armorModel(), bowModel());
    renderer.update(state(1), 0);
    expect(samurai(scene).scale.x).toBeCloseTo(1.35);
    renderer.update(state(1), 400);
    expect(samurai(scene).scale.x).toBe(1);
    renderer.update({ ...state(1), projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1 }] }, 500);
    const member = samurai(scene);
    expect(member.getObjectByName('bow-release-glint')?.visible).toBe(true);
    expect((member.getObjectByName('wooden-bow') as THREE.Mesh).rotation.x).toBeLessThan(0);
    expect((member.getObjectByName('samurai-body') as THREE.Mesh).scale.y).toBeLessThan(1);
    renderer.update(state(1), 700);
    expect(member.getObjectByName('bow-release-glint')?.visible).toBe(false);
    renderer.update(state(2), 800);
    const ring = scene.children.find((child) => child instanceof THREE.Mesh
      && child.geometry instanceof THREE.RingGeometry) as THREE.Mesh;
    expect(ring.visible).toBe(true);
    renderer.reset();
    expect(ring.visible).toBe(false);
    renderer.dispose();
  });

  it('keeps exactly twelve enemy InstancedMeshes and only armor changes tier color', () => {
    expect(ENEMY_PALETTE.map((entry) => entry.body)).toEqual([
      '#ef5b52', '#f47a3c', '#e6b83f', '#a66be8', '#e94f8a', '#9fbe45',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new EnemyRenderer(scene, body, armorModel());
    const families = () => scene.children.filter((child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh);
    expect(families()).toHaveLength(12);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, tier, x: 0, z: 10, hp: 3 }], tier * 1000);
      const bucket = paletteIndex(tier, 6);
      const armor = scene.getObjectByName(`${bucket}-samurai-armor`) as THREE.InstancedMesh;
      const bodyMesh = scene.getObjectByName(`${bucket}-samurai-body`) as THREE.InstancedMesh;
      const color = new THREE.Color();
      armor.getColorAt(0, color);
      expect(color.getHexString()).toBe(ENEMY_PALETTE[bucket].body.slice(1));
      expect(bodyMesh.material).toBe(body.material);
      expect(bodyMesh.count).toBe(1);
      expect(families()).toHaveLength(12);
    }
    renderer.dispose();
  });

  it('grows crowd capacity, flashes only hit armor, and pops out fallen grunts', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, bodyModel(), armorModel());
    const enemies = Array.from({ length: 900 }, (_, index) =>
      ({ id: index + 1, tier: 5, x: index % 20, z: 10, hp: 3 }));
    renderer.update(enemies, 0);
    const armor = scene.getObjectByName('4-samurai-armor') as THREE.InstancedMesh;
    expect(armor.count).toBe(900);
    expect(armor.instanceMatrix.count).toBeGreaterThanOrEqual(900);
    const damaged = enemies.map((enemy, index) => index === 0 ? { ...enemy, hp: 2 } : enemy);
    renderer.update(damaged, 10);
    const color = new THREE.Color();
    armor.getColorAt(0, color);
    expect(color.getHexString()).toBe('ffe36e');
    armor.getColorAt(1, color);
    expect(color.getHexString()).toBe('e94f8a');
    renderer.update(damaged.slice(1), 100);
    expect(scene.children.some((child) => child instanceof THREE.Group && child.visible)).toBe(true);
    renderer.reset();
    renderer.dispose();
  });

  it('colors giant soldier armor by enemy tier and keeps HP, hit and death presentation', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, body, armorModel());
    const [active, death] = scene.children as THREE.Group[];
    for (let tier = 1; tier <= 20; tier++) {
      const boss = { id: tier, tier, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7 };
      renderer.update(boss, tier * 1000);
      const armor = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
      expect((armor.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(ENEMY_PALETTE[paletteIndex(tier, 6)].body.slice(1));
      expect((active.children[0] as THREE.Group).children[0]).toHaveProperty('material', body.material);
      expect(active.scale.x).toBe(7);
    }
    const last = { id: 20, tier: 20, x: 0, z: 10, hp: 50, maxHp: 100, visualScale: 7 };
    renderer.update(last, 20010);
    expect((active.children[2] as THREE.Mesh).scale.x).toBeCloseTo(.5);
    const armor = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
    expect((armor.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffe36e');
    renderer.update(null, 20020);
    expect(death.visible).toBe(true);
    renderer.update(null, 21000);
    expect(death.visible).toBe(false);
    renderer.reset();
    renderer.dispose();
  });

  it('renders every rifle projectile as a bounded arrow and pools visuals', () => {
    const scene = new THREE.Scene();
    const arrow = arrowModel();
    const renderer = new ProjectileRenderer(scene, arrow);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, kind: 'rifle', tier, x: 0, z: 10 }], tier * 1000);
      expect(scene.children).toHaveLength(1);
      const mesh = scene.children[0] as THREE.Mesh;
      expect(mesh.name).toBe('wooden-arrow');
      expect(mesh.geometry).toBe(arrow.geometry);
      expect(mesh.scale.x).toBeLessThanOrEqual(1.6 * 1.35);
    }
    renderer.update([], 21000);
    expect((scene.children[0] as THREE.Mesh).visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    const pulse = new ProjectilePulseTracker();
    expect(pulse.scaleFor(1, 0)).toBeCloseTo(1.35);
    pulse.prune(new Set());
    expect(pulse.size).toBe(0);
  });
});
