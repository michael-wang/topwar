import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BATTLEFIELD_FOG_COLOR, BATTLEFIELD_FOG_FAR, BATTLEFIELD_FOG_NEAR,
  BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

describe('BridgeEnvironment', () => {
  it('keeps a wide bridge, water, barriers, and distant vista around the advancing player', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const deck = scene.getObjectByName('bridge-deck') as THREE.Mesh;
    const water = scene.getObjectByName('bridge-ocean') as THREE.Mesh;
    const left = scene.getObjectByName('bridge-barrier--1') as THREE.Mesh;
    const right = scene.getObjectByName('bridge-barrier-1') as THREE.Mesh;
    const near = scene.getObjectByName('battlefield-near') as THREE.Group;
    const mid = scene.getObjectByName('battlefield-mid') as THREE.Group;
    const far = scene.getObjectByName('battlefield-far') as THREE.Group;
    expect(deck).toBeDefined();
    expect(water).toBeDefined();
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(water.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(deck.scale.x / 2).toBeGreaterThan(3.2);
    expect(Math.abs(left.position.x) - .12).toBeGreaterThan(3.6);
    expect(right.position.x - .12).toBeGreaterThan(3.6);
    expect(near).toBeDefined();
    expect(mid).toBeDefined();
    expect(far).toBeDefined();
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    const fog = scene.fog as THREE.Fog;
    expect(fog.color.equals(scene.background as THREE.Color)).toBe(true);
    expect(fog.color.getHexString()).toBe(new THREE.Color(BATTLEFIELD_FOG_COLOR).getHexString());
    expect(fog.near).toBe(BATTLEFIELD_FOG_NEAR);
    expect(fog.far).toBe(BATTLEFIELD_FOG_FAR);
    expect(fog.near).toBeGreaterThan(40); // reward and normal combat remain clear
    expect((10 + 96 - fog.near) / (fog.far - fog.near)).toBeGreaterThan(.85);

    const firstRuin = (layer: THREE.Group) =>
      layer.children.find((child) => child.name === 'battlefield-ruin') as THREE.Mesh;
    const nearRuin = firstRuin(near);
    const farRuin = firstRuin(far);
    expect(nearRuin.scale.x * nearRuin.scale.y)
      .toBeGreaterThan(farRuin.scale.x * farRuin.scale.y);
    const nearColor = (nearRuin.material as THREE.MeshStandardMaterial).color;
    const farColor = (farRuin.material as THREE.MeshStandardMaterial).color;
    expect(nearColor.getHSL({ h: 0, s: 0, l: 0 }).l)
      .toBeLessThan(farColor.getHSL({ h: 0, s: 0, l: 0 }).l);
    for (const layer of [near, mid, far]) {
      expect(layer.children.some((child) => child.name === 'battlefield-smoke')).toBe(true);
    }
    expect(mid.children.filter((child) => child.name === 'battlefield-fire-glow'))
      .toHaveLength(2);

    const joint = scene.getObjectByName('bridge-expansion-joint') as THREE.Mesh;
    const firstJointZ = joint.position.z;
    environment.update(65, 3, 1000);
    expect(deck.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(water.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(deck.getWorldPosition(new THREE.Vector3()).z + 150).toBeGreaterThan(65 + 90);
    expect(joint.position.z).toBeGreaterThan(firstJointZ);
    expect(near.position.z).toBe(127);
    expect(mid.position.z).toBe(144);
    expect(far.position.z).toBe(157);
    expect(near.position.z).toBeLessThan(mid.position.z);
    expect(mid.position.z).toBeLessThan(far.position.z);

    const disposeGeometry = vi.spyOn(deck.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(deck.material as THREE.Material, 'dispose');
    environment.dispose();
    expect(scene.getObjectByName('bridge-deck')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-near')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-mid')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-far')).toBeUndefined();
    expect(scene.getObjectByName('bridge-expansion-joint')).toBeUndefined();
    expect(scene.fog).toBeNull();
    expect(scene.background).toBeNull();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
