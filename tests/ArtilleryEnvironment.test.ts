import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ARTILLERY_SITES, ArtilleryScheduler } from '../src/rendering/environment/ArtilleryScheduler';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

describe('distant artillery presentation', () => {
  it('uses fixed off-lane sites and a repeatable scheduler without gameplay randomness', () => {
    expect(ARTILLERY_SITES).toHaveLength(5);
    expect(ARTILLERY_SITES.every((site) => Math.abs(site.x) > 8)).toBe(true);
    expect(new Set(ARTILLERY_SITES.map((site) => site.layer))).toEqual(new Set(['mid', 'far']));
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Artillery must not use gameplay randomness');
    });
    try {
      const sequence = (seed: number) => {
        const scheduler = new ArtilleryScheduler(seed);
        const events: { at: number; site: number }[] = [];
        for (let index = 0; index < 80; index++) {
          const at = scheduler.nextImpactAtMs;
          events.push({ at, site: scheduler.update(at) });
        }
        return events;
      };
      const first = sequence(42);
      expect(sequence(42)).toEqual(first);
      expect(sequence(43)).not.toEqual(first);
      expect(first.every((event) => event.site >= 0 && event.site < ARTILLERY_SITES.length))
        .toBe(true);
      const gaps = first.slice(1).map((event, index) => event.at - first[index].at);
      expect(gaps.every((gap) => (gap >= 150 && gap <= 400)
        || (gap >= 2500 && gap <= 6000))).toBe(true);
      expect(gaps.some((gap) => gap < 400)).toBe(true);
      expect(new Set(gaps.map((gap) => Math.floor(gap / 100))).size).toBeGreaterThan(10);
    } finally {
      random.mockRestore();
    }
  });

  it('reuses three visuals through flash, glow, and smoky fade, then disposes resources', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const slots = scene.getObjectsByProperty('name', 'battlefield-artillery-slot') as THREE.Group[];
    expect(slots).toHaveLength(3);
    const flash = slots[0].getObjectByName('battlefield-artillery-flash') as THREE.Sprite;
    const smoke = slots[0].getObjectByName('battlefield-artillery-smoke') as THREE.Sprite;
    const flashDispose = vi.spyOn(flash.material, 'dispose');
    const smokeDispose = vi.spyOn(smoke.material, 'dispose');
    const textureDispose = vi.spyOn((flash.material as THREE.SpriteMaterial).map!, 'dispose');
    const initialSprites = slots.flatMap((slot) => slot.children);
    const scheduler = new ArtilleryScheduler();
    const firstAt = scheduler.nextImpactAtMs;
    environment.update(0, 3, firstAt);
    const active = slots.find((slot) => slot.visible)!;
    expect(active).toBeDefined();
    const activeFlash = active.getObjectByName('battlefield-artillery-flash') as THREE.Sprite;
    const activeGlow = active.getObjectByName('battlefield-artillery-glow') as THREE.Sprite;
    const activeSmoke = active.getObjectByName('battlefield-artillery-smoke') as THREE.Sprite;
    expect(activeFlash.visible).toBe(true);
    expect(activeGlow.visible).toBe(false);
    expect(activeSmoke.visible).toBe(false);
    environment.update(0, 3, firstAt + 150);
    expect(activeFlash.visible).toBe(false);
    expect(activeGlow.visible).toBe(true);
    environment.update(0, 3, firstAt + 600);
    expect(activeGlow.visible).toBe(false);
    expect(activeSmoke.visible).toBe(true);
    expect((activeSmoke.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0);
    environment.update(0, 3, firstAt + 2800);
    expect(active.visible).toBe(false);
    for (let nowMs = firstAt + 2850; nowMs < 120_000; nowMs += 75) {
      environment.update(nowMs / 1000, 3, nowMs);
    }
    expect(scene.getObjectsByProperty('name', 'battlefield-artillery-slot')).toHaveLength(3);
    expect(slots.flatMap((slot) => slot.children)).toEqual(initialSprites);
    environment.dispose();
    expect(scene.getObjectsByProperty('name', 'battlefield-artillery-slot')).toHaveLength(0);
    expect(flashDispose).toHaveBeenCalledOnce();
    expect(smokeDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
