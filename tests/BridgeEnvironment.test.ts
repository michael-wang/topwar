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
    const beachhead = scene.getObjectByName('enemy-beachhead-horizon') as THREE.Group;
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
    expect(beachhead).toBeDefined();
    environment.update(0, 3.2, 0);
    expect(deck.scale.x / 2).toBeCloseTo(4.2);
    expect(right.position.x - .12 - 3.2).toBeGreaterThanOrEqual(.7);
    expect(deck.scale.x / 2 - (3.2 + .3)).toBeGreaterThan(.6);
    expect(beachhead.position.z - far.position.z).toBeGreaterThan(20);
    expect(beachhead.position.z + 10).toBeLessThan(180);
    for (const name of ['beachhead-crane', 'beachhead-transport',
      'beachhead-control-tower']) {
      expect(beachhead.getObjectByName(name)).toBeDefined();
    }
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    camera.position.set(0, 6.5, -10);
    camera.lookAt(0, 0, 12.5);
    camera.updateMatrixWorld();
    beachhead.updateMatrixWorld(true);
    const upperShapes = [
      ...beachhead.children.filter((child) => child.name === 'beachhead-crane')
        .slice(0, 2).map((crane) => crane.getObjectByName('crane-boom')!),
      beachhead.getObjectByName('tower-cab')!,
    ];
    expect(upperShapes.every((shape) => {
      const projected = shape.getWorldPosition(new THREE.Vector3()).project(camera);
      return Math.abs(projected.x) < .9 && projected.y > .45 && projected.y < 1;
    })).toBe(true);
    const ghost = beachhead.getObjectByName('crane-boom') as THREE.Mesh;
    const ghostMaterial = ghost.material as THREE.MeshBasicMaterial;
    expect(ghostMaterial.fog).toBe(false);
    expect(ghostMaterial.opacity).toBeGreaterThan(.15);
    expect(ghostMaterial.opacity).toBeLessThan(.36);
    const fogColor = new THREE.Color(BATTLEFIELD_FOG_COLOR);
    expect(Math.abs(ghostMaterial.color.r - fogColor.r)
      + Math.abs(ghostMaterial.color.g - fogColor.g)
      + Math.abs(ghostMaterial.color.b - fogColor.b)).toBeLessThan(.8);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    const fog = scene.fog as THREE.Fog;
    expect(fog.color.equals(scene.background as THREE.Color)).toBe(true);
    expect(fog.color.getHexString()).toBe(new THREE.Color(BATTLEFIELD_FOG_COLOR).getHexString());
    expect(fog.near).toBe(BATTLEFIELD_FOG_NEAR);
    expect(fog.far).toBe(BATTLEFIELD_FOG_FAR);
    expect(fog.near).toBeGreaterThan(65);
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
    const smokeColor = (layer: THREE.Group) => ((layer.children.find((child) =>
      child.name === 'battlefield-smoke') as THREE.Sprite).material as THREE.SpriteMaterial).color;
    expect(smokeColor(near).getHSL({ h: 0, s: 0, l: 0 }).l)
      .toBeLessThan(smokeColor(far).getHSL({ h: 0, s: 0, l: 0 }).l);
    const burningSites = mid.children.filter((child) => child.name === 'battlefield-burning-site');
    expect(burningSites).toHaveLength(2);
    for (const site of burningSites) {
      expect(site.getObjectByName('burning-wreck-base')).toBeDefined();
      expect(site.getObjectByName('burning-fire-core')).toBeDefined();
      expect(site.getObjectByName('battlefield-fire-glow')).toBeDefined();
      expect(site.getObjectByName('burning-black-smoke')).toBeDefined();
      const glow = site.getObjectByName('battlefield-fire-glow') as THREE.Mesh;
      expect(glow.scale.x).toBeLessThan(1);
    }
    const [leftFire, rightFire] = burningSites;
    expect(Math.abs(Math.abs(leftFire.position.x) - Math.abs(rightFire.position.x)))
      .toBeGreaterThan(4);
    expect(Math.abs(leftFire.position.z - rightFire.position.z)).toBeGreaterThan(5);
    expect((leftFire.getObjectByName('burning-wreck-base') as THREE.Mesh).scale.x)
      .toBeGreaterThan((rightFire.getObjectByName('burning-wreck-base') as THREE.Mesh).scale.x);
    expect((leftFire.getObjectByName('burning-fire-core') as THREE.Mesh).scale.x)
      .toBeLessThan((rightFire.getObjectByName('burning-fire-core') as THREE.Mesh).scale.x);
    expect(far.getObjectByName('battlefield-burning-site')).toBeUndefined();

    const joint = scene.getObjectByName('bridge-expansion-joint') as THREE.Mesh;
    const firstJointZ = joint.position.z;
    environment.update(65, 3.2, 1000);
    expect(deck.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(water.getWorldPosition(new THREE.Vector3()).z).toBe(120);
    expect(deck.getWorldPosition(new THREE.Vector3()).z + 150).toBeGreaterThan(65 + 90);
    expect(joint.position.z).toBeGreaterThan(firstJointZ);
    expect(near.position.z - 65).toBeGreaterThan(48);
    expect(near.position.z - 65).toBeLessThan(56);
    expect(mid.position.z - 65).toBeGreaterThan(74);
    expect(mid.position.z - 65).toBeLessThan(78);
    expect(far.position.z - 65).toBeGreaterThan(99);
    expect(far.position.z - 65).toBeLessThan(101);
    expect(beachhead.position.z - 65).toBe(125);
    expect(near.position.z).toBeLessThan(mid.position.z);
    expect(mid.position.z).toBeLessThan(far.position.z);
    expect(mid.position.z - near.position.z).toBeGreaterThan(20);
    expect(far.position.z - mid.position.z).toBeGreaterThan(20);
    expect(Math.abs(near.position.x)).toBeGreaterThan(Math.abs(mid.position.x));
    expect(Math.abs(mid.position.x)).toBeGreaterThan(Math.abs(far.position.x));
    expect(Math.abs(far.position.x)).toBeGreaterThan(Math.abs(beachhead.position.x));

    const disposeGeometry = vi.spyOn(deck.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(deck.material as THREE.Material, 'dispose');
    const disposeGhost = vi.spyOn(ghostMaterial, 'dispose');
    environment.dispose();
    expect(scene.getObjectByName('bridge-deck')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-near')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-mid')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-far')).toBeUndefined();
    expect(scene.getObjectByName('enemy-beachhead-horizon')).toBeUndefined();
    expect(scene.getObjectByName('bridge-expansion-joint')).toBeUndefined();
    expect(scene.fog).toBeNull();
    expect(scene.background).toBeNull();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeGhost).toHaveBeenCalledOnce();
  });
});
