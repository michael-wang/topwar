import { publicAssetUrl } from '../core/publicAssetUrl';
import type { ObserverLocale, ObserverMessage } from '../ui/observerLocale';

// User-approved provisional Mandarin recording; English awaits an approved asset.
export const observerVoiceAssets: Readonly<Record<ObserverLocale, string | null>> = {
  'zh-TW': 'audio/observer_destroyer_zh-TW.mp3', en: null,
};
export const observerMissionVoiceAssets: Readonly<Record<ObserverLocale, string | null>> = {
  'zh-TW': 'audio/observer_mission_intro_zh-TW.mp3', en: null,
};
export type ObserverAudioReadiness = 'pending' | 'ready' | 'unavailable';
export function observerVoiceAsset(locale: ObserverLocale, message: ObserverMessage): string | null {
  return (message === 'missionIntro' ? observerMissionVoiceAssets : observerVoiceAssets)[locale];
}
export type VoiceLoader = (url: string, context: AudioContext) => Promise<AudioBuffer | null>;
/** Fetching bytes needs no audio permission. Context creation/playback still belongs to the Start gesture. */
export class ObserverVoiceFiles {
  private readonly files = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly requests = new Set<AbortController>();
  prefetch(url: string): Promise<ArrayBuffer | null> {
    let file = this.files.get(url);
    if (!file) {
      const controller = new AbortController();
      this.requests.add(controller);
      const timeout = setTimeout(() => controller.abort(), 8000);
      file = fetch(url, { signal: controller.signal }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
        .finally(() => { clearTimeout(timeout); this.requests.delete(controller); });
      this.files.set(url, file);
    }
    return file;
  }
  readonly load: VoiceLoader = async (url, context) => {
    try {
      const bytes = await this.prefetch(url);
      return bytes ? await context.decodeAudioData(bytes.slice(0)) : null;
    } catch { return null; }
  };
  clear(): void { for (const request of this.requests) request.abort(); this.requests.clear(); this.files.clear(); }
}
const loadVoice: VoiceLoader = async (url, context) => {
  try {
    const response = await fetch(url);
    return response.ok ? await context.decodeAudioData(await response.arrayBuffer()) : null;
  } catch { return null; }
};

/** One local recording at a time. The offset always follows the presentation's simulation clock. */
export class ObserverVoice {
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();
  private readonly decoded = new Map<string, AudioBuffer | null>();
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private locale: ObserverLocale | null = null;
  private message: ObserverMessage = 'destroyer';
  private offset = 0;
  private windowSeconds = Infinity;
  private paused = false;
  private generation = 0;
  private started = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, private readonly output: AudioNode,
    private readonly assets = observerVoiceAssets, private readonly loader: VoiceLoader = loadVoice,
    private readonly missionAssets = observerMissionVoiceAssets) {}

  private load(locale: ObserverLocale, message: ObserverMessage): Promise<AudioBuffer | null> | null {
    const asset = (message === 'missionIntro' ? this.missionAssets : this.assets)[locale];
    if (!asset) return null;
    let pending = this.cache.get(asset);
    if (!pending) {
      pending = this.loader(publicAssetUrl(asset), this.context).catch(() => null);
      this.cache.set(asset, pending);
      void pending.then(buffer => { if (!this.disposed) this.decoded.set(asset, buffer); });
    }
    return pending;
  }
  prepare(locale: ObserverLocale, message: ObserverMessage): ObserverAudioReadiness {
    const asset = (message === 'missionIntro' ? this.missionAssets : this.assets)[locale];
    if (!asset || this.disposed) return 'unavailable';
    this.load(locale, message);
    return this.decoded.has(asset) ? this.decoded.get(asset) ? 'ready' : 'unavailable' : 'pending';
  }

  sync(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds = Infinity,
    message: ObserverMessage = 'destroyer'): void {
    if (this.disposed) return;
    // Preparation is explicit: an idle sync must not fetch later-use dialogue.
    if (offset === null) { if (this.locale !== null) this.reset(); return; }
    const pending = this.load(locale, message);
    const changed = this.locale !== locale || this.paused !== paused || this.message !== message;
    this.offset = offset;
    this.windowSeconds = windowSeconds;
    if (changed) { this.stop(); this.generation++; this.started = false; }
    this.locale = locale; this.paused = paused; this.message = message;
    if (paused || this.started || !pending) return;
    // The mission presentation owns its bounded readiness wait. Never attach a
    // late-start callback that jumps into the middle of this introduction.
    if (message === 'missionIntro' && this.prepare(locale, message) !== 'ready') return;
    this.started = true;
    const generation = this.generation;
    void pending.then(buffer => {
      if (!buffer || this.disposed || generation !== this.generation || this.paused
        || this.context.state !== 'running' || this.offset >= buffer.duration
        // Historical snapshots keep their old authoritative attack clocks. Use
        // subtitles rather than cutting a newly approved, longer recording short.
        || buffer.duration > this.windowSeconds) return;
      try {
        const source = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        // Mild communication-band coloration, with speech still intelligible on phone speakers.
        filter.type = 'bandpass'; filter.frequency.value = 1600; filter.Q.value = .45;
        gain.gain.value = .8;
        source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(this.output);
        this.source = source; this.filter = filter; this.gain = gain;
        source.onended = () => { if (this.source === source) this.stop(); };
        source.start(0, this.offset);
      } catch { this.stop(); }
    });
  }
  private stop(): void {
    if (this.source) { this.source.onended = null; try { this.source.stop(); } catch { /* ended */ } this.source.disconnect(); }
    this.filter?.disconnect(); this.gain?.disconnect();
    this.source = null; this.filter = null; this.gain = null;
  }
  reset(): void { this.generation++; this.stop(); this.locale = null; this.started = false; this.offset = 0; }
  dispose(): void { this.reset(); this.disposed = true; this.cache.clear(); this.decoded.clear(); }
}
