import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyModel, grayBodyModel, runFrames, helmetModel, vestModel, rifleModel, bulletModel } from './characterModel';
import { ENEMY_PALETTE, PLAYER_PALETTE, paletteIndex } from '../src/rendering/tierPalettes';
import { PLAYER_VISUAL_SCALE, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ENEMY_VISUAL_SCALE, EnemyRenderer, enemyRunFrame, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
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
  it('cycles baked running poses by enemy id while preserving gentle body motion', () => {
    expect(new Set([0, 125, 250, 375].map((time) => enemyRunFrame(7, time))).size).toBe(4);
    expect(enemyRunFrame(7, 0)).not.toBe(enemyRunFrame(8, 0));
    expect(enemyWalkPose(7, 0).bob).toBeGreaterThanOrEqual(0);
    expect(enemyWalkPose(7, 125).leftArm).not.toBe(enemyWalkPose(7, 0).leftArm);
  });

  it('keeps helmet and vest blue through Tier 20 while rifle stays charcoal', () => {
    expect(PLAYER_PALETTE.map((entry) => entry.body)).toEqual([
      '#1769ee', '#10429b', '#2938c7', '#1b8fd6', '#5d5ee8',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const rifle = rifleModel();
    const renderer = new SquadRenderer(scene, body, helmetModel(), vestModel(), rifle);
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
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), vestModel(), rifleModel());
    renderer.update(state(1), 0);
    expect(soldier(scene).scale.x).toBeCloseTo(PLAYER_VISUAL_SCALE * 1.35);
    renderer.update(state(1), 400);
    expect(soldier(scene).scale.x).toBe(PLAYER_VISUAL_SCALE);
    renderer.update({ ...state(1), projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1 }] }, 500);
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

  it('separates four rendered soldiers without changing squad state or road bounds', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), vestModel(), rifleModel());
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
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), vestModel(), rifleModel());
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
      '#ef5b52', '#f47a3c', '#e6b83f', '#a66be8', '#e94f8a', '#9fbe45',
    ]);
    const scene = new THREE.Scene();
    const body = bodyModel();
    const renderer = new EnemyRenderer(scene, body, helmetModel(), vestModel(),
      runFrames(), grayBodyModel());
    const families = () => scene.children.filter((child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh);
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

  it('grows crowd capacity, flashes gear, and pops out fallen grunts', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, bodyModel(), helmetModel(), vestModel(),
      runFrames(), grayBodyModel());
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
    expect(color.getHexString()).toBe('ffe36e');
    helmet.getColorAt(1, color);
    expect(color.getHexString()).toBe('e94f8a');
    renderer.update(damaged.slice(1), 100);
    const death = scene.children.find((child) => child instanceof THREE.Group && child.visible) as THREE.Group;
    expect(death).toBeDefined();
    expect(death.rotation.z).toBe(0);
    renderer.update(damaged.slice(1), 180);
    expect(death.position.y).toBeGreaterThan(0);
    const gray = (death.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(gray.color.getHexString()).toBe('aeb4b7');
    expect(gray.opacity).toBeLessThan(1);
    expect(((death.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color
      .getHexString()).toBe('adb4b8');
    renderer.update(damaged.slice(1), 500);
    expect(death.visible).toBe(false);
    renderer.reset();
    renderer.dispose();
  });

  it('uses a distinct contact exchange for only the attacking grunt', () => {
    const scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, bodyModel(), helmetModel(), vestModel(),
      runFrames(), grayBodyModel());
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
      .color.getHexString()).toBe('fff47d');
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
    const renderer = new BossRenderer(scene, body, helmetModel(), vestModel(),
      runFrames(), [body, body, body, body]);
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
    expect(barAnchor.position.y).toBeGreaterThan(1.25);
    expect(barAnchor.position.y - .28 * barAnchor.scale.y / 2).toBeGreaterThan(1.2);
    expect(barAnchor.scale.x).toBeCloseTo(.32);
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
    renderer.update(null, 20020);
    expect(death.visible).toBe(true);
    const deathHelmet = death.children[1] as THREE.Mesh;
    expect(deathHelmet.geometry).toBe(helmet.geometry);
    expect(deathHelmet.scale.x).toBeCloseTo(helmet.scale.x);
    expect(deathHelmet.position.y).toBeCloseTo(helmet.position.y);
    expect(deathHelmet.position.z).toBeCloseTo(helmet.position.z);
    renderer.update(null, 20420);
    expect(death.rotation.z).toBeLessThan(Math.PI / 2);
    renderer.update(null, 21000);
    expect(death.visible).toBe(false);
    renderer.reset();
    renderer.dispose();
  });

  it('keeps ballistic plates Tier-colored and tactical details charcoal in one Boss mesh', () => {
    const scene = new THREE.Scene();
    const body = bodyModel();
    const vest = vestModel();
    const factors = new Float32Array(vest.geometry.getAttribute('position').count * 3).fill(1);
    factors.fill(.6, 0, 3);
    vest.geometry.setAttribute('color', new THREE.BufferAttribute(factors, 3));
    const renderer = new BossRenderer(scene, body, helmetModel(), vest, runFrames(), runFrames());
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
    const renderer = new BossRenderer(scene, body, helmetModel(), vestModel(), walks, frames);
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
    const renderer = new BossRenderer(scene, body, helmetModel(), vestModel(), walks,
      runFrames());
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
    const renderer = new BossRenderer(scene, body, helmetModel(), vestModel(), runFrames(), runFrames());
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
    for (let tier = 1; tier <= 20; tier++) {
      renderer.update([{ id: tier, kind: 'rifle', tier, x: 0, z: 10 }], tier * 1000);
      expect(scene.children).toHaveLength(1);
      const mesh = scene.children[0] as THREE.Mesh;
      expect(mesh.name).toBe('rifle-tracer');
      expect(mesh.geometry).toBe(bullet.geometry);
      const glow = mesh.getObjectByName('tracer-glow') as THREE.Mesh;
      expect(glow.geometry).toBe(bullet.geometry);
      expect((glow.material as THREE.MeshBasicMaterial).blending).toBe(THREE.AdditiveBlending);
      expect(mesh.scale.x).toBe(1);
      expect(mesh.scale.z).toBeLessThanOrEqual(1.35 * 1.35);
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
