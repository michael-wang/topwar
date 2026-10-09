import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ACTIVATION_TIMEOUT_MS, GameAudio } from '../src/audio/GameAudio';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function harness(resume: () => Promise<void>) {
  const master = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = { state: 'suspended', destination: {}, createGain: vi.fn(() => master),
    decodeAudioData: vi.fn(async()=>({duration:5.64} as AudioBuffer)),
    resume: vi.fn(resume), close: vi.fn(async () => {}) };
  const construct = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', construct);
  return { context, construct, master };
}

describe('explicit optional audio activation', () => {
  it.each([500,1000,2000])('separates ready MP3 decoding from a %ims resume without extending the activation deadline',async delay=>{
    vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})));
    const h=harness(()=>new Promise<void>(resolve=>setTimeout(()=>{h.context.state='running';resolve();},delay)));
    const audio=new GameAudio();expect(audio.prepareRadio('zh-TW','missionIntro')).toBe('pending');
    expect(h.construct).not.toHaveBeenCalled();
    const activation=audio.activate();await vi.advanceTimersByTimeAsync(0);
    expect(h.context.decodeAudioData).toHaveBeenCalledOnce();expect(audio.prepareRadio('zh-TW','missionIntro')).toBe('pending');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await activation).toBe(delay>1000?'denied':'running');
    expect(audio.prepareRadio('zh-TW','missionIntro')).toBe(delay>1000?'pending':'ready');
    if(delay>1000){await vi.advanceTimersByTimeAsync(delay-1000);expect(audio.prepareRadio('zh-TW','missionIntro')).toBe('ready');}
    expect(AUDIO_ACTIVATION_TIMEOUT_MS).toBe(1000);audio.dispose();
  });
  it('reports denied activation separately from pending preparation and never requires another Start gesture',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})));
    harness(async()=>{throw Error('NotAllowedError');});const audio=new GameAudio();
    audio.prepareRadio('zh-TW','missionIntro');expect(await audio.activate()).toBe('denied');
    expect(audio.prepareRadio('zh-TW','missionIntro')).toBe('unavailable');audio.dispose();
  });
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
