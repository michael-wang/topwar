import { playerFamily } from './characterModel';
import { bodyModel, helmetModel, vestModel, rifleModel } from './characterModel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { firingRecoil, SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { ProjectilePulseTracker, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
import { AudioCueObserver, GameAudio, shotCueGapMs } from '../src/audio/GameAudio';

describe('presentation-only motion', () => {
  it('keeps gameplay X/Z while firing the rifle and showing its muzzle flash', () => {
    expect(firingRecoil(100, 100)).toBe(1);
    expect(firingRecoil(250, 100)).toBe(0);
    const scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, playerFamily(bodyModel(), helmetModel(), vestModel(), rifleModel()));
    const state = { player: { x: 0.4, z: 3 }, squad: { count: 2, rocketCount: 0,
      rifleCounts: [2], formationSpacing: 0.45 }, track: { halfWidth: 2.5, defenseLineZ: 1.5 },
      enemies: [], projectiles: [] };
    renderer.update(state, 100);
    const soldiers = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group);
    const positions = soldiers.map((member) => [member.position.x, member.position.z]);
    const soldier = soldiers[0];
    expect(soldier.children).toHaveLength(4);
    const body = soldier.children[0];
    const rifle = soldier.getObjectByName('toy-rifle') as THREE.Mesh;
    const restingZ = rifle.position.z;
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4,
      hitRadiusBonus: 0 }] }, 400);
    expect(soldiers.map((member) => [member.position.x, member.position.z])).toEqual(positions);
    expect(soldiers.every((member) => member.position.y === 0)).toBe(true);
    expect(rifle.position.z).toBeLessThan(restingZ);
    expect(body.rotation.x).toBeLessThan(0);
    expect(body.scale.y).toBe(1);
    expect((soldier.getObjectByName('toy-soldier-helmet') as THREE.Mesh).rotation.x).toBe(0);
    expect((soldier.getObjectByName('toy-soldier-vest') as THREE.Mesh).scale.y).toBe(1);
    expect(soldier.getObjectByName('muzzle-flash')!.visible).toBe(true);
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4,
      hitRadiusBonus: 0 }] }, 600);
    expect(rifle.position.z).toBeCloseTo(restingZ);
    expect(soldier.getObjectByName('muzzle-flash')!.visible).toBe(false);
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

  });
});

