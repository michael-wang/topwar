import { supportEngineEnvelope } from '../presentation/SupportFlyover';
import { openingSirenFrequency, openingSirenGain } from '../presentation/OpeningAlertPulse';
import { ObserverVoice, ObserverVoiceFiles, observerVoiceAsset, type ObserverAudioReadiness } from './ObserverVoice';
import { hasPublicAsset, publicAssetUrl } from '../core/publicAssetUrl';
import { StreamedMusic } from './StreamedMusic';
import type { ObserverLocale, ObserverMessage } from '../ui/observerLocale';
import { ProceduralMusic, type MusicFrame } from './ProceduralMusic';
import type { GrenadeEvent } from '../simulation/grenade';
import { LOCK_ON_AUDIO_GAP_SECONDS } from '../presentation/ArtilleryWarning';
import { IdlePreparation } from '../presentation/IdlePreparation';

// Existing audio cue delay is independent of the removed visual crash system.
const GIANT_DEATH_RUMBLE_DELAY_MS = 520;

export type AudioCue = 'levelUp' | 'rifle' | 'machineGun' | 'damage' | 'fatal'
  | 'reward' | 'enemyHit' | 'enemyDeath'
  | 'giantDeath' | 'supplyImpact' | 'supplyCrack' | 'supplyOpen' | 'grenadeLaunch' | 'grenadeExplosion'
  | 'enemyCannon' | 'enemyShellImpact' | 'enemyLockOn' | 'bossAlarm' | 'radioOpen' | 'radioClose';

interface ObservedEnemy { id: number; hp: number; archetype?: 'grunt' | 'heavy' | 'giant' }
interface ObservedProjectile { id: number; kind: 'rifle' | 'machineGun' | 'rocket'; tier: number }
export const MACHINE_GUN_CUE_GAP_MS = 1000 / 9;

// Vary audible samples of deterministic auto-fire without touching weapon timing or gameplay RNG.
export function shotCueGapMs(index: number): number {
  let value = Math.imul(index + 1, 0x9e3779b1) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  return 150 + (value % 111);
}

