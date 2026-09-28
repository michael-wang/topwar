import { bodyModel, helmetModel, vestModel, rifleModel, bulletModel } from './characterModel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { firingRecoil, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectilePulseTracker, ProjectileRenderer, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
import { AudioCueObserver, GameAudio } from '../src/audio/GameAudio';
import { EnvironmentAudioScheduler } from '../src/audio/EnvironmentAudioScheduler';
import { GROUND_ARTILLERY_CUE, SKY_FLAK_CUE } from '../src/audio/EnvironmentAudioCue';
import { ArtilleryScheduler } from '../src/rendering/environment/ArtilleryScheduler';

describe('presentation-only motion', () => {
  it('keeps gameplay X/Z while firing the rifle and showing its muzzle flash', () => {
    expect(firingRecoil(100, 100)).toBe(1);
    expect(firingRecoil(200, 100)).toBe(0);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, bodyModel(), helmetModel(), vestModel(), rifleModel());
    const state = { player: { x: 0.4, z: 3 }, squad: { count: 2, rocketCount: 0,
      rifleCounts: [2], formationSpacing: 0.45 }, track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [], boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
    renderer.update(state, 100);
    const soldiers = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    const positions = soldiers.map((member) => [member.position.x, member.position.z]);
    const soldier = soldiers[0];
    expect(soldier.children).toHaveLength(5);
    const body = soldier.children[0];
    const rifle = soldier.getObjectByName('toy-rifle') as THREE.Mesh;
    const restingZ = rifle.position.z;
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4,
      hitRadiusBonus: 0 }] }, 400);
    expect(soldiers.map((member) => [member.position.x, member.position.z])).toEqual(positions);
    expect(soldiers.every((member) => member.position.y === 0)).toBe(true);
    expect(rifle.position.z).toBeLessThan(restingZ);
    expect(body.rotation.x).toBe(0);
    expect(body.scale.y).toBe(1);
    expect((soldier.getObjectByName('toy-soldier-helmet') as THREE.Mesh).rotation.x).toBe(0);
    expect((soldier.getObjectByName('toy-soldier-vest') as THREE.Mesh).scale.y).toBe(1);
    expect(soldier.children[4].visible).toBe(true);
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4,
      hitRadiusBonus: 0 }] }, 500);
    expect(rifle.position.z).toBeCloseTo(restingZ);
    expect(soldier.children[4].visible).toBe(false);
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
    const renderer = new ProjectileRenderer(scene, bulletModel());
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 1, hitRadiusBonus: 0 },
      { id: 2, kind: 'rifle', tier: 2, x: 0, z: 1, hitRadiusBonus: 0.45 },
      { id: 3, kind: 'rocket', tier: 0, x: 0, z: 1, hitRadiusBonus: 0 }], 100);
    expect(scene.children[0].scale.x).toBe(1);
    expect(scene.children[0].scale.z).toBeCloseTo(1.35);
    expect(scene.children[1].scale.x).toBeGreaterThan(1);
    expect(scene.children[1].scale.z).toBeCloseTo(1.35 * 1.025);
    expect(scene.children[2].scale.x).toBeCloseTo(2.43);
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 2, hitRadiusBonus: 0 }], 200);
    expect(scene.children[0].scale.x).toBe(1);
    renderer.reset();
    renderer.update([{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 2, hitRadiusBonus: 0 }], 210);
    expect(scene.children[0].scale.z).toBeCloseTo(1.35);
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
    expect(observer.observe(1, 1, [{ id: 9, hp: 10 }], rewards, boss, 0)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9, hp: 10 }], rewards, boss, 1)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9, hp: 10 }], [{ id: 1, hitProgress: 1 },
      { id: 2, hitProgress: 3 }], { id: 9, hp: 90 }, 10)).toEqual(['rewardHit', 'bossHit']);
    expect(observer.observe(1, 1, [{ id: 9, hp: 10 }], [{ id: 1, hitProgress: 1 }],
      { id: 9, hp: 80 }, 50)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 9, hp: 10 }], [{ id: 1, hitProgress: 2 }],
      { id: 9, hp: 70 }, 141)).toEqual(['rewardHit', 'bossHit']);
    expect(observer.observe(1, 2, [], [], null, 220))
      .toEqual(['reward', 'rewardHit', 'bossDeath', 'enemyDeath']);
    observer.reset();
    expect(observer.observe(1, 1, [], [{ id: 1, hitProgress: 5 }], boss, 0)).toEqual([]);
  });
  it('restores throttled firing and defense-loss cues without replaying old projectiles', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(1, 1, [], [], null)).toEqual([]);
    const rifle = [{ id: 1, kind: 'rifle' as const, tier: 1 }];
    expect(observer.observe(1, 1, [], [], null, 0, rifle)).toEqual(['rifle']);
    expect(observer.observe(1, 1, [], [], null, 10, rifle)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 100,
      [{ id: 2, kind: 'rifle', tier: 1 }])).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 221,
      [{ id: 3, kind: 'rifle', tier: 2 }])).toEqual(['heavyRifle']);
    expect(observer.observe(1, 1, [], [], null, 222,
      [{ id: 4, kind: 'rocket', tier: 1 }])).toEqual(['rocket']);
    expect(observer.observe(9, 10, [], [], null)).toEqual(['reward']);
    expect(observer.observe(10, 9, [], [], null)).toEqual(['damage']);
    expect(observer.observe(9, 0n, [], [], null)).toEqual(['fatal']);
    observer.reset();
    expect(observer.observe(1, 1, [], [], null, 0, rifle)).toEqual(['rifle']);
  });
  it('does not tick when an ignored reward expires without squad growth', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(1, 1, [], [{ id: 4, hitProgress: 2 }], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 50)).toEqual([]);
  });

  it('distinguishes surviving hits and deaths, then resets across Retry', () => {
    const observer = new AudioCueObserver();
    const alive = [{ id: 1, hp: 10 }, { id: 2, hp: 10 }, { id: 3, hp: 10 }];
    expect(observer.observe(1, 1, alive, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 3, hp: 8 }], [], null, 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, [], [], null, 50)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 4, hp: 10 }], [], null, 100)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 111)).toEqual(['enemyDeath']);
    observer.reset();
    expect(observer.observe(1, 1, alive, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, alive.map((enemy) => ({ ...enemy, hp: 9 })),
      [], null, 1)).toEqual(['enemyHit']);
    expect(observer.observe(1, 1, [], [], null, 2)).toEqual([]);
    observer.reset();
    expect(observer.observe(1, 1, [], [], null, 0)).toEqual([]);
  });

  it('collapses many same-frame removals to one cue and throttles consecutive mass removals', () => {
    const observer = new AudioCueObserver();
    const crowd = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, hp: 10 }));
    expect(observer.observe(1, 1, crowd, [], null, 0)).toEqual([]);
    expect(observer.observe(1, 1, crowd.slice(25), [], null, 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, crowd.slice(40), [], null, 20)).toEqual([]);
    expect(observer.observe(1, 1, [], [], null, 120)).toEqual(['enemyDeath']);
  });

  it('observes Boss hits and one death solely on the Boss channel', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(10, 10, [], [], { id: 7, hp: 100 }, 0)).toEqual([]);
    expect(observer.observe(10, 10, [], [], { id: 7, hp: 90 }, 10)).toEqual(['bossHit']);
    expect(observer.observe(10, 10, [], [], { id: 7, hp: 80 }, 80)).toEqual([]);
    expect(observer.observe(10, 10, [], [], { id: 7, hp: 70 }, 141)).toEqual(['bossHit']);
    expect(observer.observe(10, 10, [], [], null, 150)).toEqual(['bossDeath']);
    expect(observer.observe(10, 10, [], [], null, 160)).toEqual([]);
    observer.reset();
    expect(observer.observe(10, 10, [], [], null, 0)).toEqual([]);
  });

  it('uses defense loss for both normal contact and Boss slam, with fatal priority', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(10, 9, [], [], null)).toEqual(['damage']);
    expect(observer.observe(9, 8, [], [], { id: 1, hp: 100 })).toEqual(['damage']);
    expect(observer.observe(8, 0, [], [], { id: 1, hp: 100 })).toEqual(['fatal']);
  });

  it('safely ignores playback without an unlocked AudioContext', () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const addViewport = vi.spyOn(viewport, 'addEventListener');
    const audio = new GameAudio(viewport as HTMLElement, keys as Window);
    expect(addViewport).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(() => audio.play('reward')).not.toThrow();
    expect(() => viewport.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    expect(() => audio.observe(1, 0, [], [], null)).not.toThrow();
    const removeViewport = vi.spyOn(viewport, 'removeEventListener');
    const removeKeys = vi.spyOn(keys, 'removeEventListener');
    audio.dispose();
    expect(removeViewport).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(removeKeys).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('schedules environmental sounds independently of visual impacts and resets safely', () => {
    const scheduler = new EnvironmentAudioScheduler(17);
    const sequence = () => {
      const events: { at: number; cue: number }[] = [];
      for (let index = 0; index < 20; index++) {
        const at = scheduler.nextEventMs;
        events.push({ at, cue: scheduler.update(at) });
      }
      return events;
    };
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Environment scheduling must not consume gameplay RNG');
    });
    const first = sequence();
    scheduler.reset();
    expect(sequence()).toEqual(first);
    random.mockRestore();
    expect(first.some((event) => event.cue & GROUND_ARTILLERY_CUE)).toBe(true);
    expect(first.some((event) => event.cue & SKY_FLAK_CUE)).toBe(true);
    const visual = new ArtilleryScheduler();
    const independentAudio = new EnvironmentAudioScheduler();
    expect(independentAudio.nextGroundAtMs).not.toBe(visual.nextImpactAtMs);
    const intervalScheduler = new EnvironmentAudioScheduler(17);
    for (let index = 0; index < 20; index++) {
      const groundAt = intervalScheduler.nextGroundAtMs;
      const flakAt = intervalScheduler.nextFlakAtMs;
      const at = intervalScheduler.nextEventMs;
      intervalScheduler.update(at);
      if (at === groundAt) expect(intervalScheduler.nextGroundAtMs - at)
        .toBeGreaterThanOrEqual(2000);
      if (at === groundAt) expect(intervalScheduler.nextGroundAtMs - at)
        .toBeLessThanOrEqual(5000);
      if (at === flakAt) expect(intervalScheduler.nextFlakAtMs - at)
        .toBeGreaterThanOrEqual(3500);
      if (at === flakAt) expect(intervalScheduler.nextFlakAtMs - at)
        .toBeLessThanOrEqual(7000);
    }
    const audio = new GameAudio(new EventTarget() as HTMLElement, new EventTarget() as Window);
    const play = vi.spyOn(audio, 'play');
    const defaultSchedule = new EnvironmentAudioScheduler();
    audio.updateEnvironment(0);
    expect(play).not.toHaveBeenCalled();
    for (let index = 0; index < 8; index++) {
      const at = defaultSchedule.nextEventMs;
      defaultSchedule.update(at);
      audio.updateEnvironment(at);
    }
    expect(play.mock.calls.some(([cue]) => cue === 'groundArtillery')).toBe(true);
    expect(play.mock.calls.some(([cue]) => cue === 'skyFlak')).toBe(true);
    audio.resetObservation();
    play.mockClear();
    audio.updateEnvironment(defaultSchedule.nextEventMs);
    expect(play).toHaveBeenCalled();
    audio.dispose();
  });

  it('unlocks once, ignores suspension, and keeps its context across observation resets', async () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const starts = vi.fn();
    const stops = vi.fn();
    const oscillators: { type: string; frequency: { setValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
    const oscillator = () => {
      const node = { type: 'sine', frequency: { setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(),
      start: starts, stop: stops, onended: null };
      oscillators.push(node);
      return node;
    };
    const gains: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
    function gain() {
      const node = { gain: { value: 0, setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    }
    const filters: { type: string; frequency: { value: number } }[] = [];
    const context = { state: 'suspended', currentTime: 0, destination: {},
      createOscillator: vi.fn(oscillator), createGain: vi.fn(gain),
      createBiquadFilter: vi.fn(() => {
        const filter = { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
        filters.push(filter);
        return filter;
      }),
      resume: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    const audio = new GameAudio(viewport as HTMLElement, keys as Window);
    viewport.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(gains[0].gain.value).toBe(.70);
    audio.play('reward');
    expect(starts).not.toHaveBeenCalled();
    context.state = 'running';
    keys.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.play('reward');
    expect(starts).toHaveBeenCalledOnce();
    audio.resetObservation();
    audio.observe(1, 1, [{ id: 1, hp: 10 }], [], null, 0);
    audio.observe(1, 0, [{ id: 1, hp: 10 }], [], null, 10);
    expect(starts).toHaveBeenCalledTimes(2);
    audio.observe(0, 1, [{ id: 1, hp: 10 }], [], null, 20);
    expect(starts).toHaveBeenCalledTimes(3);
    audio.observe(1, 1, [], [], null, 30);
    expect(starts).toHaveBeenCalledTimes(4);
    audio.observe(1, 1, [{ id: 2, hp: 10 }], [], null, 40);
    audio.observe(1, 1, [], [], null, 50);
    expect(starts).toHaveBeenCalledTimes(4);
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.play('rifle');
    expect(gains.at(-1)?.gain.setValueAtTime).toHaveBeenCalledWith(.09, 0);
    const rifleStart = oscillators.at(-1)!.frequency.setValueAtTime.mock.calls[0][0];
    audio.play('enemyHit');
    const enemyStart = oscillators.at(-1)!.frequency.setValueAtTime.mock.calls[0][0];
    const enemyVolume = gains.at(-1)!.gain.setValueAtTime.mock.calls[0][0];
    audio.play('enemyDeath');
    const enemyDeathStart = oscillators.at(-1)!.frequency.setValueAtTime.mock.calls[0][0];
    audio.play('bossHit');
    const bossStart = oscillators.at(-2)!.frequency.setValueAtTime.mock.calls[0][0];
    audio.play('bossDeath');
    const deathDuration = stops.mock.calls.at(-2)![0];
    audio.play('damage');
    const damageVolume = gains.at(-2)!.gain.setValueAtTime.mock.calls[0][0];
    expect(rifleStart).toBeGreaterThan(enemyStart);
    expect(enemyStart).toBeGreaterThan(enemyDeathStart);
    expect(enemyStart).toBeGreaterThan(bossStart);
    expect(deathDuration).toBeGreaterThan(.4);
    expect(damageVolume).toBeGreaterThan(enemyVolume);
    audio.play('groundArtillery');
    audio.play('skyFlak');
    expect(filters.map((filter) => [filter.type, filter.frequency.value]))
      .toEqual([['lowpass', 380], ['lowpass', 600]]);
    expect(gains.at(-2)?.gain.setValueAtTime).toHaveBeenCalledWith(.064, 0);
    expect(gains.at(-1)?.gain.setValueAtTime).toHaveBeenCalledWith(.039, 0);
    audio.dispose();
    expect(stops).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
