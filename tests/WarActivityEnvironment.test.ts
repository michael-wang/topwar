import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';
import { WarActivityScheduler, AIRCRAFT_STARTED, AIRCRAFT_PASS_MS } from '../src/rendering/environment/WarActivityScheduler';

describe('presentation-only aircraft', () => {
  it('schedules repeatable aircraft without gameplay RNG and resets on rewind', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Visual scheduling must not use Math.random');
    });
    try {
      const sequence = (scheduler: WarActivityScheduler) => {
        const events = [];
        for (let index = 0; index < 20; index++) {
          const at = scheduler.nextEventMs;
          const kind = scheduler.update(at);
          events.push({ at, kind, passes: structuredClone(scheduler.aircraftPasses) });
        }
        return events;
      };
      const scheduler = new WarActivityScheduler(17);
      const first = sequence(scheduler);
      expect(sequence(new WarActivityScheduler(17))).toEqual(first);
      expect(sequence(new WarActivityScheduler(18))).not.toEqual(first);
      expect(first.every((event) => event.kind === AIRCRAFT_STARTED)).toBe(true);
      scheduler.update(0);
      expect(scheduler.aircraftPasses.every(pass => pass.startedAtMs === -Infinity)).toBe(true);
      expect(sequence(scheduler)).toEqual(first);
    } finally {
      random.mockRestore();
    }
  });

  it('occasionally overlaps opposite-direction planes while keeping quiet gaps', () => {
    const sample = () => {
      const scheduler = new WarActivityScheduler(17);
      let overlaps = 0, singles = 0, gaps = 0;
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

  it('keeps only two coastal aircraft, reuses their resources and disposes once', () => {
    const scene = new THREE.Scene();
    const originalBackground = scene.background, originalFog = scene.fog;
    const environment = new BridgeEnvironment(scene);
    const skyLayer = scene.getObjectByName('battlefield-sky-activity') as THREE.Group;
    const aircraft = skyLayer.children;
    expect(aircraft).toHaveLength(2);
    expect(aircraft.every(plane => plane.name === 'battlefield-aircraft')).toBe(true);
    const aircraftMaterial = (aircraft[0].children[0] as THREE.Mesh).material as THREE.Material;
    const aircraftGeometry = (aircraft[0].children[0] as THREE.Mesh).geometry;
    const disposeMaterial = vi.spyOn(aircraftMaterial, 'dispose');
    const disposeGeometry = vi.spyOn(aircraftGeometry, 'dispose');
    let sawAircraft = false, aircraftOnScreen = false;
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    for (let nowMs = 0; nowMs <= 35_000; nowMs += 100) {
      const playerZ = nowMs / 500;
      environment.update(playerZ, 3.2, nowMs);
      camera.position.set(0, 6.5, playerZ - 10);
      camera.lookAt(0, 0, playerZ + 12.5);
      camera.updateMatrixWorld();
      expect(skyLayer.children).toHaveLength(2);
      for (const plane of aircraft.filter(candidate => candidate.visible)) {
        sawAircraft = true;
        expect(plane.position.y).toBeGreaterThan(12);
        expect(plane.getWorldPosition(new THREE.Vector3()).z - playerZ).toBeGreaterThan(100);
        const point = plane.getWorldPosition(new THREE.Vector3()).project(camera);
        aircraftOnScreen ||= Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
      }
    }
    expect(sawAircraft).toBe(true);
    expect(aircraftOnScreen).toBe(true);
    environment.update(0, 3.2, 0);
    expect(aircraft.every(plane => !plane.visible)).toBe(true);
    environment.dispose();
    expect(scene.children).toHaveLength(0);
    expect(scene.background).toBe(originalBackground);
    expect(scene.fog).toBe(originalFog);
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce();
  });
});
