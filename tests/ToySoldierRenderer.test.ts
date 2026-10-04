import { playerFamily, enemyFamilies, bossFamily } from './characterModel';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { bodyModel, grayBodyModel, runFrames, helmetModel, vestModel, rifleModel, bulletModel } from './characterModel';
import { ENEMY_PALETTE, PLAYER_PALETTE, paletteIndex } from '../src/rendering/tierPalettes';
import { PLAYER_VISUAL_SCALE, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ENEMY_VISUAL_SCALE, ENEMY_GAIT_CYCLE_MS, EnemyRenderer, enemyRunFrame, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
import { BossRenderer } from '../src/rendering/boss/BossRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import { ProjectilePulseTracker } from '../src/rendering/projectiles/ProjectileRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';
import { removedVisualMembers } from '../src/rendering/squad/casualtyVisuals';

const state = (tier: number): GameRenderState => ({
  player: { x: 0, z: 0 },
  squad: { count: 1, rocketCount: 0, rifleCounts: [...Array(tier - 1).fill(0), 1], formationSpacing: .45 },
  track: { halfWidth: 2.5, defenseLineZ: -1.5 },
  enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [],
});
const soldier = (scene: THREE.Scene) => scene.children.find((child) =>
  child instanceof THREE.Group) as THREE.Group;
const helmetOf = (group: THREE.Group) => group.getObjectByName('toy-soldier-helmet') as THREE.Mesh;

describe('Modern Toy Soldier presentation', () => {
  it('cycles urgent poses every 90 ms with a 360 ms gait and independent enemy phases', () => {
    expect(ENEMY_GAIT_CYCLE_MS).toBe(360);
    expect(new Set([0, 90, 180, 270].map((time) => enemyRunFrame(7, time))).size).toBe(4);
    expect(enemyRunFrame(7, 360)).toBe(enemyRunFrame(7, 0));
    expect(enemyWalkPose(7, 360).bob).toBeCloseTo(enemyWalkPose(7, 0).bob);
    expect(enemyWalkPose(0, 90).bob).toBeCloseTo(.052);
    expect(enemyWalkPose(0, 90).leftArm).toBeCloseTo(.43);
    expect(enemyRunFrame(7, 0)).not.toBe(enemyRunFrame(8, 0));
    expect(enemyWalkPose(7, 0).bob).toBeGreaterThanOrEqual(0);
    expect(enemyWalkPose(7, 125).leftArm).not.toBe(enemyWalkPose(7, 0).leftArm);
  });

  it('keeps helmet and vest blue through Tier 20 while rifle stays charcoal', () => {
    expect(PLAYER_PALETTE.map((entry) => entry.body)).toEqual([
      '#287fc6', '#10429b', '#2938c7', '#1b8fd6', '#5d5ee8',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const rifle = rifleModel();
    const renderer = new SquadRenderer(scene, playerFamily(body, helmetModel(), vestModel(), rifle));
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update(state(tier), tier * 1000);
      renderer.update(state(tier), tier * 1000 + 400);
      const member = soldier(scene);
      expect((helmetOf(member).material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(PLAYER_PALETTE[paletteIndex(tier, 5)].body.slice(1));
      expect((member.getObjectByName('toy-soldier-vest') as THREE.Mesh).material)
        .toBe(helmetOf(member).material);
      expect((member.getObjectByName('toy-soldier-body') as THREE.Mesh).material).toBe(body.material);
      expect((member.getObjectByName('toy-rifle') as THREE.Mesh).material).toBe(rifle.material);
    }
    renderer.dispose();
  });

  it('shows rifle recoil and muzzle flash while retaining spawn and tier-up feedback', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    renderer.update(state(1), 0);
    expect(soldier(scene).scale.x).toBeCloseTo(PLAYER_VISUAL_SCALE * 1.35);
    renderer.update(state(1), 400);
    expect(soldier(scene).scale.x).toBe(PLAYER_VISUAL_SCALE);
    renderer.update({ ...state(1), projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1,
      hitRadiusBonus: 0 }] }, 500);
    const member = soldier(scene);
    expect(member.getObjectByName('muzzle-flash')?.visible).toBe(true);
    expect((member.getObjectByName('toy-rifle') as THREE.Mesh).rotation.x).toBeLessThan(0);
    expect((member.getObjectByName('toy-soldier-body') as THREE.Mesh).scale.y).toBe(1);
    expect((member.getObjectByName('toy-soldier-helmet') as THREE.Mesh).scale.y).toBe(1);
    expect((member.getObjectByName('toy-soldier-vest') as THREE.Mesh).scale.y).toBe(1);
    renderer.update(state(1), 700);
    expect(member.getObjectByName('muzzle-flash')?.visible).toBe(false);
    renderer.update(state(2), 800);
    const ring = scene.children.find((child) => child instanceof THREE.Mesh
      && child.geometry instanceof THREE.RingGeometry) as THREE.Mesh;
    expect(ring.visible).toBe(true);
    renderer.reset();
    expect(ring.visible).toBe(false);
    renderer.dispose();
  });

  it('gives merged rifles a larger but capped muzzle flash', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    const scales: number[] = [];
    for (const tier of [1, 2, 3, 20]) {
      renderer.update(state(tier), tier * 1000);
      renderer.update({ ...state(tier), projectiles: [{ id: tier, kind: 'rifle', tier,
        x: 0, z: 1, hitRadiusBonus: Math.min(.9, (tier - 1) * .45) }] }, tier * 1000 + 1);
      const flash = soldier(scene).getObjectByName('muzzle-flash')!;
      expect(flash.visible).toBe(true);
      scales.push(flash.scale.x);
    }
    expect(scales).toEqual([1, 1.2, 1.4, 1.4]);
    renderer.dispose();
  });

  it('separates four rendered soldiers without changing squad state or road bounds', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    const four = { ...state(1),
      squad: { count: 4, rocketCount: 0, rifleCounts: [4], formationSpacing: .45 } };
    renderer.update(four, 400);
    const members = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(members).toHaveLength(4);
    const xs = members.map((member) => member.position.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    expect(xs.every((x) => Math.abs(x) < four.track.halfWidth)).toBe(true);
    expect(four.squad.formationSpacing).toBe(.45);
    renderer.dispose();
  });

  it('maps exact demotion to old visible members and shows a red player knockout', () => {
    expect(removedVisualMembers(
      { count: 1, rocketCount: 0, rifleCounts: [0, 0, 1], rifleRemainder: 0 },
      { count: 9, rocketCount: 0, rifleCounts: [9], rifleRemainder: 0 },
    )).toEqual([{ index: 0, tier: 3, rocket: false }]);
    expect(removedVisualMembers(
      { count: 3, rocketCount: 1, rifleCounts: [1, 1], rifleRemainder: 0 },
      { count: 1, rocketCount: 1, rifleCounts: [], rifleRemainder: 0 },
    )).toEqual([{ index: 1, tier: 2, rocket: false },
      { index: 0, tier: 1, rocket: false }]);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    const before = { ...state(1), squad: { count: 2, rocketCount: 0,
      rifleCounts: [2], formationSpacing: .45 } };
    renderer.update(before, 0);
    const event: PresentationEvent = { kind: 'normalEnemyContact', enemyId: 5,
      enemyTier: 1, attackerX: 0, attackerZ: .2, playerX: 0, playerZ: 0,
      before: { count: 2, rocketCount: 0, rifleCounts: [2], rifleRemainder: 0 },
      after: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 } };
    renderer.present([event], 100, 3, .45);
    const casualty = scene.getObjectByName('player-casualty') as THREE.Group;
    expect(casualty.visible).toBe(true);
    renderer.update({ ...state(1), track: { halfWidth: 3, defenseLineZ: -1.5 } }, 100);
    expect(((casualty.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .color.getHexString()).toBe('ff3030');
    renderer.update(state(1), 280);
    expect(casualty.position.y).toBeGreaterThan(0);
    expect(((casualty.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial)
      .opacity).toBeLessThan(1);
    renderer.reset();
    expect(casualty.visible).toBe(false);
    renderer.present(Array(100).fill(event), 500, 3, .45);
    expect(scene.children.filter((child) => child.name === 'player-casualty'))
      .toHaveLength(48);
    renderer.dispose();
  });

  it('keeps four running body poses and six helmet/vest InstancedMesh pairs through Tier 20', () => {
    expect(ENEMY_PALETTE.map((entry) => entry.body)).toEqual([
      '#6f7c5a', '#7d8966', '#626f50', '#838975', '#596b61', '#8b8969',
    ]);
    expect(ENEMY_PALETTE.map((entry) => entry.head)).toEqual([
      '#94a081', '#a0ac8c', '#899673', '#a7ad97', '#83978d', '#b3af89',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new EnemyRenderer(scene, enemyFamilies(body, helmetModel(), vestModel(),
      runFrames(), grayBodyModel()));
    const families = () => scene.children.filter((child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh && child.name !== 'enemy-pale-shatter');
    expect(families()).toHaveLength(16);
    const bodyMeshes = Array.from({ length: 4 }, (_, frame) =>
      scene.getObjectByName(`toy-soldier-run-${frame}`) as THREE.InstancedMesh);
    expect(bodyMeshes.every((mesh) => mesh.material === body.material)).toBe(true);
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, tier, x: 0, z: 10, hp: 3 }], tier * 1000);
      const bucket = paletteIndex(tier, 6);
      const helmet = scene.getObjectByName(`${bucket}-toy-soldier-helmet`) as THREE.InstancedMesh;
      const color = new THREE.Color();
      helmet.getColorAt(0, color);
      expect(color.getHexString()).toBe(ENEMY_PALETTE[bucket].body.slice(1));
      const vest = scene.getObjectByName(`${bucket}-toy-soldier-vest`) as THREE.InstancedMesh;
      vest.getColorAt(0, color);
      expect(color.getHexString()).toBe(ENEMY_PALETTE[bucket].body.slice(1));
      expect(bodyMeshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(1);
      const matrix = new THREE.Matrix4();
      bodyMeshes[enemyRunFrame(tier, tier * 1000)].getMatrixAt(0, matrix);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(ENEMY_VISUAL_SCALE);
      expect(families()).toHaveLength(16);
    }
    renderer.dispose();
  });

  it('grows crowd capacity, flashes gear, and fades intact grunts quickly without debris', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(),
      runFrames(), grayBodyModel()));
    const enemies = Array.from({ length: 900 }, (_, index) =>
      ({ id: index + 1, tier: 5, x: index % 20, z: 10, hp: 3 }));
    renderer.update(enemies, 0);
    const helmet = scene.getObjectByName('4-toy-soldier-helmet') as THREE.InstancedMesh;
    expect(helmet.count).toBe(900);
    expect(helmet.instanceMatrix.count).toBeGreaterThanOrEqual(900);
    const damaged = enemies.map((enemy, index) => index === 0 ? { ...enemy, hp: 2 } : enemy);
    renderer.update(damaged, 10);
    const color = new THREE.Color();
    helmet.getColorAt(0, color);
    expect(color.getHexString()).toBe('fff7e8');
    helmet.getColorAt(1, color);
    expect(color.getHexString()).toBe('596b61');
    renderer.update(damaged.slice(1), 100);
    const death = scene.children.find((child) => child instanceof THREE.Group && child.visible) as THREE.Group;
    expect(death).toBeDefined();
    const plantedY = death.position.y;
    expect(plantedY).toBeLessThan(.06);
    renderer.update(damaged.slice(1), 320);
    expect(death.position.y-plantedY).toBeGreaterThan(0); expect(death.position.y-plantedY).toBeLessThan(.15); expect(death.visible).toBe(true);
    const gray = (death.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(gray.color.getHexString()).toBe('aeb4b7');
    expect(gray.opacity).toBeGreaterThan(0); expect(gray.opacity).toBeLessThan(1);
    expect(((death.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color
      .getHexString()).toBe('596b61');
    expect((scene.getObjectByName('enemy-pale-shatter') as THREE.InstancedMesh).count).toBe(0);
    renderer.update(damaged.slice(1), 800);
    expect(death.visible).toBe(false);
    renderer.reset();
    renderer.dispose();
  });

  it('keeps complete Heavy proportions in active, hit, pooled death and contact paths', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(), runFrames(), grayBodyModel()));
    const heavy = { id: 2, tier: 1, archetype: 'heavy' as const, x: 0, z: 8, hp: 15,
      visualScale: 1.89, visualScaleX: 1.9845, visualScaleY: 2.1735, visualScaleZ: 2.1735 };
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    for (const [time, hp] of [[0, 15], [100, 14]]) {
      renderer.update([{ ...heavy, hp }], time);
      for (const name of ['0-toy-soldier-helmet', '0-toy-soldier-vest', `toy-soldier-run-${enemyRunFrame(2, time, 650)}`]) {
        (scene.getObjectByName(name) as THREE.InstancedMesh).getMatrixAt(0, matrix);
        scale.setFromMatrixScale(matrix);
        expect(scale.x).toBeCloseTo(heavy.visualScaleX);
        expect(scale.y).toBeCloseTo(heavy.visualScaleY);
        expect(scale.z).toBeCloseTo(heavy.visualScaleZ);
      }
    }
    renderer.update([], 200);
    const death = scene.children.find(child => child instanceof THREE.Group && child.visible) as THREE.Group;
    expect(death.scale.x).toBeCloseTo(heavy.visualScaleX);
    expect(death.scale.y).toBeCloseTo(heavy.visualScaleY);
    renderer.update([], 440);
    expect(death.visible).toBe(false); expect(death.scale.x).toBeCloseTo(heavy.visualScaleX);
    expect(death.scale.y / death.scale.x).toBeCloseTo(heavy.visualScaleY / heavy.visualScaleX);
    renderer.update([heavy], 1000);
    renderer.present([{ kind: 'normalEnemyContact', enemyId: 2, enemyTier: 1,
      attackerX: 0, attackerZ: 8, playerX: 0, playerZ: 0,
      before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      after: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 } }], 1100);
    renderer.update([], 1100);
    const contact = scene.getObjectByName('enemy-contact-exchange') as THREE.Group;
    expect(contact.scale.x).toBeCloseTo(heavy.visualScaleX * 1.12);
    expect(contact.scale.y).toBeCloseTo(heavy.visualScaleY * 1.12);
    expect(contact.scale.z).toBeCloseTo(heavy.visualScaleZ * 1.12);
    renderer.dispose();
  });

  it('uses a distinct contact exchange for only the attacking grunt', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(),
      runFrames(), grayBodyModel()));
    const enemies = [{ id: 1, tier: 1, x: 0, z: 2, hp: 3 },
      { id: 2, tier: 1, x: 1, z: 2, hp: 3 }];
    renderer.update(enemies, 0);
    renderer.present([{ kind: 'normalEnemyContact', enemyId: 1, enemyTier: 1,
      attackerX: 0, attackerZ: 2, playerX: 0, playerZ: 0,
      before: { count: 2, rocketCount: 0, rifleCounts: [2], rifleRemainder: 0 },
      after: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 } }], 100);
    renderer.update(enemies.slice(1), 100);
    const contact = scene.getObjectByName('enemy-contact-exchange') as THREE.Group;
    expect(contact.visible).toBe(true);
    expect(((contact.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .color.getHexString()).toBe('fff7e8');
    renderer.update([], 200);
    expect(contact.visible).toBe(true);
    const otherDeath = scene.children.find((child) => child instanceof THREE.Group
      && child !== contact && child.visible) as THREE.Group;
    expect(otherDeath).toBeDefined();
    renderer.reset();
    expect(contact.visible).toBe(false);
    renderer.present(Array(100).fill({ kind: 'normalEnemyContact', enemyId: 1,
      enemyTier: 1, attackerX: 0, attackerZ: 2, playerX: 0, playerZ: 0,
      before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
      after: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 } } as PresentationEvent), 500);
    expect(scene.children.filter((child) => child.name === 'enemy-contact-exchange'))
      .toHaveLength(48);
    renderer.dispose();
  });

  it('colors giant soldier helmet and vest by enemy tier and keeps HP, hit and death presentation', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(),
      runFrames(), [body, body, body, body], grayBodyModel()));
    const [active, death] = scene.children as THREE.Group[];
    for (let tier = 1; tier <= 20; tier++) {
      const boss = { id: tier, tier, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7,
        engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
      renderer.update(boss, tier * 1000);
      const helmet = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
      expect(helmet.scale.x).toBeCloseTo(.92);
      expect(helmet.position.y).toBeCloseTo(.82 * .08 - .025);
      expect(helmet.position.z).toBeCloseTo(.10);
      expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe(ENEMY_PALETTE[paletteIndex(tier, 6)].body.slice(1));
      const vest = (active.children[0] as THREE.Group).children[2] as THREE.Mesh;
      expect((vest.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe((helmet.material as THREE.MeshStandardMaterial).color.getHexString());
      expect((vest.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
      expect((active.children[0] as THREE.Group).children[0]).toHaveProperty('material', body.material);
      expect(active.scale.x).toBe(7);
    }
    const last = { id: 20, tier: 20, x: 0, z: 10, hp: 50, maxHp: 100, visualScale: 7,
      engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    renderer.update(last, 20010);
    const barAnchor = active.getObjectByName('boss-hp-anchor') as THREE.Group;
    const pose = active.children[0] as THREE.Group;
    expect(barAnchor.parent).toBe(active);
    expect(active.scale.x).toBe(7);
    expect(pose.scale.x).toBeGreaterThan(1);
    expect(barAnchor.position.y).toBeGreaterThan(1.05);
    expect(barAnchor.position.y).toBeLessThan(1.2);
    expect(barAnchor.position.y - .28 * barAnchor.scale.y / 2).toBeGreaterThan(1.04);
    expect(active.getObjectByName('boss-hp-badge')).toBeUndefined();
    expect(barAnchor.scale.x).toBeGreaterThan(.32);
    expect(barAnchor.position.x).toBeGreaterThan(0);
    const frame = barAnchor.getObjectByName('boss-hp-frame') as THREE.Mesh;
    const track = barAnchor.getObjectByName('boss-hp-track') as THREE.Mesh;
    const fill = barAnchor.getObjectByName('boss-hp-fill') as THREE.Mesh;
    expect(frame).toBeDefined();
    expect(track).toBeDefined();
    expect(fill.scale.x).toBeCloseTo(.5);
    expect((fill.material as THREE.MeshBasicMaterial)
      .color.getHexString()).toBe('ff3b30');
    for (const part of [frame, track, fill]) {
      expect((part.material as THREE.MeshBasicMaterial).depthTest).toBe(false);
      expect((part.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
    }
    expect(fill.renderOrder).toBeGreaterThan(track.renderOrder);
    const helmet = (active.children[0] as THREE.Group).children[1] as THREE.Mesh;
    const washes = pose.children.slice(3, 6) as THREE.Mesh[];
    expect(washes[1].position.y).toBeCloseTo(helmet.position.y);
    expect(washes[1].position.z).toBeCloseTo(helmet.position.z);
    expect(washes[1].scale.x).toBeCloseTo(helmet.scale.x * 1.005);
    expect(washes[2].geometry).toBe((pose.children[2] as THREE.Mesh).geometry);
    expect(washes.every((mesh) => mesh.visible)).toBe(true);
    expect((washes[0].material as THREE.MeshBasicMaterial).color.getHexString()).toBe('fff4df');
    expect((washes[0].material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(.2);
    expect((washes[0].material as THREE.MeshBasicMaterial).blending).toBe(THREE.NormalBlending);
    expect((pose.children[0] as THREE.Mesh).material).toBe(body.material);
    expect((helmet.material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe(ENEMY_PALETTE[paletteIndex(20, 6)].body.slice(1));
    renderer.update(last, 20071);
    expect(washes.every((mesh) => !mesh.visible)).toBe(true);
    expect((pose.children[0] as THREE.Mesh).material).toBe(body.material);
    renderer.update(last, 20110);
    expect(active.scale.x).toBe(7);
    expect(barAnchor.scale.x).toBeCloseTo(.32);
    expect(barAnchor.position.x).toBe(0);
    expect(barAnchor.position.y).toBeCloseTo(1.1);
    renderer.update(null, 20120);
    expect(death.visible).toBe(true);
    const deathHelmet = death.getObjectByName('boss-death-helmet') as THREE.Mesh;
    expect(deathHelmet.geometry).toBe(helmet.geometry);
    expect(deathHelmet.scale.x).toBeCloseTo(helmet.scale.x);
    expect(deathHelmet.position.y).toBeCloseTo(helmet.position.y);
    expect(deathHelmet.position.z).toBeCloseTo(helmet.position.z);
    renderer.update(null, 20820);
    expect((death.getObjectByName('boss-death-fall-pivot') as THREE.Group)
      .rotation.x).toBeLessThan(0);
    expect(death.rotation.z).toBe(0);
    renderer.update(null, 22300);
    expect(death.visible).toBe(false);
    renderer.reset();
    renderer.dispose();
  });

  it('grays while upright, holds, then falls toward the player and fades with owned materials', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(),
      runFrames(), runFrames(), grayBodyModel()));
    const active = scene.children[0] as THREE.Group;
    const death = scene.getObjectByName('boss-death') as THREE.Group;
    const fallPivot = death.getObjectByName('boss-death-fall-pivot') as THREE.Group;
    const liveBody = death.getObjectByName('boss-death-body-live') as THREE.Mesh;
    const grayBody = death.getObjectByName('boss-death-body-gray') as THREE.Mesh;
    const helmet = death.getObjectByName('boss-death-helmet') as THREE.Mesh;
    const vest = death.getObjectByName('boss-death-vest') as THREE.Mesh;
    const liveMaterial = liveBody.material as THREE.MeshStandardMaterial;
    const grayMaterial = grayBody.material as THREE.MeshStandardMaterial;
    const helmetMaterial = helmet.material as THREE.MeshStandardMaterial;
    const vestMaterial = vest.material as THREE.MeshStandardMaterial;
    const boss = { id: 7, tier: 3, x: 1.5, z: 24, hp: 100, maxHp: 100,
      visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    renderer.update(boss, 0);
    const liveHelmet = ((active.children[0] as THREE.Group).children[1] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    const tierColor = liveHelmet.color.getHexString();
    renderer.update(null, 1000);
    expect(death.visible).toBe(true);
    expect(death.position.x).toBe(-1.5);
    expect(death.position.z).toBe(24);
    expect(active.visible).toBe(false);
    expect(helmetMaterial).not.toBe(liveHelmet);
    expect(helmetMaterial.color.getHexString()).toBe(tierColor);
    expect(liveMaterial.opacity).toBe(1);
    expect(grayMaterial.opacity).toBe(0);
    renderer.update(null, 1100);
    expect(fallPivot.rotation.x).toBeCloseTo(0);
    expect(grayMaterial.opacity).toBeGreaterThan(0);
    expect(grayMaterial.opacity).toBeLessThan(1);
    expect(helmetMaterial.color.getHexString()).not.toBe(tierColor);
    renderer.update(null, 1150);
    expect(grayMaterial.opacity).toBe(1);
    expect(liveMaterial.opacity).toBe(0);
    expect(helmetMaterial.color.getHexString()).toBe('adb4b8');
    expect(vestMaterial.color.getHexString()).toBe('adb4b8');
    expect(fallPivot.rotation.x).toBeCloseTo(0);
    renderer.update(null, 1500);
    expect(fallPivot.rotation.x).toBeCloseTo(0);
    expect(grayMaterial.opacity).toBe(1);
    renderer.update(null, 1600);
    expect(fallPivot.rotation.x).toBeCloseTo(0);
    renderer.update(null, 1700);
    expect(fallPivot.rotation.x).toBeLessThan(0);
    expect(death.rotation.z).toBe(0);
    expect(grayMaterial.opacity).toBe(1);
    renderer.update(null, 2120);
    expect(fallPivot.rotation.x).toBeCloseTo(-Math.PI * .46);
    expect(new THREE.Vector3(0, 1, 0).applyEuler(fallPivot.rotation).z)
      .toBeLessThan(-.95);
    expect(death.position.z).toBe(24);
    expect(grayMaterial.opacity).toBe(1);
    renderer.update(null, 2180);
    expect(grayMaterial.opacity).toBe(1);
    expect(liveMaterial.opacity).toBe(0);
    expect(grayMaterial.color.getHSL({ h: 0, s: 0, l: 0 }).s).toBeLessThan(.1);
    expect(liveHelmet.color.getHexString()).toBe(tierColor);
    renderer.update(null, 2400);
    const firstFade = grayMaterial.opacity;
    expect(firstFade).toBeLessThan(1);
    renderer.update(null, 2800);
    expect(grayMaterial.opacity).toBeLessThan(firstFade);
    expect(fallPivot.rotation.x).toBeCloseTo(-Math.PI * .46);
    expect(death.position.z).toBe(24);
    renderer.update(null, 3080);
    expect(death.visible).toBe(false);
    renderer.update({ ...boss, id: 8, hp: 80 }, 3100);
    expect(active.visible).toBe(true);
    expect(death.visible).toBe(false);
    renderer.update(null, 3200);
    expect(death.visible).toBe(true);
    expect(liveBody.material).toBe(liveMaterial);
    expect(grayBody.material).toBe(grayMaterial);
    expect(grayMaterial.opacity).toBe(0);
    renderer.reset();
    expect(death.visible).toBe(false);
    const disposals = [liveMaterial, grayMaterial, helmetMaterial, vestMaterial]
      .map((material) => vi.spyOn(material, 'dispose'));
    const vestGeometryDispose = vi.spyOn(vest.geometry, 'dispose');
    renderer.dispose();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
    expect(vestGeometryDispose).toHaveBeenCalledOnce();
  });

  it('hands off the last walking or slam-hit silhouette without a frame-zero model pop', () => {
    for (const engaged of [false, true]) {
      const scene = new THREE.Scene();
      const body = bodyModel();
      const walks = runFrames();
      const slams = runFrames();
      const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(),
        walks, slams, grayBodyModel()));
      const boss = { id: 7, tier: 3, x: 1.2, z: 19, hp: 100, maxHp: 100,
        visualScale: 7, engaged, slamCooldownRemainingSeconds: engaged ? 1.9 : 0,
        slamCount: engaged ? 1 : 0 };
      const at = engaged ? 1010 : 310;
      renderer.update(boss, at - 10);
      renderer.update({ ...boss, hp: 80 }, at);
      const active = scene.children[0] as THREE.Group;
      const livePose = active.children[0] as THREE.Group;
      const [liveBody, liveHelmet, liveVest] = livePose.children as THREE.Mesh[];
      const liveMatrices = [liveBody, liveHelmet, liveVest].map((mesh) => {
        active.updateMatrixWorld(true);
        return [...mesh.matrixWorld.elements];
      });
      const posePosition = livePose.position.clone();
      const poseRotation = livePose.rotation.clone();
      const poseScale = livePose.scale.clone();
      expect(engaged ? posePosition.y < 0 : posePosition.y > 0).toBe(true);
      expect(poseScale.x).toBeGreaterThan(1);
      renderer.update(null, at);
      const death = scene.getObjectByName('boss-death') as THREE.Group;
      const fallPivot = death.getObjectByName('boss-death-fall-pivot') as THREE.Group;
      const deathPose = death.getObjectByName('boss-death-pose') as THREE.Group;
      const deathBody = death.getObjectByName('boss-death-body-live') as THREE.Mesh;
      const deathGray = death.getObjectByName('boss-death-body-gray') as THREE.Mesh;
      const deathHelmet = death.getObjectByName('boss-death-helmet') as THREE.Mesh;
      const deathVest = death.getObjectByName('boss-death-vest') as THREE.Mesh;
      expect(death.position.toArray()).toEqual(active.position.toArray());
      expect(death.rotation.toArray()).toEqual(active.rotation.toArray());
      expect(death.scale.toArray()).toEqual(active.scale.toArray());
      expect(fallPivot.rotation.x).toBeCloseTo(0);
      expect(deathPose.position.toArray()).toEqual(posePosition.toArray());
      expect(deathPose.rotation.toArray()).toEqual(poseRotation.toArray());
      expect(deathPose.scale.toArray()).toEqual(poseScale.toArray());
      expect(deathBody.geometry).toBe(liveBody.geometry);
      expect(deathGray.geometry).toBe(liveBody.geometry);
      expect(deathVest.geometry).toBe(liveVest.geometry);
      expect((deathBody.material as THREE.MeshStandardMaterial).transparent)
        .toBe((liveBody.material as THREE.MeshStandardMaterial).transparent);
      expect((deathBody.material as THREE.MeshStandardMaterial).depthWrite)
        .toBe((liveBody.material as THREE.MeshStandardMaterial).depthWrite);
      expect(deathHelmet.position.toArray()).toEqual(liveHelmet.position.toArray());
      expect(deathHelmet.scale.toArray()).toEqual(liveHelmet.scale.toArray());
      expect((deathHelmet.material as THREE.MeshStandardMaterial).color.getHexString())
        .toBe((liveHelmet.material as THREE.MeshStandardMaterial).color.getHexString());
      const deathMeshes = [deathBody, deathHelmet, deathVest];
      death.updateMatrixWorld(true);
      deathMeshes.forEach((mesh, index) => {
        mesh.matrixWorld.elements.forEach((value, component) => {
          expect(value).toBeCloseTo(liveMatrices[index][component]);
        });
      });
      expect(death.getObjectByName('boss-death-body-hit-wash')?.visible).toBe(true);
      renderer.update(null, at + 100);
      expect(fallPivot.rotation.x).toBeCloseTo(0);
      renderer.update(null, at + 700);
      expect(fallPivot.rotation.x).toBeLessThan(0);
      expect(deathPose.rotation.toArray()).toEqual(poseRotation.toArray());
      renderer.dispose();
    }
  });

  it('reveals the Boss HP plate only as the real Boss emerges from distance haze', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(),
      runFrames(), runFrames(), grayBodyModel()));
    const anchor = scene.getObjectByName('boss-hp-anchor') as THREE.Group;
    const frame = scene.getObjectByName('boss-hp-frame') as THREE.Mesh;
    const boss = { id: 1, tier: 1, x: 0, z: 100, hp: 100, maxHp: 100,
      visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    renderer.update(boss, 0, 10);
    expect(anchor.visible).toBe(false);
    expect((frame.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    renderer.update(boss, 20, 22);
    expect(anchor.visible).toBe(true);
    expect((frame.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(.5);
    renderer.update(boss, 40, 40);
    expect((frame.material as THREE.MeshBasicMaterial).opacity).toBe(1);
    renderer.dispose();
  });

  it('keeps ballistic plates Tier-colored and tactical details charcoal in one Boss mesh', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const vest = vestModel();
    const factors = new Float32Array(vest.geometry.getAttribute('position').count * 3).fill(1);
    factors.fill(.6, 0, 3);
    vest.geometry.setAttribute('color', new THREE.BufferAttribute(factors, 3));
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vest,
      runFrames(), runFrames(), grayBodyModel()));
    const pose = ((scene.children[0] as THREE.Group).children[0] as THREE.Group);
    const armor = pose.children[2] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const charcoal = new THREE.Color('#303238');
    const geometries = new Set<THREE.BufferGeometry>();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update({ id: 1, tier, x: 0, z: 10, hp: 100, maxHp: 100,
        visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 }, tier * 1000);
      geometries.add(armor.geometry);
      const vertexColor = armor.geometry.getAttribute('color');
      expect(armor.material.color.getHexString()).toBe(ENEMY_PALETTE[paletteIndex(tier, 6)].body.slice(1));
      expect(vertexColor.getX(1)).toBe(1); // main plate uses full Tier color
      expect(armor.material.color.r * vertexColor.getX(0)).toBeCloseTo(charcoal.r);
      expect(armor.material.color.g * vertexColor.getY(0)).toBeCloseTo(charcoal.g);
      expect(armor.material.color.b * vertexColor.getZ(0)).toBeCloseTo(charcoal.b);
    }
    expect(geometries.size).toBe(6);
    renderer.dispose();
  });

  it('renders Boss wind-up, two-handed impact and recovery from simulation slam state', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const frames = [0, 1, 2, 3].map(() => bodyModel());
    const walks = runFrames();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(), walks,
      frames, grayBodyModel()));
    const active = scene.children[0] as THREE.Group;
    const pose = active.children[0] as THREE.Group;
    const mesh = pose.children[0] as THREE.Mesh;
    const boss = { id: 1, tier: 1, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7,
      engaged: true, slamCooldownRemainingSeconds: .5, slamCount: 0 };
    renderer.update(boss, 100);
    expect(mesh.geometry).toBe(frames[0].geometry);
    renderer.update({ ...boss, slamCooldownRemainingSeconds: .2 }, 200);
    expect(mesh.geometry).toBe(frames[1].geometry);
    renderer.update({ ...boss, slamCount: 1, slamCooldownRemainingSeconds: 2 }, 300);
    expect(mesh.geometry).toBe(frames[2].geometry);
    expect(pose.scale.y).toBeLessThan(1);
    const hpAnchor = active.getObjectByName('boss-hp-anchor') as THREE.Group;
    expect(hpAnchor.parent).toBe(active);
    expect(hpAnchor.scale.x).toBeCloseTo(.32);
    renderer.update({ ...boss, slamCount: 1, slamCooldownRemainingSeconds: 1.8 }, 500);
    expect(mesh.geometry).toBe(frames[3].geometry);
    renderer.reset();
    renderer.update({ ...boss, slamCount: 1, slamCooldownRemainingSeconds: 2 }, 700);
    expect(mesh.geometry).toBe(frames[2].geometry);
    renderer.reset();
    renderer.update({ ...boss, engaged: false, slamCooldownRemainingSeconds: 0 }, 800);
    expect(walks.map((frame) => frame.geometry)).toContain(mesh.geometry);
    expect(pose.rotation.x).toBeCloseTo(-.10);
    renderer.dispose();
  });

  it('cycles four deliberate baked locomotion poses before melee', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const walks = runFrames();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(), walks,
      runFrames(), grayBodyModel()));
    const mesh = ((scene.children[0] as THREE.Group).children[0] as THREE.Group).children[0] as THREE.Mesh;
    const boss = { id: 1, tier: 1, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7,
      engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    const sampled = [0, 300, 600, 900].map((time) => {
      renderer.update(boss, time);
      return mesh.geometry;
    });
    expect(new Set(sampled).size).toBe(4);
    renderer.update({ ...boss, engaged: true, slamCooldownRemainingSeconds: 1 }, 1000);
    expect(mesh.geometry).toBe(body.geometry);
    renderer.dispose();
  });

  it('shows brief warm transparent hit washes with gaps under sustained fire', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new BossRenderer(scene, bossFamily(body, helmetModel(), vestModel(),
      runFrames(), runFrames(), grayBodyModel()));
    const mesh = ((scene.children[0] as THREE.Group).children[0] as THREE.Group).children[0] as THREE.Mesh;
    const pose = (scene.children[0] as THREE.Group).children[0] as THREE.Group;
    const washes = pose.children.slice(3, 6) as THREE.Mesh[];
    const boss = { id: 1, tier: 1, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7,
      engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    renderer.update(boss, 0);
    renderer.update({ ...boss, hp: 90 }, 10);
    expect(washes.every((wash) => wash.visible)).toBe(true);
    expect(washes[0].geometry).toBe(mesh.geometry);
    expect(mesh.material).toBe(body.material);
    renderer.update({ ...boss, hp: 80 }, 100);
    expect(washes.every((wash) => !wash.visible)).toBe(true);
    expect(mesh.material).toBe(body.material);
    renderer.update({ ...boss, hp: 70 }, 180);
    expect(washes.every((wash) => !wash.visible)).toBe(true);
    renderer.update({ ...boss, hp: 60, engaged: true, slamCooldownRemainingSeconds: .2 }, 230);
    expect(washes.every((wash) => wash.visible)).toBe(true);
    expect(washes[0].geometry).toBe(mesh.geometry);
    renderer.dispose();
  });

  it('renders every rifle projectile as a bounded bullet and pools visuals', () => {
    const scene = new THREE.Scene();
    const bullet = bulletModel();
    const renderer = new ProjectileRenderer(scene, bullet);
    const widths: number[] = [];
    const glowWidths: number[] = [];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, kind: 'rifle', tier, x: 0, z: 10,
        hitRadiusBonus: Math.min(0.9, (tier - 1) * 0.45) }], tier * 1000);
      expect(scene.children).toHaveLength(2);
      const mesh = scene.children[0] as THREE.InstancedMesh;
      expect(mesh.name).toBe('rifle-tracers');
      expect(mesh.geometry).toBe(bullet.geometry);
      const glow = scene.children[1] as THREE.InstancedMesh;
      expect(glow.geometry).toBe(bullet.geometry);
      expect((glow.material as THREE.MeshBasicMaterial).blending).toBe(THREE.AdditiveBlending);
      mesh.getMatrixAt(0, matrix);
      matrix.decompose(position, rotation, scale);
      expect(scale.x).toBeCloseTo(1 + 0.45 * Math.min(0.9, (tier - 1) * 0.45));
      widths.push(scale.x);
      expect(scale.z).toBeLessThanOrEqual(1.35 * 1.35);
      glow.getMatrixAt(0, matrix);
      matrix.decompose(position, rotation, scale);
      glowWidths.push(scale.x);
    }
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    expect(widths[19]).toBe(widths[2]);
    expect(glowWidths[1]).toBeGreaterThan(glowWidths[0]);
    expect(glowWidths[2]).toBeGreaterThan(glowWidths[1]);
    expect(glowWidths[19]).toBe(glowWidths[2]);
    renderer.update([], 21000);
    expect((scene.children[0] as THREE.InstancedMesh).count).toBe(0);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    const pulse = new ProjectilePulseTracker();
    expect(pulse.scaleFor(1, 0)).toBeCloseTo(1.35);
    pulse.prune(new Set());
    expect(pulse.size).toBe(0);
  });
});

