import { afterEach, describe, expect, it, vi } from 'vitest';
import { BossTheme } from '../src/audio/BossTheme';
import type { MusicFrame } from '../src/audio/MusicComposition';
import * as assets from '../src/core/publicAssetUrl';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
const boss = (elapsedSeconds = 0, phase: 1 | 2 | 3 = 1): MusicFrame => ({
  squadCount: 3, paused: false, musicVolume: .22,
  tank: { status: elapsedSeconds < 2.5 ? 'entering' : 'active', phase, elapsedSeconds, entrySeconds: 2.5 },
});
function harness() {
  const media = { src: '', preload: '', loop: false, paused: true, duration: NaN, currentTime: 0,
    onplaying: null as null | (() => void), onwaiting: null as null | (() => void), onerror: null as null | (() => void),
    play: vi.fn(async () => { media.paused = false; }), pause: vi.fn(() => { media.paused = true; }),
    load: vi.fn(), removeAttribute: vi.fn() };
  vi.stubGlobal('Audio', vi.fn(function () { return media; }));
  vi.spyOn(assets, 'publicAssetUrl').mockReturnValue('/topwar/audio/boss-theme.hash.mp3');
  const node = { connect: vi.fn(), disconnect: vi.fn() };
  const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } };
  const context = { currentTime: 0, state: 'running', createMediaElementSource: vi.fn(() => node), createGain: vi.fn(() => gain) };
  const music = new BossTheme(context as unknown as AudioContext, {} as GainNode);
  const ready = () => { media.duration = 135.302; media.paused = false; media.onplaying!(); };
  return { media, context, gain, node, music, ready };
}

describe('streamed original Boss recording', () => {
  it('requests no music at Start; progressively plays only at Boss INTRO, without decoding PCM', () => {
    const h = harness(); expect(h.media.src).toBe(''); expect(h.media.preload).toBe('none');
    expect(h.music.update({ ...boss(), tank: undefined }, false)).toBe(false);
    expect(h.media.play).not.toHaveBeenCalled(); expect(h.context.createMediaElementSource).toHaveBeenCalledOnce();
    expect(h.music.update(boss(), false)).toBe(false); expect(h.media.loop).toBe(true);
    expect(h.media.src).toBe('/topwar/audio/boss-theme.hash.mp3'); expect(h.media.preload).toBe('auto');
    h.ready(); expect(h.music.update(boss(.5), false)).toBe(true);
    expect(h.media.currentTime).toBe(0); // Small natural startup latency doesn't keep seeking.
    h.music.dispose();
  });
  it('keeps one play/source across all phases and seeks delayed starts and saved clocks modulo the song', () => {
    const h = harness(); h.music.update(boss(91, 2), false); h.ready(); h.music.update(boss(91, 2), false);
    expect(h.media.currentTime).toBe(91);
    for (const [phase, at] of [[1, 91.1], [2, 91.2], [3, 91.3]] as const) {
      h.media.currentTime = at; expect(h.music.update(boss(at, phase), false)).toBe(true);
      expect(h.media.currentTime).toBe(at);
    }
    expect(h.media.play).toHaveBeenCalledOnce(); expect(h.context.createMediaElementSource).toHaveBeenCalledOnce();
    h.music.silence(); h.music.update(boss(300, 3), false);
    expect(h.media.currentTime).toBeCloseTo(300 % 135.302); h.music.dispose();
  });
  it('lets the browser loop without a seek at the encoder-trimmed boundary', () => {
    const h = harness(); h.music.update(boss(), false); h.ready(); h.media.currentTime = .02;
    h.music.update(boss(135.29, 3), false); expect(h.media.currentTime).toBe(.02);
    expect(h.media.play).toHaveBeenCalledOnce(); h.music.dispose();
  });
  it('pauses media immediately, resumes the game clock and resets on Retry without another source', () => {
    const h = harness(); h.music.update(boss(30), false); h.ready(); h.music.update(boss(30), false);
    h.music.update({ ...boss(30), paused: true }, false); expect(h.media.paused).toBe(true);
    h.context.currentTime = 100; h.music.update({ ...boss(30), paused: true }, false);
    expect(h.media.currentTime).toBe(30); h.music.update(boss(30), false); expect(h.media.currentTime).toBe(30);
    h.ready(); h.music.reset(); h.music.update(boss(), false); expect(h.media.currentTime).toBe(0);
    expect(h.context.createMediaElementSource).toHaveBeenCalledOnce(); h.music.dispose();
  });
  it('binds to volume and stronger radio ducking, and silences muted/background audio', () => {
    const h = harness(); h.music.update(boss(10), false); h.ready(); h.music.update(boss(10), false);
    expect(h.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .7, 0, .05);
    h.music.update(boss(10), true); expect(h.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .7 * .3, 0, .05);
    h.music.update({ ...boss(10), musicVolume: 0 }, false); expect(h.media.paused).toBe(true);
    h.context.state = 'suspended'; expect(h.music.update(boss(10), false)).toBe(false); h.music.dispose();
  });
  it('fades on death/Game Over, but Pause and Retry cancel the pending fade cleanup', () => {
    vi.useFakeTimers(); const h = harness(); h.music.update(boss(), false); h.ready();
    const death = { ...boss(60), tank: { ...boss(60).tank!, status: 'defeated' as const } };
    expect(h.music.update(death, false)).toBe(false); expect(h.media.paused).toBe(false);
    h.music.update({ ...death, paused: true }, false); expect(h.media.paused).toBe(true);
    h.music.reset(); h.music.update(boss(), false); h.ready(); vi.advanceTimersByTime(300);
    expect(h.media.paused).toBe(false);
    h.music.update({ ...boss(), squadCount: 0 }, false); vi.advanceTimersByTime(250);
    expect(h.media.paused).toBe(true); h.music.dispose();
  });
  it('falls back on load/play error and ignores an old rejected play after Retry', async () => {
    const h = harness(); let reject!: (error: Error) => void;
    h.media.play.mockImplementationOnce(() => new Promise<void>((_, r) => { reject = r; }));
    h.music.update(boss(), false); h.music.reset(); reject(new Error('obsolete request')); await Promise.resolve();
    h.music.update(boss(), false); h.ready(); expect(h.music.update(boss(1), false)).toBe(true);
    h.media.onerror!(); expect(h.music.update(boss(1), false)).toBe(false); expect(h.media.paused).toBe(true);
    h.music.reset(); expect(h.media.load).toHaveBeenCalledOnce(); h.music.update(boss(), false); h.ready();
    expect(h.music.update(boss(), false)).toBe(true); h.music.dispose();
  });
  it('releases the media request, handlers and graph exactly once on Dispose', () => {
    const h = harness(); h.music.update(boss(), false); h.music.dispose(); h.music.dispose();
    expect(h.media.paused).toBe(true); expect(h.media.onplaying).toBeNull(); expect(h.media.onerror).toBeNull();
    expect(h.media.removeAttribute).toHaveBeenCalledWith('src'); expect(h.node.disconnect).toHaveBeenCalledOnce();
    expect(h.music.update(boss(), false)).toBe(false);
  });
});
