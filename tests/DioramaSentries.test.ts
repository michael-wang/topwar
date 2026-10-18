import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DioramaSentries } from '../src/rendering/squad/DioramaSentries';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { CoastalForeground } from '../src/rendering/environment/CoastalForeground';
import { CoastalArchitecture } from '../src/rendering/environment/CoastalArchitecture';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';

it.each([350, 390])('hides both sentries behind permanent facades before removal at %spx', width => {
  const family = createChibiPlayerFamily(), scene = new THREE.Scene();
  const sentries = new DioramaSentries(scene, family);
  const foreground = new CoastalForeground(), architecture = new CoastalArchitecture();
  foreground.update(3.2); architecture.update(3.2);
  scene.add(foreground.group, architecture.group);
  const camera = new THREE.PerspectiveCamera(48, width / 844, .1, 180); applyCoastalCamera(camera);
  sentries.update(3.2, .99); scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const guard of sentries.group.children) {
    const bounds = new THREE.Box3().setFromObject(guard);
    for (const x of [bounds.min.x, (bounds.min.x + bounds.max.x) / 2, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        const point = new THREE.Vector3(x, y, bounds.min.z), screen = point.clone().project(camera);
        if (Math.abs(screen.x) > 1 || Math.abs(screen.y) > 1) continue;
        ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
        const hit = ray.intersectObjects([foreground.group, architecture.group], true)[0];
        expect(hit, 'visible sentry point must be behind a facade').toBeDefined();
        expect(hit.distance).toBeLessThan(camera.position.distanceTo(point));
      }
    }
  }
  const geometryDispose = vi.spyOn(family.body.geometry, 'dispose');
  sentries.update(3.2, 1); expect(sentries.group.visible).toBe(false);
  sentries.update(3.2, 0); expect(sentries.group.visible).toBe(true);
  expect(sentries.group.children).toHaveLength(2);
  sentries.dispose(); expect(geometryDispose).not.toHaveBeenCalled();
  foreground.dispose(); architecture.dispose(); family.dispose();
});

it('hands the central idle soldier to real gameplay without a spawn-scale pop', () => {
  const family = createChibiPlayerFamily(), scene = new THREE.Scene(), squad = new SquadRenderer(scene, family);
  const state: GameRenderState = { defenseMode: true, player: { x: 0, z: 0, selectedLane: 2 },
    squad: { count: 1, rifleCounts: [1], rocketCount: 0, formationSpacing: .45 },
    track: { halfWidth: 3.2, defenseLineZ: -1.5 }, enemies: [], projectiles: [] };
  squad.updateIdle(state, 1200);
  const player = scene.getObjectByName('toy-soldier-helmet')!.parent!;
  const position = player.position.clone(), scale = player.scale.clone();
  squad.reset(); squad.continueIdlePlayer(); squad.update(state, 0);
  expect(player.position).toEqual(position); expect(player.scale).toEqual(scale);
  expect(squad.getVisibleCount()).toBe(1);
  squad.dispose(); family.dispose();
});
