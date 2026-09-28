import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment, BATTLEFIELD_FOG_FAR } from '../src/rendering/environment/BridgeEnvironment';
import { WarActivityScheduler, SHIP_STARTED, AIRCRAFT_STARTED,
  SKY_FLAK_STARTED } from '../src/rendering/environment/WarActivityScheduler';
import { SKY_FLAK_CUE } from '../src/audio/EnvironmentAudioCue';

describe('presentation-only water and sky activity', () => {
  it('schedules repeatable ship, aircraft, and flak activity without gameplay RNG', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Visual scheduling must not use Math.random');
    });
    try {
      const sequence = (seed: number) => {
        const scheduler = new WarActivityScheduler(seed);
        const events: { at: number; kind: number; shipX: number; flakY: number }[] = [];
        for (let index = 0; index < 20; index++) {
          const at = scheduler.nextEventMs;
          const kind = scheduler.update(at);
          events.push({ at, kind, shipX: scheduler.shipX, flakY: scheduler.flakY });
        }
        return events;
      };
      const first = sequence(17);
      expect(sequence(17)).toEqual(first);
      expect(sequence(18)).not.toEqual(first);
      expect(first.some((event) => event.kind & SHIP_STARTED)).toBe(true);
      expect(first.some((event) => event.kind & AIRCRAFT_STARTED)).toBe(true);
      expect(first.some((event) => event.kind & SKY_FLAK_STARTED)).toBe(true);
      expect(first.filter((event) => event.kind & SHIP_STARTED)
        .every((event) => Math.abs(event.shipX) > 8.8)).toBe(true);
      expect(first.filter((event) => event.kind & SKY_FLAK_STARTED)
        .every((event) => event.flakY >= 14 && event.flakY <= 19)).toBe(true);
    } finally {
      random.mockRestore();
    }
  });

  it('keeps one warship and aircraft in their water and far-sky bands and disposes them', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const shipLayer = scene.getObjectByName('battlefield-water-traffic') as THREE.Group;
    const skyLayer = scene.getObjectByName('battlefield-sky-activity') as THREE.Group;
    const ship = shipLayer.getObjectByName('battlefield-warship') as THREE.Group;
    const aircraft = skyLayer.getObjectByName('battlefield-aircraft') as THREE.Group;
    const flak = skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot');
    expect(ship).toBeDefined();
    expect(aircraft).toBeDefined();
    expect(flak).toHaveLength(2);
    const shipMaterial = (ship.getObjectByName('warship-hull') as THREE.Mesh).material as THREE.Material;
    const shipGeometry = (ship.getObjectByName('warship-hull') as THREE.Mesh).geometry;
    const disposeMaterial = vi.spyOn(shipMaterial, 'dispose');
    const disposeGeometry = vi.spyOn(shipGeometry, 'dispose');
    let sawShip = false;
    let sawAircraft = false;
    let sawFlak = false;
    let shipOnScreen = false;
    let aircraftOnScreen = false;
    let flakOnScreen = false;
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    for (let nowMs = 0; nowMs <= 35_000; nowMs += 100) {
      const playerZ = nowMs / 500;
      const cues = environment.update(playerZ, 3.2, nowMs);
      camera.position.set(0, 6.5, playerZ - 10);
      camera.lookAt(0, 0, playerZ + 12.5);
      camera.updateMatrixWorld();
      const inPortrait = (object: THREE.Object3D) => {
        const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
        return Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
      };
      expect(shipLayer.children.filter((child) => child.name === 'battlefield-warship')).toHaveLength(1);
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-aircraft')).toHaveLength(1);
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot'))
        .toHaveLength(2);
      if (ship.visible) {
        sawShip = true;
        expect(Math.abs(ship.position.x) - 2.7).toBeGreaterThan(4.2);
        expect(ship.getWorldPosition(new THREE.Vector3()).z - playerZ).toBeCloseTo(38);
        shipOnScreen ||= inPortrait(ship);
      }
      if (aircraft.visible) {
        sawAircraft = true;
        expect(aircraft.position.y).toBeGreaterThan(12);
        expect(aircraft.getWorldPosition(new THREE.Vector3()).z - playerZ)
          .toBeGreaterThan(BATTLEFIELD_FOG_FAR);
        aircraftOnScreen ||= inPortrait(aircraft);
      }
      if (cues & SKY_FLAK_CUE) sawFlak = true;
      flakOnScreen ||= flak.some((slot) => slot.visible && inPortrait(slot));
    }
    expect([sawShip, sawAircraft, sawFlak]).toEqual([true, true, true]);
    expect([shipOnScreen, aircraftOnScreen, flakOnScreen]).toEqual([true, true, true]);
    environment.dispose();
    expect(scene.getObjectByName('battlefield-water-traffic')).toBeUndefined();
    expect(scene.getObjectByName('battlefield-sky-activity')).toBeUndefined();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce();
  });

  it('uses a short sky flash followed by a compact charcoal smoke puff', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const scheduler = new WarActivityScheduler();
    let flakAt = 0;
    for (let index = 0; index < 8; index++) {
      const at = scheduler.nextEventMs;
      const event = scheduler.update(at);
      environment.update(0, 3.2, at);
      if (event & SKY_FLAK_STARTED) { flakAt = at; break; }
    }
    expect(flakAt).toBeGreaterThan(0);
    const slot = scene.getObjectsByProperty('name', 'battlefield-sky-flak-slot')
      .find((candidate) => candidate.visible) as THREE.Group;
    const flash = slot.getObjectByName('sky-flak-flash') as THREE.Sprite;
    const glow = slot.getObjectByName('sky-flak-glow') as THREE.Sprite;
    const smoke = slot.getObjectByName('sky-flak-smoke') as THREE.Sprite;
    expect(flash.visible).toBe(true);
    expect(smoke.visible).toBe(false);
    environment.update(0, 3.2, flakAt + 190);
    expect(flash.visible).toBe(false);
    expect(glow.visible).toBe(true);
    expect(smoke.visible).toBe(true);
    expect((smoke.material as THREE.SpriteMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l)
      .toBeLessThan(.15);
    environment.update(0, 3.2, flakAt + 2200);
    expect(slot.visible).toBe(false);
    environment.dispose();
  });
});
