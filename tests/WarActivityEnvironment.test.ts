import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment, BATTLEFIELD_FOG_FAR } from '../src/rendering/environment/BridgeEnvironment';
import { WarActivityScheduler, SHIP_STARTED, AIRCRAFT_STARTED,
  SKY_FLAK_STARTED, SHIP_PASS_MS, AIRCRAFT_PASS_MS } from '../src/rendering/environment/WarActivityScheduler';

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
        .every((event) => event.shipX >= 27 && event.shipX <= 30)).toBe(true);
      expect(first.filter((event) => event.kind & SKY_FLAK_STARTED)
        .every((event) => event.flakY >= 14 && event.flakY <= 19)).toBe(true);
    } finally {
      random.mockRestore();
    }
  });

  it('occasionally overlaps opposite-direction planes while keeping quiet gaps', () => {
    const sample = () => {
      const scheduler = new WarActivityScheduler(17);
      let overlaps = 0;
      let singles = 0;
      let gaps = 0;
      for (let nowMs = 0; nowMs <= 120_000; nowMs += 100) {
        scheduler.update(nowMs);
        const active = scheduler.aircraftPasses.filter((pass) =>
          nowMs - pass.startedAtMs >= 0 && nowMs - pass.startedAtMs < AIRCRAFT_PASS_MS);
        if (active.length === 2) {
          overlaps++;
          expect(active[0].side).toBe(-active[1].side);
          expect(active[0].y).not.toBe(active[1].y);
          expect(active[0].z).not.toBe(active[1].z);
        } else if (active.length === 1) singles++;
        else gaps++;
      }
      return { overlaps, singles, gaps };
    };
    const result = sample();
    expect(sample()).toEqual(result);
    expect(result.overlaps).toBeGreaterThan(0);
    expect(result.singles).toBeGreaterThan(result.overlaps);
    expect(result.gaps).toBeGreaterThan(result.overlaps);
  });

  it('keeps one warship and at most two aircraft in their bands and disposes them', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const shipLayer = scene.getObjectByName('battlefield-water-traffic') as THREE.Group;
    const skyLayer = scene.getObjectByName('battlefield-sky-activity') as THREE.Group;
    const ship = shipLayer.getObjectByName('battlefield-warship') as THREE.Group;
    const aircraft = skyLayer.children.filter((child) => child.name === 'battlefield-aircraft');
    const flak = skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot');
    expect(ship).toBeDefined();
    expect(aircraft).toHaveLength(2);
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
      environment.update(playerZ, 3.2, nowMs);
      camera.position.set(0, 6.5, playerZ - 10);
      camera.lookAt(0, 0, playerZ + 12.5);
      camera.updateMatrixWorld();
      const inPortrait = (object: THREE.Object3D) => {
        const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
        return Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
      };
      expect(shipLayer.children.filter((child) => child.name === 'battlefield-warship')).toHaveLength(1);
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-aircraft')).toHaveLength(2);
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot'))
        .toHaveLength(2);
      if (ship.visible) {
        sawShip = true;
        expect(ship.getWorldPosition(new THREE.Vector3()).z - playerZ).toBeCloseTo(38);
        shipOnScreen ||= inPortrait(ship);
      }
      for (const plane of aircraft.filter((candidate) => candidate.visible)) {
        sawAircraft = true;
        expect(plane.position.y).toBeGreaterThan(12);
        expect(plane.getWorldPosition(new THREE.Vector3()).z - playerZ)
          .toBeGreaterThan(BATTLEFIELD_FOG_FAR);
        aircraftOnScreen ||= inPortrait(plane);
      }
      if (flak.some((slot) => slot.visible)) sawFlak = true;
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

  it('moves one opaque segmented ship behind the bridge with edge-only fades', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const scheduler = new WarActivityScheduler();
    let shipAt = 0;
    let planeAt = 0;
    for (let index = 0; index < 8 && (!shipAt || !planeAt); index++) {
      const at = scheduler.nextEventMs;
      const flags = scheduler.update(at);
      environment.update(0, 3.2, at);
      if (flags & SHIP_STARTED) shipAt = at;
      if (flags & AIRCRAFT_STARTED) planeAt = at;
    }
    expect(shipAt).toBeGreaterThan(0);
    expect(planeAt).toBeGreaterThan(0);
    const ship = scene.getObjectByName('battlefield-warship') as THREE.Group;
    const sections = ship.children.filter((child) => child.name.startsWith('warship-section-'));
    expect(sections).toHaveLength(5);
    const hull = ship.getObjectByName('warship-hull') as THREE.Mesh;
    const hullMaterial = hull.material as THREE.MeshStandardMaterial;
    const sectionRefs = [...sections];
    const xPositions: number[] = [];
    const sample = (progress: number) => {
      environment.update(0, 3.2, shipAt + SHIP_PASS_MS * progress);
      xPositions.push(ship.position.x);
      expect(ship.children).toEqual(sectionRefs);
      ship.updateWorldMatrix(true, true);
      for (const section of sections.filter((piece) => piece.visible)) {
        const bounds = new THREE.Box3().setFromObject(section);
        expect(bounds.max.x < -4.2 || bounds.min.x > 4.2).toBe(true);
      }
      return sections.filter((section) => section.visible).length;
    };
    sample(0);
    const entryX = ship.position.x;
    expect(hullMaterial.opacity).toBeLessThan(.05);
    expect(sample(.1)).toBe(5);
    expect(hullMaterial.opacity).toBeCloseTo(1);
    expect(sample(.25)).toBe(5);
    expect(hullMaterial.opacity).toBeCloseTo(1);
    const approaching = sample(.4);
    expect(approaching).toBeGreaterThan(0);
    expect(approaching).toBeLessThan(5);
    expect(hullMaterial.opacity).toBeCloseTo(1);
    expect(sample(.5)).toBe(0);
    expect(Math.abs(ship.position.x)).toBeLessThan(1);
    expect(hullMaterial.opacity).toBeCloseTo(1);
    const emerging = sample(.6);
    expect(emerging).toBeGreaterThan(0);
    expect(emerging).toBeLessThan(5);
    expect(hullMaterial.opacity).toBeCloseTo(1);
    expect(sample(.75)).toBe(5);
    expect(Math.sign(ship.position.x)).toBe(-Math.sign(entryX));
    expect(hullMaterial.opacity).toBeCloseTo(1);
    sample(.99);
    expect(hullMaterial.opacity).toBeLessThan(.2);
    const direction = Math.sign(xPositions.at(-1)! - xPositions[0]);
    expect(xPositions.slice(1).every((x, index) =>
      Math.sign(x - xPositions[index]) === direction)).toBe(true);

    const plane = scene.getObjectByName('battlefield-aircraft') as THREE.Group;
    const planeMaterial = (plane.getObjectByName('aircraft-fuselage') as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(AIRCRAFT_PASS_MS).toBeLessThan(5000);
    expect(plane.scale.x).toBeLessThan(.7);
    environment.update(0, 3.2, planeAt);
    expect(planeMaterial.opacity).toBeLessThan(.05);
    environment.update(0, 3.2, planeAt + AIRCRAFT_PASS_MS * .5);
    expect(planeMaterial.opacity).toBeGreaterThan(.2);
    expect(planeMaterial.opacity).toBeLessThan(.32);
    environment.update(0, 3.2, planeAt + AIRCRAFT_PASS_MS * .98);
    expect(planeMaterial.opacity).toBeLessThan(.1);
    environment.dispose();
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