it('keeps Heavy-only floating health bars live, proportionate and reusable', () => {
  const scene = new THREE.Scene();
  const renderer = new EnemyRenderer(scene, enemyFamilies(bodyModel(), helmetModel(), vestModel(), runFrames(), grayBodyModel()));
  const heavy = { id: 1, tier: 1, archetype: 'heavy' as const, x: 0, z: 15, hp: 15, maxHp: 15, visualScaleY: 2.1735 };
  const grunt = { id: 2, tier: 1, archetype: 'grunt' as const, x: 1.4, z: 15, hp: 1 };
  renderer.update([heavy, grunt], 0);
  const backing = scene.getObjectByName('heavy-hp-backing') as THREE.Sprite;
  const fill = scene.getObjectByName('heavy-hp-fill') as THREE.Sprite;
  expect(scene.children.filter(child => child.name === 'heavy-hp-fill')).toHaveLength(1);
  expect(fill.scale.x).toBeCloseTo(1.1);
  expect(fill.position.y).toBeGreaterThan(heavy.visualScaleY * .5);
  renderer.update([{ ...heavy, hp: 5 }], 100);
  expect(fill.scale.x).toBeCloseTo(1.1 / 3);
  expect(fill.position.x).toBeCloseTo(1.1 / 3);
  renderer.update([], 200); expect(fill.visible).toBe(false); expect(backing.visible).toBe(false);
  renderer.update([heavy], 300); expect(scene.getObjectByName('heavy-hp-fill')).toBe(fill);
  renderer.reset(); expect(fill.visible).toBe(false);
  renderer.dispose(); expect(scene.getObjectByName('heavy-hp-fill')).toBeUndefined();
});

