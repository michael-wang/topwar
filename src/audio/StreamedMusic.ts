import { publicAssetUrl } from '../core/publicAssetUrl';
import { isBossMusic, musicStateFor, MUSIC_MAX_VOLUME, type MusicFrame } from './MusicComposition';

/** One reusable streaming source per recording, anchored to the existing presentation clock. */
export class StreamedMusic {
  private readonly media: HTMLAudioElement;
  private readonly source: MediaElementAudioSourceNode;
  private readonly bus: GainNode;
  private playing = false;
  private pending = false;
  private failed = false;
  private generation = 0;
  private engaged = false;
  private target = NaN;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly context: AudioContext, master: GainNode,
    private readonly track: 'boss' | 'victory' = 'boss') {
    this.media = new Audio();
    this.media.preload = 'none';
    this.media.loop = true; // Chromium honours the supplied Xing encoder delay/padding.
    this.source = context.createMediaElementSource(this.media);
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.source.connect(this.bus);
    this.bus.connect(master);
    this.media.onplaying = () => {
      if (!this.media.paused && this.engaged && this.context.state === 'running') this.playing = true;
      this.pending = false;
    };
    this.media.onwaiting = () => { this.playing = false; };
    this.media.onerror = () => { this.failed = true; this.silence(); };
  }

  /** True suppresses the procedural fallback, including its already scheduled voices. */
  update(frame: MusicFrame, radioActive: boolean): boolean {
    if (this.disposed) return false;
    if (frame.paused || frame.musicVolume === 0 || this.context.state !== 'running') {
      this.silence();
      return false;
    }
    const state = musicStateFor(frame);
    const eligible = this.track === 'boss' ? isBossMusic(state)
      : state === 'VICTORY' && frame.victorySeconds != null;
    if (!eligible) {
      if (this.engaged) {
        this.engaged = false;
        this.setGain(0, .06);
        this.fadeTimer = setTimeout(() => { this.fadeTimer = null; this.silence(); }, 250);
      }
      return false;
    }
    this.engaged = true;
    this.cancelFade();
    if (this.failed) return false;
    if (!this.media.src) {
      this.media.src = publicAssetUrl(this.track === 'boss' ? 'audio/boss-theme.mp3' : 'audio/stage1-complete.mp3');
      this.media.preload = 'auto';
    }
    const duration = this.media.duration;
    if (Number.isFinite(duration) && duration > 0) {
      const offset = Math.max(0, this.track === 'boss' ? frame.tank!.elapsedSeconds : frame.victorySeconds!) % duration;
      const drift = Math.abs(this.media.currentTime - offset);
      // Wrap-aware comparison avoids seeking across a natural gapless loop boundary.
      if (!this.pending && (!this.playing || Math.min(drift, duration - drift) > .75)) {
        this.media.currentTime = offset;
      }
    }
    if (!this.playing && !this.pending) {
      this.pending = true;
      const generation = this.generation;
      void this.media.play().catch(error => {
        if (this.disposed || generation !== this.generation) return;
        this.pending = false;
        if (error?.name !== 'AbortError') { this.failed = true; this.silence(); }
      });
    }
    const volume = Math.max(0, Math.min(MUSIC_MAX_VOLUME, frame.musicVolume));
    this.setGain(this.playing ? volume * .7 * (radioActive ? .3 : this.track === 'boss' && frame.tank!.status === 'entering' ? .55 : 1) : 0, .05);
    return this.playing;
  }

  silence(): void {
    this.cancelFade();
    this.generation++;
    this.media.pause();
    this.playing = false;
    this.pending = false;
    this.setGain(0, .015);
  }

  reset(): void {
    this.silence();
    this.engaged = false;
    if (this.failed) this.media.load();
    this.failed = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.silence();
    this.disposed = true;
    this.media.onplaying = this.media.onwaiting = this.media.onerror = null;
    this.media.removeAttribute('src');
    this.media.load();
    this.source.disconnect();
    this.bus.disconnect();
  }

  private cancelFade(): void {
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
  }

  private setGain(value: number, seconds: number): void {
    if (value === this.target) return;
    const now = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(value, now, seconds);
    this.target = value;
  }
}
