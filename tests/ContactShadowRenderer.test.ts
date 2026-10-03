import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ContactShadowRenderer } from '../src/rendering/ContactShadowRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';
import type { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { BOSS_DEATH_MS } from '../src/presentation/BossDeathTiming';

const squad = {
  presentation: { shadow: { width: .72, depth: .43 } },
  forEachVisibleMemberPosition(visit: (position: THREE.Vector3) => void) {
    visit(new THREE.Vector3(-.3, 0, 2));
    visit(new THREE.Vector3(.3, 0, 2));
  },
} as unknown as SquadRenderer;

function state(): GameRenderState {
  return {
    player: { x: 0, z: 2 },
    squad: { count: 2, rocketCount: 0, rifleCounts: [2], formationSpacing: .45 },
    track: { halfWidth: 3.2, defenseLineZ: 0 },
    enemies: [{ id: 1, tier: 1, x: 1.5, z: 8, hp: 1 }],
    boss: { id: 2, tier: 1, x: -.8, z: 15, hp: 10, maxHp: 10,
      visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 1, slamCount: 0 },
    streamRewards: [{ id: 3, tier: 1, x: 3.2, z: 6, hitProgress: 0, hitsRequired: 10 }],
    projectiles: [], gates: [], pickups: [],
  };
}

describe('soft contact shadows', () => {
  it('uses enemy width/depth proportions without making height inflate the footprint', () => {
    const scene = new THREE.Scene();
    const shadows = new ContactShadowRenderer(scene);
    const frame = state();
    shadows.update({ ...frame, enemies: [{ ...frame.enemies[0], visualScale: 1.89,
      visualScaleX: 1.9845, visualScaleY: 2.1735, visualScaleZ: 2.1735 }] }, squad, 0);
    const mesh = scene.getObjectByName('contact-shadow-enemy') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(.68 * 1.9845 / .82);
    expect(scale.z).toBeCloseTo(.42 * 2.1735 / .82);
    expect(scale.y).toBe(1);
    shadows.dispose();
  });
  it('grounds player, enemies, Boss, and rewards with one reusable soft stamp', () => {
    const scene = new THREE.Scene();
    const shadows = new ContactShadowRenderer(scene);
    const kinds = ['player', 'enemy', 'boss', 'reward'] as const;
    const meshes = kinds.map((kind) =>
      scene.getObjectByName(`contact-shadow-${kind}`) as THREE.InstancedMesh);
    expect(meshes.every(Boolean)).toBe(true);
    expect(meshes.every((mesh) => mesh.material === meshes[0].material
      && mesh.geometry === meshes[0].geometry)).toBe(true);
    const material = meshes[0].material as THREE.MeshBasicMaterial;
    const texture = material.map as THREE.DataTexture;
    const alpha = texture.image.data as Uint8Array;
    expect(alpha[(16 * 32 + 16) * 4 + 3]).toBeGreaterThan(alpha[3]);
    expect(material.opacity).toBeLessThan(.35);
    const frame = state();
    shadows.update(frame, squad, 0);
    expect(meshes.map((mesh) => mesh.count)).toEqual([2, 1, 1, 1]);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    meshes[1].getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(position.x).toBeCloseTo(-1.5);
    expect(position.z).toBe(8);
    expect(position.y).toBeGreaterThan(0);
    const soldierWidth = scale.x;
    meshes[2].getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(scale.x).toBeGreaterThan(soldierWidth * 4);
    meshes[3].getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(position.x).toBeCloseTo(-3.2);
    expect(position.z).toBe(6);
    expect(meshes.every((mesh) => !mesh.castShadow && !mesh.receiveShadow)).toBe(true);
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const disposeTexture = vi.spyOn(texture, 'dispose');
    const disposeGeometry = vi.spyOn(meshes[0].geometry, 'dispose');
    shadows.update(frame, squad, 100);
    expect(kinds.map((kind) => scene.getObjectByName(`contact-shadow-${kind}`)))
      .toEqual(meshes);
    shadows.reset();
    expect(meshes.every((mesh) => mesh.count === 0)).toBe(true);
    shadows.dispose();
    expect(kinds.every((kind) => !scene.getObjectByName(`contact-shadow-${kind}`))).toBe(true);
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeTexture).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce();
  });

  it('grows only when crowd capacity is exceeded and keeps batches bounded', () => {
    const scene = new THREE.Scene();
    const shadows = new ContactShadowRenderer(scene);
    let frame = state();
    const first = scene.getObjectByName('contact-shadow-enemy') as THREE.InstancedMesh;
    const material = first.material;
    frame = { ...frame, enemies: Array.from({ length: 40 }, (_, id) =>
      ({ id, tier: 1, x: 0, z: id + 8, hp: 1 })) };
    shadows.update(frame, squad, 0);
    const grown = scene.getObjectByName('contact-shadow-enemy') as THREE.InstancedMesh;
    expect(grown).not.toBe(first);
    expect(grown.count).toBe(40);
    expect(grown.material).toBe(material);
    shadows.update(frame, squad, 100);
    expect(scene.getObjectByName('contact-shadow-enemy')).toBe(grown);
    expect(scene.children.filter((child) => child.name.startsWith('contact-shadow-')))
      .toHaveLength(4);
    shadows.dispose();
  });

  it('keeps the Boss grounded through its visible corpse, then clears on Retry', () => {
    const scene = new THREE.Scene();
    const shadows = new ContactShadowRenderer(scene);
    let frame = state();
    const bossShadow = scene.getObjectByName('contact-shadow-boss') as THREE.InstancedMesh;
    shadows.update(frame, squad, 1000);
    frame = { ...frame, boss: null };
    shadows.update(frame, squad, 1016);
    expect(bossShadow.count).toBe(1);
    shadows.update(frame, squad, 1016 + BOSS_DEATH_MS - 1);
    expect(bossShadow.count).toBe(1);
    shadows.update(frame, squad, 1016 + BOSS_DEATH_MS);
    expect(bossShadow.count).toBe(0);
    frame = { ...frame, boss: state().boss };
    shadows.update(frame, squad, 4000);
    expect(bossShadow.count).toBe(1);
    shadows.reset();
    expect(bossShadow.count).toBe(0);
    frame = { ...frame, boss: null };
    shadows.update(frame, squad, 5000);
    expect(bossShadow.count).toBe(0);
    shadows.dispose();
  });
});