it('presents progression power independently of tiers with reusable member bursts and temporary muzzle afterglow', () => {
  const scene = new THREE.Scene();
  const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
  const frame = { ...state(1),
    squad: { count: 2, rocketCount: 0, rifleCounts: [2], formationSpacing: .45 },
    projectiles: [{ id: 1, tier: 1, kind: 'rifle' as const, x: 0, z: 1, hitRadiusBonus: 0 }] };
  renderer.update(frame, 0);
  const before = JSON.stringify(frame);
  renderer.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 4 }, 100);
  frame.projectiles = [{ ...frame.projectiles[0], id: 2 }];
  renderer.update(frame, 100);
  const bursts = scene.children.filter(child => child.name === 'player-level-up-burst');
  expect(bursts).toHaveLength(2);
  expect(bursts.every(child => child.visible && child.children.length === 9)).toBe(true);
  const body = scene.getObjectByName('toy-soldier-body') as THREE.Mesh;
  expect((body.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(1);
  const muzzle = scene.getObjectByName('muzzle-flash') as THREE.Mesh;
  expect(muzzle.scale.x).toBeCloseTo(1.9);
  renderer.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 4, toLevel: 5 }, 200);
  renderer.update(frame, 400);
  expect(scene.children.filter(child => child.name === 'player-level-up-burst')).toHaveLength(2);
  renderer.update(frame, 1001);
  expect(bursts.every(child => !child.visible)).toBe(true);
  frame.projectiles = [{ ...frame.projectiles[0], id: 3 }];
  renderer.update(frame, 1100); expect(muzzle.scale.x).toBeCloseTo(1.9);
  renderer.update(frame, 1700); expect(muzzle.scale.x).toBeCloseTo(1);
  expect(frame.squad.rifleCounts).toEqual([2]);
  expect(JSON.parse(before).squad).toEqual(frame.squad);
  renderer.reset(); renderer.update(frame, 1800);
  expect(bursts.every(child => !child.visible)).toBe(true);
  expect((body.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
  renderer.dispose(); expect(scene.getObjectByName('player-level-up-burst')).toBeUndefined();
});
it('makes tracers warmer/louder temporarily and resets the afterglow on Retry', () => {
  const scene = new THREE.Scene(); const renderer = new ProjectileRenderer(scene, bulletModel());
  const shots = [{ id: 1, tier: 1, kind: 'rifle' as const, x: 0, z: 3, hitRadiusBonus: 0 }];
  renderer.update(shots, 0);
  const glow = scene.getObjectByName('tracer-glows') as THREE.InstancedMesh;
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(.28);
  renderer.presentLevelUp(100); renderer.update(shots, 200);
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(.55);
  renderer.update(shots, 1501); expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(.28);
  renderer.presentLevelUp(1600); renderer.reset(); renderer.update(shots, 1700);
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(.28);
  renderer.dispose();
});


