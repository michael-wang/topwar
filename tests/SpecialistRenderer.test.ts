import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
const soldiers = (scene: THREE.Scene) => scene.children.filter(
  (child): child is THREE.Group => child instanceof THREE.Group);

describe('rocket specialist rendering', () => {
  it('renders equally sized rifle tiers with modestly increasing weapons and one pooled Tier-3 tracer', () => {
    const scene = new THREE.Scene();
    const squad = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 }, squad: { count: 4, rocketCount: 1,
      rifleCounts: [1, 1, 1], formationSpacing: 0.45 },
    track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null,
    streamRewards: [], gates: [], pickups: [], projectiles: [] };
    squad.update(state, 0);
    const [t1, t2, t3, rocket] = soldiers(scene);
    squad.update(state, 400);
    expect([t1.scale.x, t2.scale.x, t3.scale.x]).toEqual([1, 1, 1]);
    expect((t3.children[0] as THREE.Mesh).material).not.toBe((t2.children[0] as THREE.Mesh).material);
    expect((t1.children[0] as THREE.Mesh).material).not.toBe((t2.children[0] as THREE.Mesh).material);
    expect([t1.children[6].scale.x, t2.children[6].scale.x, t3.children[6].scale.x])
      .toEqual([1, 1.12, 1.25]);
    const anchors = [t1, t2, t3, rocket].map((member) => [member.position.x, member.position.z]);
    squad.update({ ...state, squad: { ...state.squad, rifleCounts: [3] } }, 410);
    expect([t1, t2, t3, rocket].map((member) => [member.position.x, member.position.z]))
      .toEqual(anchors);
    squad.update(state, 420);
    expect(rocket.children[7].visible).toBe(true);
    squad.update({ ...state, projectiles: [{ id: 1, kind: 'rifle' as const, tier: 3, x: 0, z: 1 }] }, 500);
    expect(t3.children[8].visible).toBe(true);
    expect((t3.children[6] as THREE.Mesh).position.z).toBeLessThan(0.38);
    squad.dispose();

    const projectileScene = new THREE.Scene();
    const projectileRenderer = new ProjectileRenderer(projectileScene);
    projectileRenderer.update([{ id: 1, kind: 'rifle', tier: 3, x: 0, z: 1 }], 0);
    const tracer = projectileScene.children[0] as THREE.Group;
    expect(tracer.children.map((mesh) => mesh.visible)).toEqual([
      false, false, false, false, true, true, false, false]);
    expect(((tracer.children[4] as THREE.Mesh).geometry as THREE.CylinderGeometry)
      .parameters.radiusTop).toBeGreaterThan(0.17);
    projectileRenderer.update([{ id: 1, kind: 'rifle', tier: 3, x: 0, z: 2 }], 100);
    expect(tracer.scale.x).toBe(1);
    projectileRenderer.dispose();
    expect(projectileScene.children).toHaveLength(0);
  });
  it('reuses squad pawns and shows a launcher only on the final rocket-role offsets', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, rifleCounts: [1], formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state, 0);
    expect(soldiers(scene)).toHaveLength(2);
    const [rifle, rocket] = soldiers(scene);
    expect(rifle.children[7].visible).toBe(false);
    expect(rocket.children[7].visible).toBe(true);
    expect(rifle.children[6].visible).toBe(true);
    expect(rocket.children[6].visible).toBe(false);
    renderer.update({ ...state, squad: { count: 1, rocketCount: 1, rifleCounts: [], formationSpacing: 0.45 } });
    expect(soldiers(scene)).toEqual([rifle, rocket]);
    expect(rifle.visible).toBe(true);
    expect(rifle.children[7].visible).toBe(true);
    expect(rocket.visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('reuses projectile visuals and switches between rifle tracer and larger rocket', () => {
    const scene = new THREE.Scene();
    const renderer = new ProjectileRenderer(scene);
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1 }, { id: 2, kind: 'rocket', tier: 0, x: 1, z: 2 }]);
    expect(scene.children).toHaveLength(2);
    const [rifle, rocket] = scene.children as THREE.Group[];
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([true, true, false, false, false, false, false, false]);
    expect(rocket.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, false, false, true, true]);
    const rocketBody = rocket.children[6] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(rocketBody.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(rocketBody.material as THREE.Material, 'dispose');
    renderer.update([{ id: 3, kind: 'rocket', tier: 0, x: 2, z: 3 }]);
    expect(scene.children).toEqual([rifle, rocket]);
    expect(rifle.visible).toBe(true);
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, false, false, true, true]);
    expect(rocket.visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('renders Tier-2 color and rifle identity in deterministic role order', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 },
      squad: { count: 3, rocketCount: 1, rifleCounts: [1, 1], formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state, 0);
    const [rifle, heavy, rocket] = soldiers(scene);
    expect(soldiers(scene)).toHaveLength(3);
    renderer.update(state, 400);
    expect([rifle.scale.x, heavy.scale.x, rocket.scale.x]).toEqual([1, 1, 1]);
    expect((heavy.children[0] as THREE.Mesh).material).not.toBe((rifle.children[0] as THREE.Mesh).material);
    expect([rifle.children[7].visible, heavy.children[7].visible, rocket.children[7].visible])
      .toEqual([false, false, true]);
    renderer.update({ ...state, squad: { count: 1, rocketCount: 0, rifleCounts: [0, 1],
      formationSpacing: 0.45 } }, 500);
    expect(soldiers(scene)).toHaveLength(3);
    expect(rifle.scale.x).toBe(1);
    expect(rifle.children[6].scale.x).toBe(1.12);
    expect(heavy.visible).toBe(false);
    expect(rocket.visible).toBe(false);
    const disposeHeavy = vi.spyOn((rifle.children[0] as THREE.Mesh).material as THREE.Material, 'dispose');
    renderer.dispose();
    expect(disposeHeavy).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });

  it('uses one pooled visual for each heavy projectile and disposes heavy resources', () => {
    const scene = new THREE.Scene();
    const renderer = new ProjectileRenderer(scene);
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1 },
      { id: 2, kind: 'rifle', tier: 2, x: 1, z: 2 }, { id: 3, kind: 'rocket', tier: 0, x: 2, z: 3 }]);
    expect(scene.children).toHaveLength(3);
    const [rifle, heavy, rocket] = scene.children as THREE.Group[];
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([true, true, false, false, false, false, false, false]);
    expect(heavy.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true, false, false, false, false]);
    expect(rocket.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, false, false, true, true]);
    const heavyBody = heavy.children[2] as THREE.Mesh;
    expect((heavyBody.geometry as THREE.CylinderGeometry).parameters.radiusTop)
      .toBeGreaterThan(((rifle.children[0] as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters.radiusTop);
    const disposeGeometry = vi.spyOn(heavyBody.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(heavyBody.material as THREE.Material, 'dispose');
    renderer.update([{ id: 4, kind: 'rifle', tier: 2, x: 0, z: 4 }]);
    expect(scene.children[0]).toBe(rifle);
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true, false, false, false, false]);
    expect(heavy.visible).toBe(false);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
