import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { squadBobOffset, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectilePulseTracker, ProjectileRenderer, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
import { AudioCueObserver, GameAudio } from '../src/audio/GameAudio';

describe('presentation-only motion', () => {
  it('keeps a tiny staggered bob without shifting formation X/Z', () => {
    for (const time of [0, 50, 250, 1_000]) {
      for (let index = 0; index < 12; index++) {
        expect(Math.abs(squadBobOffset(index, time))).toBeLessThanOrEqual(0.025);
      }
    }
    expect(squadBobOffset(0, 100)).not.toBeCloseTo(squadBobOffset(1, 100));
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0.4, z: 3 }, squad: { count: 2, rocketCount: 0,
      tier2RifleCount: 0, formationSpacing: 0.45 }, track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [], streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state, 100);
    const positions = scene.children.map((member) => [member.position.x, member.position.z]);
    renderer.update(state, 400);
    expect(scene.children.map((member) => [member.position.x, member.position.z])).toEqual(positions);
    renderer.dispose();
  });

  it('pulses new visuals once, settles, prunes vanished IDs, and resets', () => {
    expect(projectilePulseScale(0)).toBeCloseTo(1.35);
    expect(projectilePulseScale(65)).toBe(1);
    const tracker = new ProjectilePulseTracker();
    expect(tracker.scaleFor(3, 100)).toBeCloseTo(1.35);
    expect(tracker.scaleFor(3, 130)).toBeLessThan(1.35);
    expect(tracker.scaleFor(3, 200)).toBe(1);
    tracker.prune(new Set());
    expect(tracker.size).toBe(0);
    expect(tracker.scaleFor(3, 210)).toBeCloseTo(1.35);
    tracker.reset();
    expect(tracker.size).toBe(0);

    const scene = new THREE.Scene();
    const renderer = new ProjectileRenderer(scene);
    renderer.update([{ id: 1, kind: 'rifle', x: 0, z: 1 },
      { id: 2, kind: 'heavyRifle', x: 0, z: 1 },
      { id: 3, kind: 'rocket', x: 0, z: 1 }], 100);
    expect(scene.children.map((child) => child.scale.x)).toEqual([1.35, 1.35, 1.35]);
    renderer.update([{ id: 1, kind: 'rifle', x: 0, z: 2 }], 200);
    expect(scene.children[0].scale.x).toBe(1);
    renderer.reset();
    renderer.update([{ id: 1, kind: 'rifle', x: 0, z: 2 }], 210);
    expect(scene.children[0].scale.x).toBeCloseTo(1.35);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

describe('audio cue observation and safety', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('aggregates projectiles by kind and classifies defense changes', () => {
    const observer = new AudioCueObserver();
    const shots = [{ id: 1, kind: 'rifle' as const, x: 0, z: 0 },
      { id: 2, kind: 'rifle' as const, x: 0, z: 0 },
      { id: 3, kind: 'heavyRifle' as const, x: 0, z: 0 },
      { id: 4, kind: 'heavyRifle' as const, x: 0, z: 0 },
      { id: 5, kind: 'rocket' as const, x: 0, z: 0 }];
    expect(observer.observe(shots, 1, 1)).toEqual(['rifle', 'heavyRifle', 'rocket']);
    expect(observer.observe(shots, 1, 1)).toEqual([]);
    expect(observer.observe([], 9, 10)).toEqual(['reward']);
    expect(observer.observe([], 10, 9)).toEqual(['damage']);
    expect(observer.observe([], 9, 0)).toEqual(['fatal']);
    observer.reset();
    expect(observer.observe(shots.slice(0, 1), 1, 1)).toEqual(['rifle']);
  });

  it('safely ignores playback without an unlocked AudioContext', () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const audio = new GameAudio(viewport as HTMLElement, keys as Window);
    expect(() => audio.play('rifle')).not.toThrow();
    expect(() => viewport.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    expect(() => audio.observe([{ id: 1, kind: 'rifle', x: 0, z: 0 }], 1, 0)).not.toThrow();
    const removeViewport = vi.spyOn(viewport, 'removeEventListener');
    const removeKeys = vi.spyOn(keys, 'removeEventListener');
    audio.dispose();
    expect(removeViewport).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeKeys).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('unlocks once, ignores suspension, and keeps its context across observation resets', async () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const starts = vi.fn();
    const stops = vi.fn();
    const oscillator = () => ({ type: 'sine', frequency: { setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(),
      start: starts, stop: stops, onended: null });
    const gain = () => ({ gain: { value: 0, setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
    const context = { state: 'suspended', currentTime: 0, destination: {},
      createOscillator: vi.fn(oscillator), createGain: vi.fn(gain),
      resume: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    const audio = new GameAudio(viewport as HTMLElement, keys as Window);
    viewport.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    audio.play('rifle');
    expect(starts).not.toHaveBeenCalled();
    context.state = 'running';
    keys.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.play('rifle');
    expect(starts).toHaveBeenCalledOnce();
    audio.resetObservation();
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.dispose();
    expect(stops).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