// Presentation-only observation; enemy IDs restart on Retry.
export class AudioCueObserver {
  private previousGiantIds: number[] = [];
  private previousEnemyHp = new Map<number, number>();
  private lastSeenProjectileId = 0;
  private nextShotCueMs = -Infinity;
  private nextMachineGunCueMs = -Infinity;
  private shotCueIndex = 0;
  private nextEnemyCueMs = -Infinity;

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): AudioCue[] {
    const cues = new Set<AudioCue>();
    let highestNewRifleTier = 0;
    let newMachineGun = false;
    const previousProjectileId = this.lastSeenProjectileId;
    for (const projectile of projectiles) {
      if (projectile.id > previousProjectileId) {
        if (projectile.kind === 'machineGun') newMachineGun = true;
        else highestNewRifleTier = Math.max(highestNewRifleTier, projectile.tier);
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
    if (highestNewRifleTier > 0 && nowMs >= this.nextShotCueMs) {
      cues.add('rifle');
      this.nextShotCueMs = nowMs + shotCueGapMs(this.shotCueIndex++);
    }
    if (newMachineGun && nowMs >= this.nextMachineGunCueMs) {
      cues.add('machineGun');this.nextMachineGunCueMs = nowMs + MACHINE_GUN_CUE_GAP_MS;
    }
    if (currentDefense > previousDefense) cues.add('reward');
    if (currentDefense < previousDefense) cues.add(currentDefense === 0n || currentDefense === 0 ? 'fatal' : 'damage');
    const currentEnemyHp = new Map(enemies.map((enemy) => [enemy.id, enemy.hp]));
    if (currentDefense >= previousDefense && this.previousGiantIds.some(id => !currentEnemyHp.has(id))) cues.add('giantDeath');
    this.previousGiantIds = enemies.filter(enemy => enemy.archetype === 'giant').map(enemy => enemy.id);
    const removed = [...this.previousEnemyHp.keys()].some((id) => !currentEnemyHp.has(id));
    if (nowMs >= this.nextEnemyCueMs) {
      if (removed) cues.add('enemyDeath');
      else if (enemies.some((enemy) => {
        const previous = this.previousEnemyHp.get(enemy.id);
        return previous !== undefined && enemy.hp < previous;
      })) cues.add('enemyHit');
      if (cues.has('enemyHit') || cues.has('enemyDeath')) this.nextEnemyCueMs = nowMs + 120;
    }
    this.previousEnemyHp = currentEnemyHp;
    return [...cues];
  }

  reset(): void {
    this.previousGiantIds = [];
    this.previousEnemyHp.clear();
    this.lastSeenProjectileId = 0;
    this.nextShotCueMs = -Infinity;
    this.nextMachineGunCueMs = -Infinity;
    this.shotCueIndex = 0;
    this.nextEnemyCueMs = -Infinity;
  }
}

type ToneShape = { from: number; to: number; seconds: number;
  wave: OscillatorType; volume: number; attackSeconds?: number; delaySeconds?: number };
const rewardTone: ToneShape = { from: 630, to: 980, seconds: .14, wave: 'sine', volume: .11 };
const cueShape: Record<AudioCue, ToneShape & { secondary?: ToneShape; tertiary?: ToneShape }> = {
  bossAlarm: { from: 480, to: 980, seconds: .24, wave: 'square', volume: .11,
    secondary: { from: 980, to: 480, seconds: .24, wave: 'triangle', volume: .16, delaySeconds: .26 } },
  radioOpen: { from: 920, to: 920, seconds: .085, wave: 'sine', volume: .10,
    secondary: { from: 1280, to: 1280, seconds: .075, wave: 'sine', volume: .07, delaySeconds: .09 } },
  radioClose: { from: 1100, to: 760, seconds: .12, wave: 'sine', volume: .09 },
  enemyLockOn: { from: 880, to: 1200, seconds: .10, wave: 'triangle', volume: .10,
    secondary: { from: 880, to: 1200, seconds: .10, wave: 'triangle', volume: .10, delaySeconds: .14 } },
  enemyCannon: { from: 105, to: 32, seconds: .3, wave: 'triangle', volume: .16,
    secondary: { from: 58, to: 24, seconds: .85, wave: 'sine', volume: .1 },
    tertiary: { from: 270, to: 60, seconds: .10, wave: 'sawtooth', volume: .045 } },
  enemyShellImpact: { from: 185, to: 42, seconds: .16, wave: 'sine', volume: .21,
    secondary: { from: 72, to: 25, seconds: 1, wave: 'triangle', volume: .1, attackSeconds: .02 },
    tertiary: { from: 510, to: 110, seconds: .07, wave: 'sawtooth', volume: .045 } },
  supplyImpact: {from:1900,to:950,seconds:.11,wave:'sine',volume:.09,
    secondary:{from:850,to:430,seconds:.085,wave:'triangle',volume:.06}},
  supplyCrack: {from:240,to:65,seconds:.10,wave:'sawtooth',volume:.085,
    secondary:{from:520,to:110,seconds:.075,wave:'square',volume:.045,delaySeconds:.035}},
  supplyOpen: {from:160,to:48,seconds:.24,wave:'triangle',volume:.15,
    secondary:{from:730,to:85,seconds:.16,wave:'sawtooth',volume:.075}},
  grenadeExplosion: {from:165,to:38,seconds:.22,wave:'sine',volume:.25,
    secondary:{from:68,to:27,seconds:1.05,wave:'triangle',volume:.12,attackSeconds:.025},
    tertiary:{from:440,to:90,seconds:.095,wave:'sawtooth',volume:.065}},
  grenadeLaunch: { from: 2300, to: 450, seconds: .055, wave: 'square', volume: .075,
    secondary: { from: 360, to: 100, seconds: .10, wave: 'triangle', volume: .13 },
    tertiary: { from: 2200, to: 3200, seconds: .19, wave: 'sine', volume: .09, delaySeconds: .045, attackSeconds: .006 } },
  levelUp: { from: 660, to: 880, seconds: .16, wave: 'sine', volume: .17,
    secondary: { from: 880, to: 1320, seconds: .24, wave: 'sine', volume: .14, delaySeconds: .13 } },
  rifle: { from: 1050, to: 280, seconds: .038, wave: 'sawtooth', volume: .09 },
  machineGun: { from: 780, to: 180, seconds: .105, wave: 'sawtooth', volume: .09 },
  reward: rewardTone,
  damage: { from: 360, to: 125, seconds: .16, wave: 'triangle', volume: .18,
    secondary: { from: 145, to: 60, seconds: .14, wave: 'sine', volume: .065 } },
  fatal: { from: 300, to: 55, seconds: 0.29, wave: 'sine', volume: .22 },
  enemyHit: { from: 510, to: 255, seconds: .095, wave: 'triangle', volume: .043,
    attackSeconds: .011,
    secondary: { from: 790, to: 380, seconds: .08, wave: 'sine', volume: .015,
      attackSeconds: .015 } },
  enemyDeath: { from: 590, to: 190, seconds: .18, wave: 'triangle', volume: .057,
    attackSeconds: .018,
    secondary: { from: 930, to: 285, seconds: .145, wave: 'sine', volume: .019,
      attackSeconds: .023 } },
  giantDeath: { from: 180, to: 60, seconds: .14, wave: 'triangle', volume: .15,
    secondary: { from: 95, to: 26, seconds: .6, wave: 'triangle', volume: .22,
      delaySeconds: GIANT_DEATH_RUMBLE_DELAY_MS / 1000, attackSeconds: .012 },
    tertiary: { from: 480, to: 95, seconds: .35, wave: 'sawtooth', volume: .065,
      delaySeconds: GIANT_DEATH_RUMBLE_DELAY_MS / 1000 + .04 } },
};

export type AudioActivationResult = 'running' | 'unavailable' | 'denied';
export const AUDIO_ACTIVATION_TIMEOUT_MS = 1000;

export class GameAudio {
  private openingSiren: { source: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  /** One phase-driven siren; presentation pauses never replay the initial accent. */
  syncOpeningAlert(offset: number | null, paused: boolean): void {
    const c = this.context;
    if (paused) {
      // Keep the one oscillator silent, so rapid Resume cannot duplicate it.
      if (this.openingSiren && c) {
        this.openingSiren.gain.gain.cancelScheduledValues(c.currentTime);
        this.openingSiren.gain.gain.setTargetAtTime(0, c.currentTime, .008);
      }
      return;
    }
    if (offset === null) {
      const node = this.openingSiren;
      if (node) {
        node.gain.gain.cancelScheduledValues(c!.currentTime);
        node.gain.gain.setTargetAtTime(0, c!.currentTime, .008);
        node.source.stop(c!.currentTime + .03); this.openingSiren = null;
      }
      return;
    }
    if (!this.unlocked || !c || c.state !== 'running' || !this.master) return;
    if (!this.openingSiren) {
      const source = c.createOscillator(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.type = 'sawtooth'; filter.type = 'lowpass'; filter.frequency.value = 750;
      gain.gain.value = 0;
      source.connect(filter); filter.connect(gain); gain.connect(this.master);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.active.delete(source); };
      this.openingSiren = { source, filter, gain }; this.active.add(source); source.start();
    }
    const { source, gain } = this.openingSiren;
    source.frequency.value = openingSirenFrequency(offset);
    gain.gain.cancelScheduledValues(c.currentTime);
    gain.gain.setTargetAtTime(openingSirenGain(offset), c.currentTime, .008);
  }
  getDebugStats(): { musicVoices: number; sfxSources: number } {
    return { musicVoices: this.music?.activeVoiceCount ?? 0, sfxSources: this.active.size };
  }
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private weaponBus: GainNode | null = null;
  private weaponDuckUntilSeconds: number | null = null;
  private radioDuckBus: GainNode | null = null;
  private voice: ObserverVoice | null = null;
  private readonly voiceFiles = new ObserverVoiceFiles();
  private readonly preparedRadio = new Map<string, { locale: ObserverLocale; message: ObserverMessage }>();
  private activationDenied = false;
  private radioActive = false;
  private readonly radioSources = new Set<AudioScheduledSourceNode>();
  private supplyRewardAtMs: number | null = null;
  private readonly active = new Set<AudioScheduledSourceNode>();
  private readonly supportSources = new Set<OscillatorNode>();
  private supportEngineBus: GainNode | null = null;
  private supportEngineFilter: BiquadFilterNode | null = null;
  private readonly supportImpactSources = new Set<AudioScheduledSourceNode>();
  private rumbleBuffer: AudioBuffer | null = null;
  private grenadeBuffer: AudioBuffer | null = null;
  private readonly grenadeSources = new Set<AudioScheduledSourceNode>();
  private readonly artillerySources = new Set<AudioScheduledSourceNode>();
  private lastGrenadeAudioSeconds = -Infinity;
  private lastLockOnSeconds = -Infinity;
  private readonly observer = new AudioCueObserver();
  private music: ProceduralMusic | null = null;
  private bossTheme: StreamedMusic | null = null;
  private victoryTheme: StreamedMusic | null = null;
  private musicPresentationMs = 0;
  private unlocked = false;
  private disposed = false;
  private preparation: IdlePreparation | null = null;

  private activation: Promise<AudioActivationResult> | null = null;

  get needsResume(): boolean {
    return !!this.context && this.context.state === 'suspended';
  }
  prepareRadio(locale: ObserverLocale, message: ObserverMessage): ObserverAudioReadiness {
    const asset = observerVoiceAsset(locale, message);
    if (this.disposed || !asset || !globalThis.AudioContext) return 'unavailable';
    if (!this.preparedRadio.has(asset)) this.preparedRadio.set(asset, { locale, message });
    void this.voiceFiles.prefetch(publicAssetUrl(asset));
    const ready = this.voice?.prepare(locale, message) ?? 'pending';
    if (ready === 'unavailable' || this.activationDenied) return 'unavailable';
    return ready === 'ready' && this.unlocked && this.context?.state === 'running' ? 'ready' : 'pending';
  }

  radioDurationSeconds(locale: ObserverLocale, message: ObserverMessage): number | null {
    return this.voice?.durationSeconds(locale, message) ?? null;
  }

  // Called directly within a real app-owned gesture, never from the frame loop.
  activate(): Promise<AudioActivationResult> {
    if (this.disposed) return Promise.resolve('unavailable');
    if (this.unlocked && this.context?.state === 'running') return Promise.resolve('running');
    if (this.activation) return this.activation;
    const Constructor = globalThis.AudioContext;
    if (!Constructor) return Promise.resolve('unavailable');
    try {
      this.context ??= new Constructor();
      const context = this.context;
      if (!this.master) {
        this.master = context.createGain();
        this.master.gain.value = 0.70;
        this.master.connect(context.destination);
      }
      this.activationDenied = false;
      // Create the media bus in the Start/Resume gesture, without requesting the song yet.
      if (!this.bossTheme && globalThis.Audio && hasPublicAsset('audio/boss-theme.mp3')) {
        try { this.bossTheme = new StreamedMusic(context, this.master); }
        catch { /* Keep existing music/voice when media routing is unavailable. */ }
      }
      if (!this.victoryTheme && globalThis.Audio && hasPublicAsset('audio/stage1-complete.mp3')) {
        try { this.victoryTheme = new StreamedMusic(context, this.master, 'victory'); }
        catch { /* Retain the procedural results fallback. */ }
      }
      this.voice ??= new ObserverVoice(context, this.master, undefined, this.voiceFiles.load);
      for (const {locale, message} of this.preparedRadio.values()) this.voice.prepare(locale, message);
      // Some browsers leave resume pending; audio must never trap the ready screen.
      const resumed = context.resume();
      this.activation = new Promise<AudioActivationResult>((resolve) => {
        const timeout = setTimeout(() => resolve('denied'), AUDIO_ACTIVATION_TIMEOUT_MS);
        void resumed.then(() => {
          clearTimeout(timeout);
          if (this.disposed) return resolve('unavailable');
          this.unlocked = context.state === 'running';
          if (this.unlocked && !this.preparation) this.preparation = new IdlePreparation(this.prepareEffects(context));
          resolve(this.unlocked ? 'running' : 'denied');
        }, () => { clearTimeout(timeout); this.activationDenied = true; resolve('denied'); });
      }).finally(() => { this.activation = null; });
      return this.activation;
    } catch {
      this.activationDenied = true;
      return Promise.resolve('denied');
    }
  }

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): void {
    this.musicPresentationMs = nowMs;
    for (const cue of this.observer.observe(previousDefense, currentDefense, enemies,
      nowMs, projectiles)) this.play(cue);
  }

  resetObservation(): void {
    this.syncOpeningAlert(null, false);
    this.syncSupportFlyover(null, true);
    this.syncRadio('en', null, false);
    this.silenceArtillery();
    this.lastGrenadeAudioSeconds = -Infinity; this.grenadeSources.clear();
    this.supplyRewardAtMs=null;
    // Retry/load must not play a crash scheduled by the previous run's lethal hit.
    for (const source of this.active) { try { source.stop(); } catch { /* already ended */ } }
    this.radioSources.clear();
    this.observer.reset();
    this.musicPresentationMs = 0;
    this.music?.reset();
    this.bossTheme?.reset();
    this.victoryTheme?.reset();
    this.weaponDuckUntilSeconds = null;
    if(this.weaponBus&&this.context){this.weaponBus.gain.cancelScheduledValues(this.context.currentTime);this.weaponBus.gain.value=1;}
  }

  restoreObservation(defense: number | bigint, enemies: readonly ObservedEnemy[],
    projectiles: readonly ObservedProjectile[]): void {
    this.resetObservation();
    // Seed prior identities without replaying old shots, kills or acquisitions.
    this.observer.observe(defense, defense, enemies, 0, projectiles);
  }

  updateMusic(presentationMs: number, frame: MusicFrame): void {
    this.musicPresentationMs = presentationMs;
    if (!this.unlocked || !this.context || this.context.state !== 'running' || !this.master) {
      this.bossTheme?.silence();
      this.victoryTheme?.silence();
      return;
    }
    this.music ??= new ProceduralMusic(this.context, this.master);
    const recordedBoss = this.bossTheme?.update(frame, this.radioActive) ?? false;
    const recordedVictory = this.victoryTheme?.update(frame, this.radioActive) ?? false;
    this.music.update(presentationMs, { ...frame, musicVolume: recordedBoss || recordedVictory ? 0 : frame.musicVolume * (this.radioActive ? .65 : 1) });
  }

  syncRadio(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds = Infinity,
    message: ObserverMessage = 'destroyer'): void {
    if (paused) {
      for (const source of this.radioSources) { try { source.stop(); } catch { /* ended */ } this.active.delete(source); }
      this.radioSources.clear();
    }
    const active = offset !== null && !paused;
    if (active !== this.radioActive && this.context) {
      for (const [bus, duck] of [[this.radioDuckBus, .6], [this.supportEngineBus, .38]] as const) {
        if (!bus) continue;
        const gain = bus.gain, now = this.context.currentTime;
        gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
        gain.exponentialRampToValueAtTime(active ? duck : 1, now + .15);
      }
    }
    this.radioActive = active;
    if (!this.unlocked || !this.context || !this.master) return;
    this.voice ??= new ObserverVoice(this.context, this.master, undefined, this.voiceFiles.load);
    this.voice.sync(locale, offset, paused || this.context.state !== 'running', windowSeconds, message);
  }

  silenceMusic(): void { this.music?.silence(); this.bossTheme?.silence(); this.victoryTheme?.silence(); }

  silenceWeapons(): void {
    this.weaponDuckUntilSeconds = null;
    if (!this.weaponBus || !this.context) return;
    const now = this.context.currentTime;
    this.weaponBus.gain.cancelScheduledValues(now);
    this.weaponBus.gain.setTargetAtTime(0, now, .01);
  }

  syncSupportFlyover(offset: number | null, paused: boolean, duration = 1.2, firstImpactSeconds = 7.5, strikeSpacing = .65): void {
    const context = this.context;
    if (paused || offset === null || offset < 0 || offset >= duration) {
      for (const source of this.supportSources) { try { source.stop(); } catch { /* ended */ } this.active.delete(source); }
      this.supportSources.clear();
      if (paused) { for (const source of this.supportImpactSources) { try { source.stop(); } catch { /* ended */ } } this.supportImpactSources.clear(); }
      return;
    }
    if (!this.unlocked || !context || context.state !== 'running' || !this.master || this.supportSources.size) return;
    const heavy = duration > 2, now = context.currentTime, remaining = duration - offset;
    const tone = (from: number, to: number, volume: number, wave: OscillatorType, delay = 0, seconds = remaining, whistle = false) => {
      const source = context.createOscillator(), gain = context.createGain(); source.type = wave;
      const start = now + delay;
      source.frequency.setValueAtTime(from, start); source.frequency.exponentialRampToValueAtTime(to, start + seconds);
      const curve = new Float32Array(heavy && !whistle ? 256 : 48);
      for (let i = 0; i < curve.length; i++) {
        const t = offset + remaining * i / (curve.length - 1);
        curve[i] = Math.max(heavy && !whistle ? 0 : .001, volume * (whistle ? Math.sin(Math.PI * i / (curve.length - 1))
          : heavy ? supportEngineEnvelope(t, firstImpactSeconds, duration) * Math.min(1, i / 2, (curve.length - 1 - i) / 2)
          : Math.sin(Math.PI * t / duration)));
      }
      gain.gain.setValueCurveAtTime(curve, start, seconds);
      source.connect(gain); gain.connect(heavy && !whistle ? this.supportEngineFilter! : this.master!);
      source.onended = () => { source.disconnect(); gain.disconnect(); this.active.delete(source); this.supportSources.delete(source); };
      this.active.add(source); this.supportSources.add(source); source.start(start); source.stop(start + seconds);
    };
    if (heavy) {
      if (!this.supportEngineBus) {
        this.supportEngineBus = context.createGain(); this.supportEngineBus.gain.value = this.radioActive ? .38 : 1;
        this.supportEngineFilter = context.createBiquadFilter(); this.supportEngineFilter.type = 'lowpass';
        this.supportEngineFilter.frequency.value = 520;
        this.supportEngineFilter.connect(this.supportEngineBus); this.supportEngineBus.connect(this.master!);
      }
      // Three detuned engines: deep fundamentals, propeller mid-bass, soft upper body.
      // Their combined un-ducked peak is bounded below .405 before master volume.
      for (let engine = 0; engine < 3; engine++) for (const [base, detune, volume, wave] of
        [[52, 3, .065, 'triangle'], [112, 6, .045, 'sawtooth'], [196, 12, .025, 'sine']] as const) {
        const frequency = base + engine * detune;
        tone(frequency * (.8 ** (offset / duration)), frequency * .8, volume, wave);
      }
      for (let i = 0; i < 6; i++) {
        const end = firstImpactSeconds + i * strikeSpacing, begin = end - .6;
        if (offset < end) { const skipped = Math.max(0, offset - begin);
          tone(1100 * (.22 ** (skipped / .6)), 242, .07, 'sine', Math.max(0, begin - offset), .6 - skipped, true); }
      }
    } else { tone(310 * (65 / 310) ** (offset / duration), 65, .12, 'sawtooth'); tone(145 * (42 / 145) ** (offset / duration), 42, .17, 'triangle'); }
  }

  playSupportImpact(): void {
    const c = this.context;
    if (!this.unlocked || !c || c.state !== 'running' || !this.master) return;
    while (this.supportImpactSources.size > 8) { const old = this.supportImpactSources.values().next().value!; old.stop(); this.supportImpactSources.delete(old); }
    const end = (source: AudioScheduledSourceNode, gain: GainNode) => {
      source.onended = () => { source.disconnect(); gain.disconnect(); this.active.delete(source); this.supportImpactSources.delete(source); };
      this.active.add(source); this.supportImpactSources.add(source);
    };
    for (const [from, to, volume, seconds] of [[190, 65, .19, .38], [85, 38, .15, 1.65]] as const) {
      const source = c.createOscillator(), gain = c.createGain(), now = c.currentTime;
      source.type = 'triangle'; source.frequency.setValueAtTime(from, now); source.frequency.exponentialRampToValueAtTime(to, now + seconds);
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + seconds);
      source.connect(gain); gain.connect(this.master); end(source, gain); source.start(now); source.stop(now + seconds);
    }
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = this.grenadeBuffer ??= this.createGrenadeBuffer(c); source.playbackRate.value = .65;
    gain.gain.setValueAtTime(.22, c.currentTime); gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + 1.5);
    source.connect(gain); gain.connect(this.master); end(source, gain); source.start(); source.stop(c.currentTime + 1.5);
  }

  suspendForBackground(): void {
    this.silenceMusic(); this.silenceArtillery(); this.syncSupportFlyover(null, true);
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  silenceArtillery(): void {
    this.lastLockOnSeconds = -Infinity;
    for (const source of this.artillerySources) { try { source.stop(); } catch { /* already ended */ }
      this.active.delete(source); }
    this.artillerySources.clear();
  }

  presentSupply(events: readonly GrenadeEvent[],nowMs:number):void {
    for(const event of events) {
      if(event.kind==='grenadeSupplyDamaged')this.play(event.stage===1?'supplyImpact':'supplyCrack');
      else if(event.kind==='grenadeSupplyOpened'){this.play('supplyOpen');this.supplyRewardAtMs=nowMs+210;}
    }
    if(this.supplyRewardAtMs!==null&&nowMs>=this.supplyRewardAtMs){this.supplyRewardAtMs=null;this.play('reward');}
  }

  play(cue: AudioCue): void {
    const context = this.context;
    if (!this.unlocked || !context || context.state !== 'running' || !this.master) return;
    try {
      if (cue === 'enemyLockOn') {
        if (context.currentTime - this.lastLockOnSeconds < LOCK_ON_AUDIO_GAP_SECONDS) return;
        this.lastLockOnSeconds = context.currentTime;
      }
      const artillery = cue === 'enemyCannon' || cue === 'enemyShellImpact';
      // Two four-source reports may overlap.
      if (artillery) while (this.artillerySources.size > 4) {
        const source = this.artillerySources.values().next().value!;
        source.stop(); this.artillerySources.delete(source); this.active.delete(source);
      }
      if (cue === 'grenadeExplosion') {
        if (context.currentTime - this.lastGrenadeAudioSeconds < .12) return;
        this.lastGrenadeAudioSeconds = context.currentTime;
        // Four sources per blast; cap even injected/repeated cues at two blasts.
        while (this.grenadeSources.size > 4) {
          const source = this.grenadeSources.values().next().value!;
          source.stop(); this.grenadeSources.delete(source); this.active.delete(source);
        }
      }
      const shape = cueShape[cue];
      const weapon = cue==='rifle'||cue==='machineGun';
      if(weapon&&!this.weaponBus){this.weaponBus=context.createGain();this.weaponBus.gain.value=1;this.radioDuckBus=context.createGain();this.radioDuckBus.gain.value=this.radioActive ? .6 : 1;this.weaponBus.connect(this.radioDuckBus);this.radioDuckBus.connect(this.master);}
      // Short shot sources leave silent gaps: a scheduled ramp alone can leave
      // the shared bus at a stale duck value. Anchor recovery before the next shot.
      if (weapon && this.weaponDuckUntilSeconds !== null && context.currentTime >= this.weaponDuckUntilSeconds) {
        const now = context.currentTime;
        this.weaponBus!.gain.cancelScheduledValues(now);
        this.weaponBus!.gain.setValueAtTime(1, now);
        this.weaponDuckUntilSeconds = null;
      }
      if(cue==='supplyOpen'&&this.weaponBus){
        // Briefly clear space for opening and the unchanged reward chime,
        // including already-playing MG voices. Gameplay fire is unaffected.
        this.weaponBus.gain.cancelScheduledValues(context.currentTime);
        this.weaponBus.gain.setValueAtTime(.3,context.currentTime);
        this.weaponBus.gain.setValueAtTime(.3,context.currentTime+.35);
        this.weaponBus.gain.exponentialRampToValueAtTime(1,context.currentTime+.45);
        this.weaponDuckUntilSeconds = context.currentTime + .45;
      }
      if (cue === 'grenadeLaunch' && this.weaponBus) {
        // Brief release confirmation, affecting weapons only (never radio/warnings/gameplay).
        const gain = this.weaponBus.gain, now = context.currentTime;
        gain.cancelScheduledValues(now); gain.setValueAtTime(.25, now);
        gain.setValueAtTime(.25, now + .16); gain.exponentialRampToValueAtTime(1, now + .26);
        this.weaponDuckUntilSeconds = now + .26;
      }
      const filter = cue === 'giantDeath' || cue === 'grenadeExplosion' || artillery
        ? context.createBiquadFilter() : null;
      if (filter) {
        filter.type = 'lowpass';
        filter.frequency.value = cue === 'enemyShellImpact' ? 1900 : cue === 'enemyCannon' ? 850
          : cue === 'grenadeExplosion' ? 2400 : 600;
        filter.connect(this.master);
      }
      const start = context.currentTime;
      const volumeScale = cue === 'grenadeLaunch' && this.radioActive ? .65 : 1;
      const rumbleBuffer = cue === 'giantDeath'
        ? (this.rumbleBuffer ??= this.createRumbleBuffer(context)) : null;
      const tones = [shape, shape.secondary, shape.tertiary].filter(
        (tone): tone is ToneShape => tone !== undefined);
      let remaining = tones.length + (cue === 'giantDeath' || cue === 'grenadeExplosion' || artillery ? 1 : 0);
      const playTone = (tone: ToneShape): void => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = start + (tone.delaySeconds ?? 0);
        const toneEnd = toneStart + tone.seconds;
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.from, toneStart);
        oscillator.frequency.exponentialRampToValueAtTime(tone.to, toneEnd);
        if (tone.attackSeconds) {
          gain.gain.setValueAtTime(.001, toneStart);
          gain.gain.exponentialRampToValueAtTime(tone.volume * volumeScale,
            toneStart + tone.attackSeconds);
        } else gain.gain.setValueAtTime(tone.volume * volumeScale, toneStart);
        if (cue === 'machineGun') {
          // Two round-like pulses share one short voice; at most nine cue voices
          // per presentation second. Rifle envelopes remain exactly as authored.
          gain.gain.exponentialRampToValueAtTime(.001, toneStart + .04);
          gain.gain.setValueAtTime(tone.volume, toneStart + 1/18);
        }
        gain.gain.exponentialRampToValueAtTime(.001, toneEnd);
        oscillator.connect(gain);
        gain.connect(filter ?? (weapon ? this.weaponBus! : this.master!));
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          if (--remaining === 0) filter?.disconnect();
          this.active.delete(oscillator);
          this.grenadeSources.delete(oscillator);
          this.artillerySources.delete(oscillator);
          this.radioSources.delete(oscillator);
        };
        this.active.add(oscillator);
        if (cue === 'grenadeExplosion') this.grenadeSources.add(oscillator);
        if (artillery || cue === 'enemyLockOn' || cue === 'bossAlarm') this.artillerySources.add(oscillator);
        if (cue === 'radioOpen' || cue === 'radioClose') this.radioSources.add(oscillator);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd);
      };
      for (const tone of tones) playTone(tone);
      if (cue === 'grenadeExplosion' || artillery) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = this.grenadeBuffer ??= this.createGrenadeBuffer(context);
        gain.gain.setValueAtTime(artillery ? .16 : .25, start); gain.gain.exponentialRampToValueAtTime(.001, start + 1.1);
        source.connect(gain); gain.connect(filter!);
        source.onended = () => { source.disconnect(); gain.disconnect(); if (--remaining === 0) filter?.disconnect(); this.active.delete(source); this.grenadeSources.delete(source); this.artillerySources.delete(source); };
        this.active.add(source); (artillery ? this.artillerySources : this.grenadeSources).add(source); source.start(start); source.stop(start + 1.1);
      }
      if (cue === 'giantDeath') {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = rumbleBuffer;
        const rumbleStart = start + GIANT_DEATH_RUMBLE_DELAY_MS / 1000;
        const rumbleEnd = rumbleStart + .6;
        gain.gain.setValueAtTime(.001, rumbleStart);
        gain.gain.exponentialRampToValueAtTime(.105 * volumeScale,
          rumbleStart + .03);
        gain.gain.exponentialRampToValueAtTime(.001, rumbleEnd);
        source.connect(gain);
        gain.connect(filter!);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          if (--remaining === 0) filter?.disconnect();
          this.active.delete(source);
        };
        this.active.add(source);
        source.start(rumbleStart);
        source.stop(rumbleEnd);
      }
    } catch {
      // Audio is optional presentation feedback.
    }
  }

  dispose(): void {
    this.syncOpeningAlert(null, false);
    this.syncSupportFlyover(null, true);
    this.preparation?.dispose(); this.preparation = null;
    if (this.disposed) return;
    this.disposed = true;
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
    }
    this.active.clear();
    this.radioSources.clear();
    this.voice?.dispose(); this.voice = null;
    this.voiceFiles.clear(); this.preparedRadio.clear();
    this.radioDuckBus?.disconnect(); this.radioDuckBus = null;
    this.supportEngineFilter?.disconnect(); this.supportEngineFilter = null;
    this.supportEngineBus?.disconnect(); this.supportEngineBus = null;
    this.music?.dispose();
    this.bossTheme?.dispose(); this.bossTheme = null;
    this.victoryTheme?.dispose(); this.victoryTheme = null;
    this.music = null;
    this.master?.disconnect();
    this.weaponBus?.disconnect();this.weaponBus=null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.rumbleBuffer = null;
    this.grenadeBuffer = null; this.grenadeSources.clear();
    this.artillerySources.clear();
  }

  private createGrenadeBuffer(context: AudioContext): AudioBuffer {
    const steps = this.grenadeSamples(context);
    for (;;) { const next = steps.next(); if (next.done) return next.value; }
  }

  private *prepareEffects(context: AudioContext): Generator<void> {
    if (!this.grenadeBuffer) {
      const buffer = yield* this.grenadeSamples(context);
      this.grenadeBuffer ??= buffer;
    }
    if (!this.rumbleBuffer) {
      const buffer = yield* this.rumbleSamples(context);
      this.rumbleBuffer ??= buffer;
    }
  }

  private *grenadeSamples(context: AudioContext): Generator<void, AudioBuffer> {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.1), context.sampleRate);
    const samples = buffer.getChannelData(0); let seed = 0x48ad71, low = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 0x80000000 - 1, seconds = i / context.sampleRate;
      low = low * .94 + white * .06;
      samples[i] = white * .65 * Math.exp(-seconds * 13) + low * 2.3;
      if (i % 2048 === 2047) yield;
    }
    return buffer;
  }

  private createRumbleBuffer(context: AudioContext): AudioBuffer {
    const steps = this.rumbleSamples(context);
    for (;;) { const next = steps.next(); if (next.done) return next.value; }
  }

  private *rumbleSamples(context: AudioContext): Generator<void, AudioBuffer> {
    const frames = Math.ceil(context.sampleRate * 1.7);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x713e9a4d;
    let low = 0;
    for (let index = 0; index < frames; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      low = low * .83 + (seed / 0x80000000 - 1) * .17;
      samples[index] = low;
      if (index % 2048 === 2047) yield;
    }
    return buffer;
  }

}
