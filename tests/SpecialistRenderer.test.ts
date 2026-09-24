import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
const soldiers = (scene: THREE.Scene) => scene.children.filter(
  (child): child is THREE.Group => child instanceof THREE.Group);

describe('rocket specialist rendering', () => {
  it('reuses squad pawns and shows a launcher only on the final rocket-role offsets', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, tier2RifleCount: 0, formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state);
    expect(soldiers(scene)).toHaveLength(2);
    const [rifle, rocket] = soldiers(scene);
    expect(rifle.children[7].visible).toBe(false);
    expect(rocket.children[7].visible).toBe(true);
    expect(rifle.children[6].visible).toBe(true);
    expect(rocket.children[6].visible).toBe(false);
    renderer.update({ ...state, squad: { count: 1, rocketCount: 1, tier2RifleCount: 0, formationSpacing: 0.45 } });
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
    renderer.update([{ id: 1, kind: 'rifle', x: 0, z: 1 }, { id: 2, kind: 'rocket', x: 1, z: 2 }]);
    expect(scene.children).toHaveLength(2);
    const [rifle, rocket] = scene.children as THREE.Group[];
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([true, true, false, false, false, false]);
    expect(rocket.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, true, true]);
    const rocketBody = rocket.children[4] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(rocketBody.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(rocketBody.material as THREE.Material, 'dispose');
    renderer.update([{ id: 3, kind: 'rocket', x: 2, z: 3 }]);
    expect(scene.children).toEqual([rifle, rocket]);
    expect(rifle.visible).toBe(true);
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, true, true]);
    expect(rocket.visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('renders one larger Tier-2 rifle body in deterministic role order', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 },
      squad: { count: 3, rocketCount: 1, tier2RifleCount: 1, formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state);
    const [rifle, heavy, rocket] = soldiers(scene);
    expect(soldiers(scene)).toHaveLength(3);
    expect(rifle.scale.x).toBeGreaterThan(1);
    expect(heavy.scale.x).toBeGreaterThan(1.85);
    expect(rocket.scale.x).toBeGreaterThan(1);
    expect((heavy.children[0] as THREE.Mesh).material).not.toBe((rifle.children[0] as THREE.Mesh).material);
    expect([rifle.children[7].visible, heavy.children[7].visible, rocket.children[7].visible])
      .toEqual([false, false, true]);
    renderer.update({ ...state, squad: { count: 1, rocketCount: 0, tier2RifleCount: 1,
      formationSpacing: 0.45 } });
    expect(soldiers(scene)).toHaveLength(3);
    expect(rifle.scale.x).toBeGreaterThan(1.85);
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
    renderer.update([{ id: 1, kind: 'rifle', x: 0, z: 1 },
      { id: 2, kind: 'heavyRifle', x: 1, z: 2 }, { id: 3, kind: 'rocket', x: 2, z: 3 }]);
    expect(scene.children).toHaveLength(3);
    const [rifle, heavy, rocket] = scene.children as THREE.Group[];
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([true, true, false, false, false, false]);
    expect(heavy.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true, false, false]);
    expect(rocket.children.map((mesh) => mesh.visible)).toEqual([false, false, false, false, true, true]);
    const heavyBody = heavy.children[2] as THREE.Mesh;
    expect((heavyBody.geometry as THREE.CylinderGeometry).parameters.radiusTop)
      .toBeGreaterThan(((rifle.children[0] as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters.radiusTop);
    const disposeGeometry = vi.spyOn(heavyBody.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(heavyBody.material as THREE.Material, 'dispose');
    renderer.update([{ id: 4, kind: 'heavyRifle', x: 0, z: 4 }]);
    expect(scene.children[0]).toBe(rifle);
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true, false, false]);
    expect(heavy.visible).toBe(false);
    renderer.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
