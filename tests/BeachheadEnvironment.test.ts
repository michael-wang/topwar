import { expect, it } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';
import { AttackLaneRenderer } from '../src/rendering/AttackLaneRenderer';

it('hides bridge road/rails/joints and presents sand, shore and fixed corridor openings', () => {
  const scene = new THREE.Scene();
  const environment = new BridgeEnvironment(scene);
  const lanes = new AttackLaneRenderer(scene);
  environment.update(0, 3.2, 0, true);
  lanes.update([-2.8, -1.4, 0, 1.4, 2.8], 0, 0, true);
  expect(scene.getObjectByName('bridge-deck')!.parent!.visible).toBe(false);
  expect(scene.getObjectByName('bridge-expansion-joint')!.visible).toBe(false);
  expect(scene.getObjectByName('stationary-defense-beach')!.visible).toBe(true);
  expect(scene.getObjectByName('defense-sand')).toBeDefined();
  expect(scene.getObjectByName('defense-sea')).toBeDefined();
  expect(scene.getObjectByName('shoreline-foam')).toBeDefined();
  expect(scene.getObjectByName('attack-corridors')!.visible).toBe(false);
  const openings = scene.getObjectByName('beach-corridor-openings')!;
  const before = openings.children.map((child) => child.position.clone());
  environment.update(0, 3.2, 10000, true);
  lanes.update([-2.8, -1.4, 0, 1.4, 2.8], 0, 2.8, true);
  expect(openings.children.map((child) => child.position)).toEqual(before);
  lanes.dispose();
  environment.dispose();
  expect(scene.children).toHaveLength(0);
});
