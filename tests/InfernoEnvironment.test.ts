import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';
import { InfernoSurgeScheduler } from '../src/rendering/environment/InfernoSurgeScheduler';

describe('deep battlefield inferno', () => {
  it('schedules independent, bounded, reproducible surges without gameplay randomness', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Inferno scheduling must not use Math.random');
    });
    try {
      const sequence = (seed: number) => {
        const scheduler = new InfernoSurgeScheduler(seed);
        const states = scheduler.states;
        const events: { source: number; at: number; duration: number;
          intensity: number; height: number; width: number; smoke: number }[] = [];
        let sawOverlap = false;
        for (let nowMs = 0; nowMs <= 120_000; nowMs += 100) {
          scheduler.update(nowMs);
          sawOverlap ||= states.filter((state) => state.strength > .1).length >= 2;
          states.forEach((state, source) => {
            if (state.surgeStartMs === nowMs) events.push({ source, at: nowMs,
              duration: state.surgeDurationMs, intensity: state.intensity,
              height: state.heightScale, width: state.widthScale,
              smoke: state.smokeScale });
          });
        }
        expect(scheduler.states).toBe(states);
        return { events, sawOverlap };
      };
      const first = sequence(17);
      expect(sequence(17)).toEqual(first);
      expect(sequence(18)).not.toEqual(first);
      expect(first.events.length).toBeGreaterThan(20);
      expect(first.sawOverlap).toBe(true);
      expect(new Set(first.events.map((event) => event.source))).toEqual(new Set([0, 1, 2]));
      expect(first.events.every((event) => event.duration >= 1500
        && event.duration <= 4500 && event.intensity >= .55 && event.intensity <= 1.1
        && event.height >= .8 && event.height <= 1.4
        && event.width >= .85 && event.width <= 1.3
        && event.smoke >= .65 && event.smoke <= 1.25)).toBe(true);
      expect(new Set(first.events.map((event) => Math.round(event.intensity * 10))).size)
        .toBeGreaterThan(3);
      expect(new Set(first.events.map((event) => Math.round(event.duration / 500))).size)
        .toBeGreaterThan(3);
      expect(new Set(first.events.map((event) => Math.round(event.height * 10))).size)
        .toBeGreaterThan(3);
      for (let source = 0; source < 3; source++) {
        const sourceEvents = first.events.filter((event) => event.source === source);
        for (let index = 1; index < sourceEvents.length; index++) {
          const quiet = sourceEvents[index].at - sourceEvents[index - 1].at
            - sourceEvents[index - 1].duration;
          expect(quiet).toBeGreaterThanOrEqual(3000);
          expect(quiet).toBeLessThanOrEqual(10100);
        }
      }
      const reset = new InfernoSurgeScheduler(17);
      const firstTimes = reset.states.map((state) => state.nextSurgeAtMs);
      reset.update(80_000);
      reset.reset();
      expect(reset.states.map((state) => state.nextSurgeAtMs)).toEqual(firstTimes);
    } finally {
      random.mockRestore();
    }
  });

  it('keeps three dim backlit sources behind the port, surges, and disposes resources', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const inferno = scene.getObjectByName('battlefield-deep-inferno') as THREE.Group;
    const beachhead = scene.getObjectByName('enemy-beachhead-horizon') as THREE.Group;
    const sources = inferno.children.filter((child) => child.name === 'inferno-source');
    expect(sources).toHaveLength(3);
    expect(inferno.position.z - beachhead.position.z).toBeGreaterThan(12);
    expect(inferno.position.z).toBeLessThan(180);
    expect(sources.every((source) => Math.abs(source.position.x) > 12)).toBe(true);
    const camera = new THREE.PerspectiveCamera(48, 9 / 16, .1, 180);
    camera.position.set(0, 6.5, -10);
    camera.lookAt(0, 0, 12.5);
    camera.updateMatrixWorld();
    inferno.updateMatrixWorld(true);
    expect(sources.filter((source) => {
      const sky = source.getObjectByName('inferno-sky-glow')!;
      const point = sky.getWorldPosition(new THREE.Vector3()).project(camera);
      return Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
    }).length).toBeGreaterThanOrEqual(2);
    for (const source of sources) {
      expect(source.children).toHaveLength(5);
      for (const name of ['inferno-sky-glow', 'inferno-column-glow',
        'inferno-fire-core', 'inferno-smoke-lower', 'inferno-smoke-upper']) {
        expect(source.getObjectByName(name)).toBeDefined();
      }
      const sky = source.getObjectByName('inferno-sky-glow') as THREE.Sprite;
      const smoke = source.getObjectByName('inferno-smoke-lower') as THREE.Sprite;
      expect((sky.material as THREE.SpriteMaterial).fog).toBe(false);
      expect((sky.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0);
      expect((sky.material as THREE.SpriteMaterial).opacity).toBeLessThan(.1);
      expect((smoke.material as THREE.SpriteMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l)
        .toBeLessThan(.3);
    }
    const scheduler = new InfernoSurgeScheduler();
    const firstAt = Math.min(...scheduler.states.map((state) => state.nextSurgeAtMs));
    const sourceIndex = scheduler.states.findIndex((state) => state.nextSurgeAtMs === firstAt);
    const source = sources[sourceIndex];
    const sky = source.getObjectByName('inferno-sky-glow') as THREE.Sprite;
    const core = source.getObjectByName('inferno-fire-core') as THREE.Sprite;
    const smoke = source.getObjectByName('inferno-smoke-lower') as THREE.Sprite;
    const baselineOpacity = (core.material as THREE.SpriteMaterial).opacity;
    const baselineHeight = core.scale.y;
    const baselineSmokeY = smoke.position.y;
    environment.update(0, 3.2, firstAt);
    scheduler.update(firstAt);
    environment.update(0, 3.2, firstAt + scheduler.states[sourceIndex].surgeDurationMs / 2);
    expect((core.material as THREE.SpriteMaterial).opacity)
      .toBeGreaterThan(baselineOpacity + .05);
    expect((sky.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(.08);
    expect(core.scale.y).toBeGreaterThan(baselineHeight);
    expect(smoke.position.y).toBeGreaterThan(baselineSmokeY);
    environment.update(0, 3.2, firstAt + scheduler.states[sourceIndex].surgeDurationMs + 100);
    expect((core.material as THREE.SpriteMaterial).opacity)
      .toBeLessThan(baselineOpacity + .02);
    const children = sources.map((item) => [...item.children]);
    const materials = sources.flatMap((item) => item.children.map((child) =>
      (child as THREE.Sprite).material));
    for (let nowMs = 10_000; nowMs < 120_000; nowMs += 100) {
      environment.update(nowMs / 1000, 3.2, nowMs);
    }
    expect(inferno.children).toHaveLength(sources.length);
    sources.forEach((item, index) => {
      expect(inferno.children[index]).toBe(item);
      expect(item.children).toHaveLength(children[index].length);
      item.children.forEach((child, childIndex) => {
        expect(child).toBe(children[index][childIndex]);
      });
    });
    sources.flatMap((item) => item.children.map((child) =>
      (child as THREE.Sprite).material)).forEach((material, index) => {
      expect(material).toBe(materials[index]);
    });
    environment.update(60, 3.2, 120_000);
    expect(inferno.position.z - 60).toBe(142);
    const disposeSky = vi.spyOn(sky.material, 'dispose');
    const disposeSmoke = vi.spyOn(smoke.material, 'dispose');
    environment.dispose();
    expect(scene.getObjectByName('battlefield-deep-inferno')).toBeUndefined();
    expect(disposeSky).toHaveBeenCalledOnce();
    expect(disposeSmoke).toHaveBeenCalledOnce();
  });
});
