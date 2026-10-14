import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BattlefieldLaneHighlights } from '../src/rendering/BattlefieldLaneHighlights';
import { makeArtilleryShell } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
import type { GameRenderState } from '../src/rendering/RenderState';

const lanes = [-2.8, -1.4, 0, 1.4, 2.8];
const shell = (id: number, targetLane: number, type: 'destroyer' | 'defenseTank' = 'destroyer') =>
  makeArtilleryShell(id, { source: { id: 'test', type, position: { x: 0, y: 2, z: 40 } } },
    targetLane, lanes, 0, 0, artilleryDefaults, .588);
const state = (): GameRenderState => ({ defenseMode: true, player: { x: 0, z: 0, selectedLane: 2 },
  squad: { count: 1, rocketCount: 0, rifleCounts: [1], formationSpacing: .45 },
  track: { halfWidth: 3.2, defenseLineZ: -1.5, lanePositions: lanes }, enemies: [], projectiles: [],
  artillery: { shells: [], elapsedSeconds: 0 } });
function setup() {
  const scene = new THREE.Scene(), renderer = new BattlefieldLaneHighlights(scene);
  const mesh = scene.getObjectByName('battlefield-lane-highlights') as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  return { scene, renderer, mesh, u: mesh.material.uniforms };
}

it('follows physical X through lane transitions without snapping to the selected lane or mutating state', () => {
  const { renderer, mesh, u } = setup();
  const s = { ...state(), player: { x: .43, z: 0, selectedLane: 3 } }, before = structuredClone(s);
  renderer.update(s);
  expect(u.playerX.value).toBe(-.43); expect(u.dangerCount.value).toBe(0); expect(mesh.visible).toBe(true);
  renderer.update({ ...s, player: { ...s.player, x: 1.1 } }); expect(u.playerX.value).toBe(-1.1);
  expect(s).toEqual(before); renderer.dispose();
});

it('shows both sources immediately, deduplicates lanes and keeps danger until the final shell resolves/cancels', () => {
  const { renderer, u } = setup(), s = state();
  const a = shell(1, 0), b = shell(2, 0, 'defenseTank'), c = shell(3, 4, 'defenseTank');
  const draw = (shells: ReturnType<typeof shell>[]) => renderer.update({ ...s, artillery: { shells, elapsedSeconds: 0 } });
  draw([a,b,c]); expect(u.dangerCount.value).toBe(2);
  expect(Array.from(u.dangerCenters.value.slice(0,2))).toEqual([expect.closeTo(2.8),expect.closeTo(-2.8)]);
  draw([b,c]); expect(u.dangerCount.value).toBe(2);
  draw([c]); expect(u.dangerCount.value).toBe(1); expect(u.dangerCenters.value[0]).toBeCloseTo(-2.8);
  draw([]); expect(u.dangerCount.value).toBe(0); renderer.dispose();
});

it('reconstructs identical highlights from restored data and freezes with paused state, without retained shell history', () => {
  const { renderer, mesh, u } = setup(), s = { ...state(), artillery: { shells: [shell(1,2)], elapsedSeconds: 1 } };
  renderer.update(s); mesh.updateMatrix(); const matrix = mesh.matrix.clone();
  renderer.update(s); mesh.updateMatrix(); expect(mesh.matrix.elements).toEqual(matrix.elements);
  expect(u.dangerCount.value).toBe(1);
  renderer.reset(); expect(mesh.visible).toBe(false); expect(u.dangerCount.value).toBe(0);
  renderer.update(JSON.parse(JSON.stringify(s))); mesh.updateMatrix();
  expect(mesh.matrix.elements).toEqual(matrix.elements); expect(u.dangerCount.value).toBe(1);
  renderer.update(state()); expect(u.dangerCount.value).toBe(0); renderer.dispose();
});

it('keeps one reusable ground draw and releases resources, with no firing highlight on death or Victory', () => {
  const { renderer, scene, mesh, u } = setup();
  renderer.update({ ...state(), squad: { ...state().squad, count: 0 } }); expect(mesh.visible).toBe(false);
  const s = { ...state(), defenseTank: { state: { status: 'defeated' } } } as GameRenderState;
  renderer.update(s); expect(u.playerActive.value).toBe(0); expect(mesh.visible).toBe(false);
  renderer.update(state()); expect(scene.children).toEqual([mesh]); expect(mesh.geometry.attributes.position.count).toBe(4);
  expect(mesh.material.depthWrite).toBe(false); expect(mesh.material.depthTest).toBe(true);
  const geometry = vi.spyOn(mesh.geometry,'dispose'), material = vi.spyOn(mesh.material,'dispose');
  renderer.dispose(); expect(scene.children).toHaveLength(0); expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
});
