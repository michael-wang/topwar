import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';

describe('rocket specialist rendering', () => {
  it('reuses squad pawns and shows a launcher only on the final rocket-role offsets', () => {
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 1, formationSpacing: 0.45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], gates: [], projectiles: [] };
    renderer.update(state);
    expect(scene.children).toHaveLength(2);
    const [rifle, rocket] = scene.children as THREE.Group[];
    expect(rifle.children[2].visible).toBe(false);
    expect(rocket.children[2].visible).toBe(true);
    renderer.update({ ...state, squad: { count: 1, rocketCount: 1, formationSpacing: 0.45 } });
    expect(scene.children).toEqual([rifle, rocket]);
    expect(rifle.visible).toBe(true);
    expect(rifle.children[2].visible).toBe(true);
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
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([true, true, false, false]);
    expect(rocket.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true]);
    const rocketBody = rocket.children[2] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(rocketBody.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(rocketBody.material as THREE.Material, 'dispose');
    renderer.update([{ id: 3, kind: 'rocket', x: 2, z: 3 }]);
    expect(scene.children).toEqual([rifle, rocket]);
    expect(rifle.visible).toBe(true);
    expect(rifle.children.map((mesh) => mesh.visible)).toEqual([false, false, true, true]);
    expect(rocket.visible).toBe(false);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
