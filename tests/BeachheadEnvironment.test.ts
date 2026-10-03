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
  for (const halfWidth of [3.2, 4.2]) {
    environment.update(0, halfWidth, 0, true);
    scene.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const compound = scene.getObjectByName(`coastal-compound-${side}`)!;
      expect(compound.children.length).toBeGreaterThanOrEqual(5);
      for (const child of compound.children as THREE.Mesh[]) {
        if (child.name === 'coastal-shadow-forms') continue; // transparent ground patches may spill toward sand
        const bounds = new THREE.Box3().setFromObject(child);
        if (side === 'left') expect(bounds.max.x).toBeLessThan(-halfWidth - .4);
        else expect(bounds.min.x).toBeGreaterThan(halfWidth + .4);
        expect(bounds.min.z).toBeGreaterThan(3);
      }
    }
  }
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

it('removes static military wrecks from defense while retaining active fire and legacy wrecks', () => {
  const scene=new THREE.Scene(), environment=new BridgeEnvironment(scene);
  environment.update(0,3.2,0,true);
  expect(scene.getObjectByName('coastal-steel-forms')).toBeUndefined();
  expect(scene.getObjectByName('coastal-rust-forms')).toBeUndefined();
  for(const name of ['burning-wreck-base','burning-wreck-slab']) expect(scene.getObjectByName(name)!.visible).toBe(false);
  expect(scene.getObjectByName('burning-fire-core')!.visible).toBe(true);
  environment.update(0,3.2,0,false);
  for(const name of ['burning-wreck-base','burning-wreck-slab']) expect(scene.getObjectByName(name)!.visible).toBe(true);
  environment.dispose();
});
