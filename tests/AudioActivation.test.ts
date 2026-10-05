import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ACTIVATION_TIMEOUT_MS, GameAudio } from '../src/audio/GameAudio';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function harness(resume: () => Promise<void>) {
  const master = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = { state: 'suspended', destination: {}, createGain: vi.fn(() => master),
    resume: vi.fn(resume), close: vi.fn(async () => {}) };
  const construct = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', construct);
  return { context, construct, master };
}

describe('explicit optional audio activation', () => {
  it('is lazy, awaits resume, coalesces activation and reuses the context on Retry', async () => {
    let resume!: () => void;
    const h = harness(() => new Promise<void>(resolve => { resume = resolve; }));
    const audio = new GameAudio();
    expect(h.construct).not.toHaveBeenCalled();
    const activation = audio.activate();
    expect(audio.activate()).toBe(activation);
    expect(h.context.resume).toHaveBeenCalledOnce();
    expect(h.master.connect).toHaveBeenCalledWith(h.context.destination);
    h.context.state = 'running'; resume();
    expect(await activation).toBe('running');
    audio.resetObservation();
    expect(await audio.activate()).toBe('running');
    expect(h.construct).toHaveBeenCalledOnce();
    expect(h.context.resume).toHaveBeenCalledOnce();
    audio.dispose();
  });

  it('reports unsupported and rejected audio without throwing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const unsupported = new GameAudio();
    expect(await unsupported.activate()).toBe('unavailable');
    unsupported.dispose();
    harness(async () => { throw new Error('NotAllowedError'); });
    const denied = new GameAudio();
    expect(await denied.activate()).toBe('denied');
    denied.dispose();
  });

  it('bounds a hanging browser resume so gameplay can still start', async () => {
    vi.useFakeTimers();
    harness(() => new Promise<void>(() => {}));
    const audio = new GameAudio();
    const activation = audio.activate();
    await vi.advanceTimersByTimeAsync(AUDIO_ACTIVATION_TIMEOUT_MS);
    expect(await activation).toBe('denied');
    audio.dispose();
  });

  it('allows gesture-owned lifecycle resume without replacing the context or timeline', async () => {
    const h = harness(async () => { h.context.state = 'running'; });
    const audio = new GameAudio();
    await audio.activate();
    h.context.state = 'suspended';
    expect(audio.needsResume).toBe(true);
    expect(await audio.activate()).toBe('running');
    expect(h.construct).toHaveBeenCalledOnce();
    expect(h.context.resume).toHaveBeenCalledTimes(2);
    audio.dispose();
  });
});
