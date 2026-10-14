import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SupportAirstrikeRenderer } from '../src/rendering/SupportAirstrikeRenderer';
import { HeavyAirstrikeExplosion } from '../src/rendering/HeavyAirstrikeExplosion';
import type { GameRenderState } from '../src/rendering/RenderState';
import { emptyCommanderSupport } from '../src/simulation/commanderSupport';
import config from './helpers/ShippingConfig';

it('budgets compounded neutral smoke opacity while retaining the pooled 5.6-second lifetime and impact layers', () => {
  const scene = new THREE.Scene(), fx = new HeavyAirstrikeExplosion(scene);
  for (let i = 0; i < 9; i++) fx.present(i, (i % 3 - 1) * 2.8, 7 + Math.floor(i / 3) * 14, 0);
  const meshes = [...scene.children]; fx.update(150, 0);
  for (const name of ['core', 'fire', 'dust', 'shockwave']) expect(scene.getObjectByName(`airstrike-0-${name}`)!.visible).toBe(true);
  fx.update(600, 0);
  const smoke = scene.getObjectByName('airstrike-0-smoke') as THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  expect(smoke.count).toBe(8); expect(smoke.material.depthWrite).toBe(false);
  expect(1 - (1 - smoke.material.opacity) ** smoke.count).toBeLessThan(.45);
  const { r, g, b } = smoke.material.color;
  expect(Math.min(r, g, b)).toBeGreaterThan(.25); expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(.025);
  const pose = Array.from(smoke.instanceMatrix.array); fx.update(600, 0);
  expect(Array.from(smoke.instanceMatrix.array)).toEqual(pose); expect(scene.children).toEqual(meshes);
  fx.update(5599, 0); expect(smoke.visible).toBe(true); fx.update(5600, 0); expect(smoke.visible).toBe(false);
  fx.reset(); expect(scene.children.every(m => !m.visible)).toBe(true); fx.dispose(); expect(scene.children).toHaveLength(0);
});

it('rebuilds three heavy bombers and remaining smoke from saved clocks, freezes, resets and disposes its fixed resources once', () => {
  const scene = new THREE.Scene(), r = new SupportAirstrikeRenderer(scene), support = emptyCommanderSupport(true, true);
  Object.assign(support.airstrike!, { status: 'waiting', triggeredAtSeconds: 60, bombAtSeconds: 67.5, strikesCompleted: 1,
    tankZAtWarning: 38, impacts: [-4, 0, 4].map(x => ({ x, z: 7, atSeconds: 67.5 })) });
  const state: GameRenderState = { commanderSupport: { state: support, config: config.catharsis!.commanderSupport!, elapsedSeconds: 67.8 },
    player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 0, rifleCounts: [2], formationSpacing: 1 },
    track: { halfWidth: 5, defenseLineZ: 0, lanePositions: [-4, -2, 0, 2, 4] }, enemies: [], projectiles: [] };
  const objects = [...scene.children]; r.update(1000, state);
  expect(r.planes.map(p => p.visible)).toEqual([true, true, true]); expect(r.planes.map(p => p.position.x)).toEqual([3.45, 0, -3.45]);
  expect(r.planes[0].children[0]).toBeInstanceOf(THREE.Mesh);
  expect((r.planes[0].children[0] as THREE.Mesh).geometry).toBe((r.planes[2].children[0] as THREE.Mesh).geometry);
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(true);
  let previous = [-Infinity, -Infinity, -Infinity];
  for (const age of [1, 3.4, 6.5, 7.5, 8.15, 8.8, 9.45, 10.75, 16, 20]) {
    r.update(age * 1000, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 60 + age } });
    r.planes.forEach((p, i) => { expect(p.position.z).toBeGreaterThan(previous[i]); expect(Math.abs(p.rotation.y - Math.PI)).toBeLessThan(.06); previous[i] = p.position.z; });
  }
  r.reset(); r.update(1000, state);
  const pose = r.planes.map(p => [p.position.toArray(), p.rotation.toArray()]); for (let i = 0; i < 20; i++) r.update(1000, state);
  expect(r.planes.map(p => [p.position.toArray(), p.rotation.toArray()])).toEqual(pose); expect(scene.children).toEqual(objects);
  r.reset(); expect(r.planes.every(p => !p.visible)).toBe(true); r.update(1000, state);
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(true);
  r.update(7200, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 74 } });
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(false);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  const releases = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
  r.dispose(); expect(scene.children).toEqual([]); releases.forEach(release => expect(release).toHaveBeenCalledOnce());
});
