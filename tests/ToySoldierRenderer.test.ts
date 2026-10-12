import { gruntDeathBody } from '../src/presentation/GruntDeathBody';
import { playerFamily, enemyFamilies } from './characterModel';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyModel, grayBodyModel, runFrames, helmetModel, vestModel, rifleModel } from './characterModel';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ENEMY_GAIT_CYCLE_MS, EnemyRenderer, enemyRunFrame, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';

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

  it('uses authored three-soldier Defense formation without changing squad state', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    const four = { ...state(1),
      squad: { count: 3, rocketCount: 0, rifleCounts: [3], formationSpacing: .45, defenseFormation: { reinforcementSpacing: .72, reinforcementStagger: .18 } } };
    renderer.update(four, 400);
    const members = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    expect(members).toHaveLength(3);
    const xs = members.map((member) => member.position.x);
    expect(xs.map(x => x || 0)).toEqual([.36, 0, -.36]);
    expect(xs.every((x) => Math.abs(x) < four.track.halfWidth)).toBe(true);
    expect(four.squad.formationSpacing).toBe(.45);
    renderer.dispose();
  });

  it('grows crowd capacity, flashes gear, and captures intact grunts through ground blood, pale lift and fade', () => {
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
    const frozen=death.matrix.clone();
    renderer.update(damaged.slice(1), 150);
    expect(death.visible).toBe(true);const expected=new THREE.Matrix4();
    expected.copy(frozen);expected.elements[13]+=gruntDeathBody(50).lift;expect(death.matrix.equals(expected)).toBe(true);
    expect(((death.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity).toBe(1);
    renderer.update(damaged.slice(1), 280);expect(death.visible).toBe(true);
    expected.copy(frozen);expected.elements[13]+=gruntDeathBody(180).lift;expect(death.matrix.equals(expected)).toBe(true);
    expect(scene.getObjectByName('enemy-ground-blood-stains')!.visible).toBe(false);
    renderer.update(damaged.slice(1), 620);expect(death.visible).toBe(false);expect(scene.getObjectByName('enemy-ground-blood-stains')!.visible).toBe(true);
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
    renderer.update([], 330);
    expect(death.visible).toBe(true); expect(death.scale.x).toBeCloseTo(heavy.visualScaleX);
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
it('keeps tracer colors and blending stable over time and Retry', () => {
  const scene = new THREE.Scene(); const renderer = new ProjectileRenderer(scene);
  const shots = [{ id: 1, tier: 1, kind: 'rifle' as const, x: 0, z: 3, hitRadiusBonus: 0 }];
  renderer.update(shots, 0, projectileTestCamera, 844);
  const glow = scene.getObjectByName('tracer-glows') as THREE.InstancedMesh;
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(1);
  renderer.update(shots, 200, projectileTestCamera, 844);
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(1);
  renderer.update(shots, 1501, projectileTestCamera, 844); expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(1);
  renderer.reset(); renderer.update(shots, 1700, projectileTestCamera, 844);
  expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(1);
  renderer.dispose();
});

const projectileTestCamera = new THREE.PerspectiveCamera(48, 350/844, .1, 180);