it('runs reinforcement in from below, raises its rifle, then flashes only the member who fired', () => {
  const scene = new THREE.Scene(), renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
  const pending: GameRenderState = { ...state(1), defenseMode: true, squad: { ...state(1).squad,
    reinforcement: { progress: 0, reinforcementSpacing: .72, reinforcementStagger: .18 } } };
  renderer.update(pending, 0);
  const members = scene.children.filter(child => child.getObjectByName('toy-soldier-body'));
  expect(members).toHaveLength(2); expect(members[1].position.z).toBeLessThan(-5);
  expect(members[1].getObjectByName('muzzle-flash')!.visible).toBe(false);
  renderer.update({ ...pending, squad: { ...pending.squad, reinforcement: { ...pending.squad.reinforcement!, progress: .5 } } }, 550);
  expect(members[1].position.z).toBeGreaterThan(-2);
  expect(members[1].getObjectByName('toy-rifle')!.rotation.x).toBeGreaterThan(0);
  const settled: GameRenderState = { ...pending, squad: { ...pending.squad, count: 2, rifleCounts: [2],
    reinforcement: { ...pending.squad.reinforcement!, progress: 1 } } };
  renderer.update(settled, 1100);
  expect(Math.abs(members[1].position.x - members[0].position.x)).toBeCloseTo(.72);
  expect(members[1].getObjectByName('toy-rifle')!.rotation.x).toBe(0);
  const shot = { id: 1, memberIndex: 0, lane: 2, kind: 'rifle' as const, tier: 1, x: -.36, z: 1, hitRadiusBonus: 0 };
  renderer.update({ ...settled, projectiles: [shot] }, 1200);
  expect(members[0].getObjectByName('muzzle-flash')!.visible).toBe(true);
  expect(members[1].getObjectByName('muzzle-flash')!.visible).toBe(false);
  renderer.update({ ...settled, projectiles: [{ ...shot, id: 2, memberIndex: 1 }] }, 1273);
  expect(members[0].getObjectByName('muzzle-flash')!.visible).toBe(false);
  expect(members[1].getObjectByName('muzzle-flash')!.visible).toBe(true);
  renderer.reset(); renderer.update(state(1), 2000); expect(renderer.getVisibleCount()).toBe(1);
  expect(members[0].getObjectByName('muzzle-flash')!.visible).toBe(false);
  renderer.dispose();
});
