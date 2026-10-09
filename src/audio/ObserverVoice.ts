import { publicAssetUrl } from '../core/publicAssetUrl';
import type { ObserverLocale } from '../ui/observerLocale';

// Fill only after recordings and their provenance have been approved. Null never issues a request.
export const observerVoiceAssets: Readonly<Record<ObserverLocale, string | null>> = { 'zh-TW': null, en: null };
export type VoiceLoader = (url: string, context: AudioContext) => Promise<AudioBuffer | null>;
const loadVoice: VoiceLoader = async (url, context) => {
  try {
    const response = await fetch(url);
    return response.ok ? await context.decodeAudioData(await response.arrayBuffer()) : null;
  } catch { return null; }
};

/** One local recording at a time. The offset always follows the presentation's simulation clock. */
export class ObserverVoice {
  private readonly cache = new Map<ObserverLocale, Promise<AudioBuffer | null>>();
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private locale: ObserverLocale | null = null;
  private offset = 0;
  private paused = false;
  private generation = 0;
  private started = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, private readonly output: AudioNode,
    private readonly assets = observerVoiceAssets, private readonly loader: VoiceLoader = loadVoice) {}

  sync(locale: ObserverLocale, offset: number | null, paused: boolean): void {
    if (this.disposed) return;
    if (offset === null) { if (this.locale !== null) this.reset(); return; }
    const changed = this.locale !== locale || this.paused !== paused;
    this.offset = offset;
    if (changed) { this.stop(); this.generation++; this.started = false; }
    this.locale = locale; this.paused = paused;
    const asset = this.assets[locale];
    if (paused || this.started || !asset) return;
    this.started = true;
    const generation = this.generation;
    let pending = this.cache.get(locale);
    if (!pending) {
      pending = this.loader(publicAssetUrl(asset), this.context).catch(() => null);
      this.cache.set(locale, pending);
    }
    void pending.then(buffer => {
      if (!buffer || this.disposed || generation !== this.generation || this.paused
        || this.context.state !== 'running' || this.offset >= buffer.duration) return;
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
  dispose(): void { this.reset(); this.disposed = true; this.cache.clear(); }
}
