import acceptedAmbient from './fixtures/accepted-ambient.json';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment, BATTLEFIELD_FOG_FAR } from '../src/rendering/environment/BridgeEnvironment';
import { WarActivityScheduler, AIRCRAFT_STARTED, SKY_FLAK_STARTED, AIRCRAFT_PASS_MS } from '../src/rendering/environment/WarActivityScheduler';

describe('presentation-only water and sky activity', () => {
  it('schedules repeatable aircraft and flak activity without gameplay RNG', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Visual scheduling must not use Math.random');
    });
    try {
      const sequence = (seed: number) => {
        const scheduler = new WarActivityScheduler(seed);
        const events: { at: number; kind: number; flakY: number }[] = [];
        for (let index = 0; index < 20; index++) {
          const at = scheduler.nextEventMs;
          const kind = scheduler.update(at);
          events.push({ at, kind, flakY: scheduler.flakY });
        }
        return events;
      };
      const first = sequence(17);
      expect(sequence(17)).toEqual(first);
      expect(sequence(18)).not.toEqual(first);
      expect(first.some((event) => event.kind & AIRCRAFT_STARTED)).toBe(true);
      expect(first.some((event) => event.kind & SKY_FLAK_STARTED)).toBe(true);
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

  it('keeps two bounded coastal aircraft and flak pools and disposes their resources', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const skyLayer = scene.getObjectByName('battlefield-sky-activity') as THREE.Group;
    const aircraft = skyLayer.children.filter((child) => child.name === 'battlefield-aircraft');
    const flak = skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot');
    expect(aircraft).toHaveLength(2);
    expect(flak).toHaveLength(2);
    const aircraftMaterial = (aircraft[0].children[0] as THREE.Mesh).material as THREE.Material;
    const aircraftGeometry = (aircraft[0].children[0] as THREE.Mesh).geometry;
    const disposeMaterial = vi.spyOn(aircraftMaterial, 'dispose');
    const disposeGeometry = vi.spyOn(aircraftGeometry, 'dispose');
    let sawAircraft = false;
    let sawFlak = false;
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
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-aircraft')).toHaveLength(2);
      expect(skyLayer.children.filter((child) => child.name === 'battlefield-sky-flak-slot'))
        .toHaveLength(2);

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
    expect([sawAircraft, sawFlak]).toEqual([true, true]);
    expect([aircraftOnScreen, flakOnScreen]).toEqual([true, true]);
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

it('preserves the accepted coastal aircraft/flak sequence after retiring the ship actor', () => {
  const scheduler=new WarActivityScheduler(17),samples=[];
  for(let ms=0;ms<=120000;ms+=100){const mask=scheduler.update(ms)&6;
    if(mask)samples.push({ms,mask,aircraft:structuredClone(scheduler.aircraftPasses),flakAt:scheduler.flakStartedAtMs,flakX:scheduler.flakX,flakY:scheduler.flakY});}
  // JSON fixtures encode not-yet-started (-Infinity) presentation clocks as null.
  expect(JSON.parse(JSON.stringify(samples))).toEqual(acceptedAmbient);
});