describe('audio cue observation and safety', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('restores throttled firing and defense-loss cues without replaying old projectiles', () => {
    const observer = new AudioCueObserver();
    expect(observer.observe(1, 1, [])).toEqual([]);
    const rifle = [{ id: 1, kind: 'rifle' as const, tier: 1 }];
    expect(observer.observe(1, 1, [], 0, rifle)).toEqual(['rifle']);
    expect(observer.observe(1, 1, [], 10, rifle)).toEqual([]);
    expect(observer.observe(1, 1, [], 100,
      [{ id: 2, kind: 'rifle', tier: 1 }])).toEqual([]);
    expect(observer.observe(1, 1, [], 250,
      [{ id: 3, kind: 'rifle', tier: 1 }])).toEqual(['rifle']);
    expect(observer.observe(9, 10, [])).toEqual(['reward']);
    expect(observer.observe(10, 9, [])).toEqual(['damage']);
    expect(observer.observe(9, 0n, [])).toEqual(['fatal']);
    observer.reset();
    expect(observer.observe(1, 1, [], 0, rifle)).toEqual(['rifle']);
  });
  it('uses a deterministic varying 150–260 ms rifle-audio gate', () => {
    const gaps = Array.from({ length: 24 }, (_, index) => shotCueGapMs(index));
    expect(gaps.every((gap) => gap >= 150 && gap <= 260)).toBe(true);
    expect(new Set(gaps).size).toBeGreaterThan(12);
    const observer = new AudioCueObserver();
    const shot = (id: number, at: number) => observer.observe(1, 1, [],
      at, [{ id, kind: 'rifle', tier: 1 }]);
    expect(shot(1, 0)).toEqual(['rifle']);
    expect(shot(2, gaps[0] - 1)).toEqual([]);
    expect(shot(3, gaps[0])).toEqual(['rifle']);
    expect(shot(4, gaps[0] + gaps[1])).toEqual(['rifle']);
    observer.reset();
    expect(shot(1, 0)).toEqual(['rifle']);
    expect(shot(2, gaps[0] - 1)).toEqual([]);
  });

  it('distinguishes surviving hits and deaths, then resets across Retry', () => {
    const observer = new AudioCueObserver();
    const alive = [{ id: 1, hp: 10 }, { id: 2, hp: 10 }, { id: 3, hp: 10 }];
    expect(observer.observe(1, 1, alive, 0)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 3, hp: 8 }], 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, [], 50)).toEqual([]);
    expect(observer.observe(1, 1, [{ id: 4, hp: 10 }], 100)).toEqual([]);
    expect(observer.observe(1, 1, [], 131)).toEqual(['enemyDeath']);
    observer.reset();
    expect(observer.observe(1, 1, alive, 0)).toEqual([]);
    expect(observer.observe(1, 1, alive.map((enemy) => ({ ...enemy, hp: 9 })), 1)).toEqual(['enemyHit']);
    expect(observer.observe(1, 1, [], 2)).toEqual([]);
    observer.reset();
    expect(observer.observe(1, 1, [], 0)).toEqual([]);
  });

  it('collapses many same-frame removals to one cue and throttles consecutive mass removals', () => {
    const observer = new AudioCueObserver();
    const crowd = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, hp: 10 }));
    expect(observer.observe(1, 1, crowd, 0)).toEqual([]);
    expect(observer.observe(1, 1, crowd.slice(25), 10)).toEqual(['enemyDeath']);
    expect(observer.observe(1, 1, crowd.slice(40), 20)).toEqual([]);
    expect(observer.observe(1, 1, [], 130)).toEqual(['enemyDeath']);
  });

  it('safely ignores playback without an unlocked AudioContext', () => {
    const viewport = new EventTarget();
    const keys = new EventTarget();
    const addViewport = vi.spyOn(viewport, 'addEventListener');
    const audio = new GameAudio();
    expect(addViewport).not.toHaveBeenCalled();
    expect(() => audio.play('reward')).not.toThrow();
    expect(() => viewport.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    expect(() => audio.observe(1, 0, [])).not.toThrow();
    const removeViewport = vi.spyOn(viewport, 'removeEventListener');
    const removeKeys = vi.spyOn(keys, 'removeEventListener');
    audio.dispose();
    expect(removeViewport).not.toHaveBeenCalled();
    expect(removeKeys).not.toHaveBeenCalled();
  });

  it('activates explicitly, tolerates suspension, and keeps its context across observation resets', async () => {
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
    const gains: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
    function gain() {
      const node = { gain: { value: 0, setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    }
    const filters: { type: string; frequency: { value: number } }[] = [];
    const buffers: Float32Array[] = [];
    const context = { state: 'suspended', currentTime: 0, sampleRate: 8000, destination: {},
      createOscillator: vi.fn(oscillator), createGain: vi.fn(gain),
      createBuffer: vi.fn((_channels: number, frames: number) => {
        const samples = new Float32Array(frames);
        buffers.push(samples);
        return { getChannelData: () => samples };
      }),
      createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(),
        disconnect: vi.fn(), start: starts, stop: stops, onended: null })),
      createBiquadFilter: vi.fn(() => {
        const filter = { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
        filters.push(filter);
        return filter;
      }),
      resume: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    const audio = new GameAudio();
    expect(await audio.activate()).toBe('denied');
    expect(gains[0].gain.value).toBe(.70);
    audio.play('reward');
    expect(starts).not.toHaveBeenCalled();
    context.state = 'running';
    expect(await audio.activate()).toBe('running');
    expect(constructor).toHaveBeenCalledTimes(1);
    audio.play('reward');
    expect(starts).toHaveBeenCalledOnce();
    audio.resetObservation();
    audio.observe(1, 1, [{ id: 1, hp: 10 }], 0);
    audio.observe(1, 0, [{ id: 1, hp: 10 }], 10);
    expect(starts).toHaveBeenCalledTimes(2);
    audio.observe(0, 1, [{ id: 1, hp: 10 }], 20);
    expect(starts).toHaveBeenCalledTimes(3);
    audio.observe(1, 1, [], 30);
    expect(starts).toHaveBeenCalledTimes(5);
    audio.observe(1, 1, [{ id: 2, hp: 10 }], 40);
    audio.observe(1, 1, [], 50);
    expect(starts).toHaveBeenCalledTimes(5);
    expect(constructor).toHaveBeenCalledTimes(1);
    const renderCue = (cue: Parameters<GameAudio['play']>[0]) => {
      const firstOscillator = oscillators.length;
      const firstGain = gains.length;
      const firstStart = starts.mock.calls.length;
      const firstStop = stops.mock.calls.length;
      audio.play(cue);
      const renderedOscillators = oscillators.slice(firstOscillator);
      const renderedGains = gains.slice(firstGain);
      return {
        count: renderedOscillators.length,
        waves: renderedOscillators.map((node) => node.type),
        volumes: renderedGains.map((node) => Math.max(
          ...node.gain.setValueAtTime.mock.calls.map(([value]) => value as number),
          ...node.gain.exponentialRampToValueAtTime.mock.calls.map(
            ([value]) => value as number))),
        attacks: renderedGains.map((node) =>
          node.gain.setValueAtTime.mock.calls[0]?.[0] === .001),
        ends: stops.mock.calls.slice(firstStop).map(([at]) => at as number),
        starts: starts.mock.calls.slice(firstStart).map(([at]) => at as number),
      };
    };
    const rifle = renderCue('rifle');
    const enemyHit = renderCue('enemyHit');
    const enemyDeath = renderCue('enemyDeath');
    const damage = renderCue('damage');
    const fatal = renderCue('fatal');
    expect(rifle.waves).toEqual(['sawtooth']);
    expect(rifle.ends[0]).toBeLessThan(.06);
    expect(enemyHit.waves).toEqual(['triangle', 'sine']);
    expect(enemyDeath.waves).toEqual(['triangle', 'sine']);
    expect(enemyHit.attacks).toEqual([true, true]);
    expect(enemyDeath.attacks).toEqual([true, true]);
    expect(enemyDeath.ends[0]).toBeGreaterThan(enemyHit.ends[0]);
    expect(damage.volumes[0]).toBeCloseTo(.18); // Approved injury profile.
    expect(fatal.volumes[0]).toBeCloseTo(.22);
    const giant = renderCue('giantDeath');
    expect(giant.count).toBe(3);
    expect(giant.starts.at(-1)).toBeCloseTo(.52);
    expect(giant.ends.at(-1)).toBeCloseTo(1.12);
    expect(context.createBuffer).toHaveBeenCalledOnce();
    expect(buffers[0].length).toBe(13600);
    expect(buffers[0].some(sample => sample !== 0)).toBe(true);
    renderCue('giantDeath');
    expect(context.createBuffer).toHaveBeenCalledOnce();
    expect(filters.map(filter => [filter.type, filter.frequency.value]))
      .toEqual([['lowpass', 600], ['lowpass', 600]]);
    audio.dispose();
    expect(stops).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });
});

it('bounds MG shot cues to nine short voices per second without Rifle cues',()=>{
 const observer=new AudioCueObserver();let cues=0;
 for(let i=0;i<180;i++){
  const result=observer.observe(1,1,[],i*1000/18,[{id:i+1,kind:'machineGun',tier:1}]);
  expect(result).not.toContain('rifle');if(result.includes('machineGun'))cues++;
 }
 expect(cues).toBeLessThanOrEqual(90);expect(cues).toBeGreaterThanOrEqual(60);
 observer.reset();expect(observer.observe(1,1,[],0,[{id:1,kind:'machineGun',tier:1}])).toContain('machineGun');
});

const projectileTestCamera = new THREE.PerspectiveCamera(48, 350/844, .1, 180);
