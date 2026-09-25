import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { firingRecoil, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectilePulseTracker, ProjectileRenderer, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
import { AudioCueObserver, GameAudio } from '../src/audio/GameAudio';

describe('presentation-only motion', () => {
  it('keeps planted legs and gameplay X/Z while recoiling rifle and flashing muzzle', () => {
    expect(firingRecoil(100, 100)).toBe(1);
    expect(firingRecoil(200, 100)).toBe(0);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene);
    const state = { player: { x: 0.4, z: 3 }, squad: { count: 2, rocketCount: 0,
      rifleCounts: [2], formationSpacing: 0.45 }, track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state, 100);
    const soldiers = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    const positions = soldiers.map((member) => [member.position.x, member.position.z]);
    const soldier = soldiers[0];
    expect(soldier.children).toHaveLength(9);
    const legs = [soldier.children[4], soldier.children[5]];
    const legRotations = legs.map((leg) => leg.rotation.x);
    const rifle = soldier.children[6];
    const arms = [soldier.children[2], soldier.children[3]];
    const restingZ = rifle.position.z;
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4 }] }, 400);
    expect(soldiers.map((member) => [member.position.x, member.position.z])).toEqual(positions);
    expect(soldiers.every((member) => member.position.y === 0)).toBe(true);
    expect(legs.map((leg) => leg.rotation.x)).toEqual(legRotations);
    expect(rifle.position.z).toBeLessThan(restingZ);
    expect(arms[0].rotation.x).toBeGreaterThan(-0.78);
    expect(soldier.children[8].visible).toBe(true);
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4 }] }, 500);
    expect(rifle.position.z).toBeCloseTo(restingZ);
    expect(soldier.children[8].visible).toBe(false);
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
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1 },
      { id: 2, kind: 'rifle', tier: 2, x: 0, z: 1 },
      { id: 3, kind: 'rocket', tier: 0, x: 0, z: 1 }], 100);
    expect(scene.children.map((child) => child.scale.x)).toEqual([1.35, 1.35, 1.35]);
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 2 }], 200);
    expect(scene.children[0].scale.x).toBe(1);
    renderer.reset();
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 2 }], 210);
    expect(scene.children[0].scale.x).toBeCloseTo(1.35);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

describe('audio cue observation and safety', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('aggregates reward hits and throttles Boss hits without confusing acquisition', () => {
    const observer = new AudioCueObserver();
    const rewards = [{ id: 1, hitProgress: 0 }, { id: 2, hitProgress: 1 }];
    const boss = { id: 9, hp: 100 };
    expect(observer.observe(1, 1, [{ id: 9 }], rewards, boss, 0)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9 }], rewards, boss, 1)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9 }], [{ id: 1, hitProgress: 1 },
      { id: 2, hitProgress: 3 }], { id: 9, hp: 90 }, 10)).toEqual(['rewardHit', 'bossHit']);
    expect(observer.observe(1, 1, [{ id: 9 }], [{ id: 1, hitProgress: 1 }],
      { id: 9, hp: 80 }, 50)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9 }], [{ id: 1, hitProgress: 2 }],
      { id: 9, hp: 70 }, 111)).toEqual(['rewardHit', 'bossHit']);
    expect(observer.observe(1, 2, [], [], null, 220)).toEqual(['reward', 'rewardHit', 'enemyDeath']);
    observer.reset();
    expect(observer.observe(1, 1, [], [{ id: 1, hitProgress: 5 }], boss, 0)).toEqual([]);
  });
  it('plays for defense gain, never for projectiles, damage, or Game Over', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(1, 1, [], [], null)).toEqual([]);
    expect(observer.observe(9, 10, [], [], null)).toEqual(['reward']);
    expect(observer.observe(10, 9, [], [], null)).toEqual([]);
    expect(observer.observe(9, 0, [], [], null)).toEqual([]);
    observer.reset();
    expect(observer.observe(1, 1, [], [], null)).toEqual([]);
  });
  it('does not tick when an ignored reward expires without squad growth', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(1, 1, [], [{ id: 4, hitProgress: 2 }], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 50)).toEqual([]);
  });

  it('requests one throttled yelp for removals and resets across Retry', () => {
    const observer = new AudioCueObserver();
    const alive = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(observer.observe(1, 1, alive, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 3 }], [], null, 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, [], [], null, 50)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 4 }], [], null, 100)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 111)).toEqual(['enemyDeath']);
    observer.reset();
    expect(observer.observe(1, 1, alive, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 1)).toEqual(['enemyDeath']);
  });

  it('collapses many same-frame removals to one cue and throttles consecutive mass removals', () => {
    const observer = new AudioCueObserver();
    const crowd = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
    expect(observer.observe(1, 1, crowd, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, crowd.slice(25), [], null, 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, crowd.slice(40), [], null, 20)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 120)).toEqual(['enemyDeath']);
  });

  it('safely ignores playback without an unlocked AudioContext', () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const audio = new GameAudio(viewport as HTMLElement, keys as Window);
    expect(() => audio.play('reward')).not.toThrow();
    expect(() => viewport.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    expect(() => audio.observe(1, 0, [], [], null)).not.toThrow();
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
    audio.play('reward');
    expect(starts).not.toHaveBeenCalled();
    context.state = 'running';
    keys.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.play('reward');
    expect(starts).toHaveBeenCalledOnce();
    audio.resetObservation();
    audio.observe(1, 1, [{ id: 1 }], [], null, 0);
    audio.observe(1, 0, [{ id: 1 }], [], null, 10);
    expect(starts).toHaveBeenCalledTimes(1);
    audio.observe(0, 1, [{ id: 1 }], [], null, 20);
    expect(starts).toHaveBeenCalledTimes(2);
    audio.observe(1, 1, [], [], null, 30);
    expect(starts).toHaveBeenCalledTimes(4); // Two-oscillator death yelp, once for the frame.
    audio.observe(1, 1, [{ id: 2 }], [], null, 40);
    audio.observe(1, 1, [], [], null, 50);
    expect(starts).toHaveBeenCalledTimes(4);
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.dispose();
    expect(stops).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
