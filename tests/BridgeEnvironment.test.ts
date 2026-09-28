import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

describe('BridgeEnvironment', () => {
  it('keeps a wide bridge, water, barriers, and distant vista around the advancing player', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const deck = scene.getObjectByName('bridge-deck') as THREE.Mesh;
    const water = scene.getObjectByName('bridge-ocean') as THREE.Mesh;
    const left = scene.getObjectByName('bridge-barrier--1') as THREE.Mesh;
    const right = scene.getObjectByName('bridge-barrier-1') as THREE.Mesh;
    const horizon = scene.getObjectByName('battlefield-horizon') as THREE.Group;
    expect(deck).toBeDefined();
    expect(water).toBeDefined();
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(water.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(deck.scale.x / 2).toBeGreaterThan(3.2);
    expect(Math.abs(left.position.x) - .12).toBeGreaterThan(3.6);
    expect(right.position.x - .12).toBeGreaterThan(3.6);
    expect(horizon.children.filter((child) => child.name === 'battlefield-ruin').length)
      .toBeGreaterThan(0);

    const joint = scene.getObjectByName('bridge-expansion-joint') as THREE.Mesh;
    const firstJointZ = joint.position.z;
    environment.update(65, 3, 1000);
    expect(deck.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(water.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(deck.getWorldPosition(new THREE.Vector3()).z + 150).toBeGreaterThan(65 + 90);
    expect(joint.position.z).toBeGreaterThan(firstJointZ);
    expect(horizon.position.z).toBe(143);
    expect(horizon.position.z).toBeGreaterThan(65);

    const disposeGeometry = vi.spyOn(deck.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(deck.material as THREE.Material, 'dispose');
    environment.dispose();
    expect(scene.getObjectByName('bridge-deck')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-horizon')).toBeUndefined();
    expect(scene.getObjectByName('bridge-expansion-joint')).toBeUndefined();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
