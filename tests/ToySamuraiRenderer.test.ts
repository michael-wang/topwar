import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyModel, helmetModel, bowModel, arrowModel } from './characterModel';
import { ENEMY_PALETTE, PLAYER_PALETTE, paletteIndex } from '../src/rendering/tierPalettes';
import { PLAYER_VISUAL_SCALE, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ENEMY_VISUAL_SCALE, EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
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
const helmetOf = (group: THREE.Group) => group.getObjectByName('samurai-helmet') as THREE.Mesh;

describe('Toy Samurai Army presentation', () => {
  it('keeps player helmet blue through Tier 20, body fixed, and bow wood colored', () => {
    expect(PLAYER_PALETTE.map((entry) => entry.body)).toEqual([
      '#1769ee', '#10429b', '#2938c7', '#1b8fd6', '#5d5ee8',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const bow = bowModel();
    const renderer = new SquadRenderer(scene, body, helmetModel(), bow);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update(state(tier), tier * 1000);
      renderer.update(state(tier), tier * 1000 + 400);
      const member = samurai(scene);
      expect((helmetOf(member).material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(PLAYER_PALETTE[paletteIndex(tier, 5)].body.slice(1));
      expect((member.getObjectByName('samurai-body') as THREE.Mesh).material).toBe(body.material);
      expect((member.getObjectByName('wooden-bow') as THREE.Mesh).material).toBe(bow.material);
    }
    renderer.dispose();
  });

  it('shows bow release reaction and retains spawn and tier-up feedback', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), bowModel());
    renderer.update(state(1), 0);
    expect(samurai(scene).scale.x).toBeCloseTo(PLAYER_VISUAL_SCALE * 1.35);
    renderer.update(state(1), 400);
    expect(samurai(scene).scale.x).toBe(PLAYER_VISUAL_SCALE);
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

  it('separates four rendered soldiers without changing squad state or road bounds', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), bowModel());
    const four = state(1);
    four.squad = { count: 4, rocketCount: 0, rifleCounts: [4], formationSpacing: .45 };
    renderer.update(four, 400);
    const members = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(members).toHaveLength(4);
    const xs = members.map((member) => member.position.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    expect(xs.every((x) => Math.abs(x) < four.track.halfWidth)).toBe(true);
    expect(four.squad.formationSpacing).toBe(.45);
    renderer.dispose();
  });

  it('keeps one fixed body and six helmet InstancedMeshes through Tier 20', () => {
    expect(ENEMY_PALETTE.map((entry) => entry.body)).toEqual([
      '#ef5b52', '#f47a3c', '#e6b83f', '#a66be8', '#e94f8a', '#9fbe45',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new EnemyRenderer(scene, body, helmetModel());
    const families = () => scene.children.filter((child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh);
    expect(families()).toHaveLength(7);
    const bodyMesh = scene.getObjectByName('samurai-body') as THREE.InstancedMesh;
    expect(bodyMesh.material).toBe(body.material);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, tier, x: 0, z: 10, hp: 3 }], tier * 1000);
      const bucket = paletteIndex(tier, 6);
      const helmet = scene.getObjectByName(`${bucket}-samurai-helmet`) as THREE.InstancedMesh;
      const color = new THREE.Color();
      helmet.getColorAt(0, color);
      expect(color.getHexString()).toBe(ENEMY_PALETTE[bucket].body.slice(1));
      expect(bodyMesh.count).toBe(1);
      const matrix = new THREE.Matrix4();
      bodyMesh.getMatrixAt(0, matrix);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(ENEMY_VISUAL_SCALE);
      expect(families()).toHaveLength(7);
    }
    renderer.dispose();
  });

  it('grows crowd capacity, flashes only hit helmet, and pops out fallen grunts', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, bodyModel(), helmetModel());
    const enemies = Array.from({ length: 900 }, (_, index) =>
      ({ id: index + 1, tier: 5, x: index % 20, z: 10, hp: 3 }));
    renderer.update(enemies, 0);
    const helmet = scene.getObjectByName('4-samurai-helmet') as THREE.InstancedMesh;
    expect(helmet.count).toBe(900);
    expect(helmet.instanceMatrix.count).toBeGreaterThanOrEqual(900);
    const damaged = enemies.map((enemy, index) => index === 0 ? { ...enemy, hp: 2 } : enemy);
    renderer.update(damaged, 10);
    const color = new THREE.Color();
    helmet.getColorAt(0, color);
    expect(color.getHexString()).toBe('ffe36e');
    helmet.getColorAt(1, color);
    expect(color.getHexString()).toBe('e94f8a');
    renderer.update(damaged.slice(1), 100);
    expect(scene.children.some((child) => child instanceof THREE.Group && child.visible)).toBe(true);
    renderer.reset();
    renderer.dispose();
  });

  it('colors giant soldier helmet by enemy tier and keeps HP, hit and death presentation', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, body, helmetModel());
    const [active, death] = scene.children as THREE.Group[];
    for (let tier = 1; tier <= 20; tier++) {
      const boss = { id: tier, tier, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7 };
      renderer.update(boss, tier * 1000);
      const helmet = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
      expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(ENEMY_PALETTE[paletteIndex(tier, 6)].body.slice(1));
      expect((active.children[0] as THREE.Group).children[0]).toHaveProperty('material', body.material);
      expect(active.scale.x).toBe(7);
    }
    const last = { id: 20, tier: 20, x: 0, z: 10, hp: 50, maxHp: 100, visualScale: 7 };
    renderer.update(last, 20010);
    expect((active.children[2] as THREE.Mesh).scale.x).toBeCloseTo(.5);
    const helmet = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
    expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffe36e');
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
