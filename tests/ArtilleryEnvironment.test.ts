import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ARTILLERY_SITES, ArtilleryScheduler } from '../src/rendering/environment/ArtilleryScheduler';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

describe('distant artillery presentation', () => {
  it('clears stale artillery and flak when Retry rewinds the presentation clock', () => {
    const environment = new BridgeEnvironment(new THREE.Scene());
    let bothActive = false;
    for (let nowMs = 75; nowMs < 60_000; nowMs += 75) {
      environment.update(0, 3.2, nowMs, true);
      const debug = environment.getDebugStats();
      if (debug.activeImpacts > 0 && debug.activeFlak > 0) {
        bothActive = true;
        break;
      }
    }
    expect(bothActive).toBe(true);
    environment.update(0, 3.2, 0, true);
    expect(environment.getDebugStats().activeImpacts).toBe(0);
    expect(environment.getDebugStats().activeFlak).toBe(0);
    environment.dispose();
  });

  it('uses fixed off-lane sites and a repeatable scheduler without gameplay randomness', () => {
    expect(ARTILLERY_SITES).toHaveLength(10);
    expect(ARTILLERY_SITES.every((site) => Math.abs(site.x) > 8)).toBe(true);
    expect(new Set(ARTILLERY_SITES.map((site) => site.layer)))
      .toEqual(new Set(['near', 'mid', 'far']));
    for (const layer of ['near', 'mid', 'far']) {
      expect(ARTILLERY_SITES.filter((site) => site.layer === layer).length).toBeGreaterThanOrEqual(2);
    }
    expect(ARTILLERY_SITES.filter((site) => site.layer === 'near'
      && site.z < -15 && (site.y ?? 0) < 0)).toHaveLength(2);
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
      expect(gaps.every((gap) => (gap >= 140 && gap <= 320)
        || (gap >= 1180 && gap <= 3200))).toBe(true);
      expect(gaps.some((gap) => gap < 320)).toBe(true);
      const primary = first.filter((event, index) => index === 0
        || event.at - first[index - 1].at > 320);
      expect(primary.slice(1).every((event, index) =>
        event.at - primary[index].at >= 1500
        && event.at - primary[index].at <= 3200)).toBe(true);
      for (let index = 0; index < primary.length - 2; index += 3) {
        expect(new Set(primary.slice(index, index + 3)
          .map((event) => ARTILLERY_SITES[event.site].layer)))
          .toEqual(new Set(['near', 'mid', 'far']));
      }
      expect(new Set(gaps.map((gap) => Math.floor(gap / 100))).size).toBeGreaterThan(10);
    } finally {
      random.mockRestore();
    }
  });

  it('reuses five visuals through flash, glow, and smoky fade, then disposes resources', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const slots = scene.getObjectsByProperty('name', 'battlefield-artillery-slot') as THREE.Group[];
    expect(slots).toHaveLength(5);
    const flash = slots[0].getObjectByName('battlefield-artillery-flash') as THREE.Sprite;
    const smoke = slots[0].getObjectByName('battlefield-artillery-smoke') as THREE.Sprite;
    const flashDispose = vi.spyOn(flash.material, 'dispose');
    const smokeDispose = vi.spyOn(smoke.material, 'dispose');
    const textureDispose = vi.spyOn((flash.material as THREE.SpriteMaterial).map!, 'dispose');
    const initialSprites = slots.flatMap((slot) => slot.children);
    const scheduler = new ArtilleryScheduler();
    const firstAt = scheduler.nextImpactAtMs;
    environment.update(0, 3.2, firstAt);
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
    expect(scene.getObjectsByProperty('name', 'battlefield-artillery-slot')).toHaveLength(5);
    expect(slots.flatMap((slot) => slot.children)).toEqual(initialSprites);
    environment.dispose();
    expect(scene.getObjectsByProperty('name', 'battlefield-artillery-slot')).toHaveLength(0);
    expect(flashDispose).toHaveBeenCalledOnce();
    expect(smokeDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it('scales and attaches impact visuals according to near, mid, and beachhead depth', () => {
    const scene = new THREE.Scene();
    const environment = new BridgeEnvironment(scene);
    const scheduler = new ArtilleryScheduler();
    const scales = new Map<string, number>();
    const smokeLightness = new Map<string, number>();
    for (let index = 0; index < 12 && scales.size < 3; index++) {
      const at = scheduler.nextImpactAtMs;
      const site = ARTILLERY_SITES[scheduler.update(at)];
      environment.update(0, 3.2, at);
      const parentName = site.layer === 'far' ? 'enemy-beachhead-horizon'
        : `battlefield-${site.layer}`;
      const group = (scene.getObjectByName(parentName) as THREE.Group).children.find(
        (child) => child.name === 'battlefield-artillery-slot'
          && child.visible && child.position.x === site.x && child.position.z === site.z);
      expect(group).toBeDefined();
      scales.set(site.layer, group!.scale.x);
      const smoke = group!.getObjectByName('battlefield-artillery-smoke') as THREE.Sprite;
      smokeLightness.set(site.layer, (smoke.material as THREE.SpriteMaterial).color
        .getHSL({ h: 0, s: 0, l: 0 }).l);
    }
    expect(scales.size).toBe(3);
    expect(scales.get('near')!).toBeGreaterThan(scales.get('mid')!);
    expect(scales.get('mid')!).toBeGreaterThan(scales.get('far')!);
    expect(smokeLightness.get('near')!).toBeLessThan(smokeLightness.get('mid')!);
    expect(smokeLightness.get('mid')!).toBeLessThan(smokeLightness.get('far')!);
    environment.dispose();
  });
});
