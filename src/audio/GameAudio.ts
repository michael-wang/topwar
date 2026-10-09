import { ObserverVoice } from './ObserverVoice';
import type { ObserverLocale, ObserverMessage } from '../ui/observerLocale';
import { EnvironmentAudioScheduler, type GroundArtilleryAudioEvent } from './EnvironmentAudioScheduler';
import { ProceduralMusic, type MusicFrame } from './ProceduralMusic';
import { BOSS_DEATH_IMPACT_MS } from '../presentation/BossDeathTiming';
import type { GrenadeEvent } from '../simulation/grenade';
import { LOCK_ON_AUDIO_GAP_SECONDS } from '../presentation/ArtilleryWarning';

// Existing audio cue delay is independent of the removed visual crash system.
const GIANT_DEATH_RUMBLE_DELAY_MS = 520;

export type AudioCue = 'levelUp' | 'rifle' | 'machineGun' | 'heavyRifle' | 'rocket' | 'damage' | 'fatal'
  | 'reward' | 'rewardHit' | 'bossHit' | 'bossDeath' | 'enemyHit' | 'enemyDeath'
  | 'giantDeath' | 'groundArtillery' | 'skyFlak' | 'supplyImpact' | 'supplyCrack' | 'supplyOpen' | 'grenadeExplosion'
  | 'enemyCannon' | 'enemyShellImpact' | 'enemyLockOn' | 'radioOpen' | 'radioClose';

interface ObservedEnemy { id: number; hp: number; archetype?: 'grunt' | 'heavy' | 'giant' }
interface ObservedReward { id: number; hitProgress: number }
interface ObservedBoss { id: number; hp: number }
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
  private previousRewards = new Map<number, number>();
  private previousBoss: ObservedBoss | null = null;
  private lastSeenProjectileId = 0;
  private nextShotCueMs = -Infinity;
  private nextMachineGunCueMs = -Infinity;
  private shotCueIndex = 0;
  private nextEnemyCueMs = -Infinity;
  private nextBossHitCueMs = -Infinity;

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], rewards: readonly ObservedReward[],
    boss: ObservedBoss | null, nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): AudioCue[] {
    const cues = new Set<AudioCue>();
    let highestNewRifleTier = 0;
    let newMachineGun = false;
    const previousProjectileId = this.lastSeenProjectileId;
    for (const projectile of projectiles) {
      if (projectile.id > previousProjectileId) {
        if (projectile.kind === 'rocket') cues.add('rocket');
        else if (projectile.kind === 'machineGun') newMachineGun = true;
        else highestNewRifleTier = Math.max(highestNewRifleTier, projectile.tier);
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
    if (highestNewRifleTier > 0 && nowMs >= this.nextShotCueMs) {
      cues.add(highestNewRifleTier > 1 ? 'heavyRifle' : 'rifle');
      this.nextShotCueMs = nowMs + shotCueGapMs(this.shotCueIndex++);
    }
    if (newMachineGun && nowMs >= this.nextMachineGunCueMs) {
      cues.add('machineGun');this.nextMachineGunCueMs = nowMs + MACHINE_GUN_CUE_GAP_MS;
    }
    if (currentDefense > previousDefense) cues.add('reward');
    if (currentDefense < previousDefense) cues.add(currentDefense === 0n || currentDefense === 0 ? 'fatal' : 'damage');
    for (const reward of rewards) {
      const previous = this.previousRewards.get(reward.id);
      if (previous !== undefined && reward.hitProgress > previous) cues.add('rewardHit');
    }
    if (currentDefense > previousDefense
      && [...this.previousRewards.keys()].some((id) => !rewards.some((reward) => reward.id === id))) {
      cues.add('rewardHit');
    }
    this.previousRewards = new Map(rewards.map((reward) => [reward.id, reward.hitProgress]));
    if (boss && this.previousBoss?.id === boss.id && boss.hp < this.previousBoss.hp
      && nowMs >= this.nextBossHitCueMs) {
      cues.add('bossHit');
      this.nextBossHitCueMs = nowMs + 130;
    }
    if (!boss && this.previousBoss) cues.add('bossDeath');
    this.previousBoss = boss ? { ...boss } : null;
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
    this.previousRewards.clear();
    this.previousBoss = null;
    this.lastSeenProjectileId = 0;
    this.nextShotCueMs = -Infinity;
    this.nextMachineGunCueMs = -Infinity;
    this.shotCueIndex = 0;
    this.nextEnemyCueMs = -Infinity;
    this.nextBossHitCueMs = -Infinity;
  }
}

type ToneShape = { from: number; to: number; seconds: number;
  wave: OscillatorType; volume: number; attackSeconds?: number; delaySeconds?: number };
const rewardTone: ToneShape = { from: 630, to: 980, seconds: .14, wave: 'sine', volume: .11 };
const cueShape: Record<AudioCue, ToneShape & { secondary?: ToneShape; tertiary?: ToneShape }> = {
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
  levelUp: { from: 660, to: 880, seconds: .16, wave: 'sine', volume: .17,
    secondary: { from: 880, to: 1320, seconds: .24, wave: 'sine', volume: .14, delaySeconds: .13 } },
  rifle: { from: 1050, to: 280, seconds: .038, wave: 'sawtooth', volume: .09 },
  machineGun: { from: 780, to: 180, seconds: .105, wave: 'sawtooth', volume: .09 },
  heavyRifle: { from: 850, to: 210, seconds: .055, wave: 'sawtooth', volume: .12,
    secondary: { from: 170, to: 75, seconds: .075, wave: 'triangle', volume: .04 } },
  rocket: { from: 160, to: 65, seconds: 0.16, wave: 'sawtooth', volume: 0.08 },
  reward: rewardTone,
  damage: { from: 360, to: 125, seconds: .16, wave: 'triangle', volume: .18,
    secondary: { from: 145, to: 60, seconds: .14, wave: 'sine', volume: .065 } },
  fatal: { from: 300, to: 55, seconds: 0.29, wave: 'sine', volume: .22 },
  rewardHit: { from: 760, to: 950, seconds: 0.06, wave: 'sine', volume: 0.05 },
  enemyHit: { from: 510, to: 255, seconds: .095, wave: 'triangle', volume: .043,
    attackSeconds: .011,
    secondary: { from: 790, to: 380, seconds: .08, wave: 'sine', volume: .015,
      attackSeconds: .015 } },
  enemyDeath: { from: 590, to: 190, seconds: .18, wave: 'triangle', volume: .057,
    attackSeconds: .018,
    secondary: { from: 930, to: 285, seconds: .145, wave: 'sine', volume: .019,
      attackSeconds: .023 } },
  bossHit: { from: 125, to: 52, seconds: .13, wave: 'triangle', volume: .11,
    secondary: { from: 460, to: 180, seconds: .075, wave: 'sine', volume: .027 } },
  giantDeath: { from: 180, to: 60, seconds: .14, wave: 'triangle', volume: .15,
    secondary: { from: 95, to: 26, seconds: .6, wave: 'triangle', volume: .22,
      delaySeconds: GIANT_DEATH_RUMBLE_DELAY_MS / 1000, attackSeconds: .012 },
    tertiary: { from: 480, to: 95, seconds: .35, wave: 'sawtooth', volume: .065,
      delaySeconds: GIANT_DEATH_RUMBLE_DELAY_MS / 1000 + .04 } },
  bossDeath: { from: 285, to: 90, seconds: 1.08, wave: 'triangle', volume: .23,
    attackSeconds: .04,
    secondary: { from: 440, to: 135, seconds: .88, wave: 'sine', volume: .075,
      attackSeconds: .05 },
    tertiary: { from: 105, to: 33, seconds: .46, wave: 'sine', volume: .095,
      delaySeconds: BOSS_DEATH_IMPACT_MS / 1000 } },
  groundArtillery: { from: 120, to: 44, seconds: .22, wave: 'triangle', volume: .14,
    secondary: { from: 74, to: 32, seconds: 1, wave: 'sine', volume: .065,
      delaySeconds: .05, attackSeconds: .1 } },
  skyFlak: { from: 260, to: 90, seconds: .19, wave: 'triangle', volume: .05 },
};

export type AudioActivationResult = 'running' | 'unavailable' | 'denied';
export const AUDIO_ACTIVATION_TIMEOUT_MS = 1000;

export class GameAudio {
  getDebugStats(): { musicVoices: number; sfxSources: number } {
    return { musicVoices: this.music?.activeVoiceCount ?? 0, sfxSources: this.active.size };
  }
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private weaponBus: GainNode | null = null;
  private radioDuckBus: GainNode | null = null;
  private voice: ObserverVoice | null = null;
  private radioActive = false;
  private readonly radioSources = new Set<AudioScheduledSourceNode>();
  private supplyRewardAtMs: number | null = null;
  private readonly active = new Set<AudioScheduledSourceNode>();
  private rumbleBuffer: AudioBuffer | null = null;
  private grenadeBuffer: AudioBuffer | null = null;
  private readonly grenadeSources = new Set<AudioScheduledSourceNode>();
  private readonly artillerySources = new Set<AudioScheduledSourceNode>();
  private lastGrenadeAudioSeconds = -Infinity;
  private lastLockOnSeconds = -Infinity;
  private readonly observer = new AudioCueObserver();
  private readonly environment = new EnvironmentAudioScheduler();
  private music: ProceduralMusic | null = null;
  private musicPresentationMs = 0;
  private nextEnvironmentCueMs = -Infinity;
  private unlocked = false;
  private disposed = false;

  private activation: Promise<AudioActivationResult> | null = null;

  get needsResume(): boolean {
    return !!this.context && this.context.state === 'suspended';
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
      // Some browsers leave resume pending; audio must never trap the ready screen.
      const resumed = context.resume();
      this.activation = new Promise<AudioActivationResult>((resolve) => {
        const timeout = setTimeout(() => resolve('denied'), AUDIO_ACTIVATION_TIMEOUT_MS);
        void resumed.then(() => {
          clearTimeout(timeout);
          if (this.disposed) return resolve('unavailable');
          this.unlocked = context.state === 'running';
          resolve(this.unlocked ? 'running' : 'denied');
        }, () => { clearTimeout(timeout); resolve('denied'); });
      }).finally(() => { this.activation = null; });
      return this.activation;
    } catch {
      return Promise.resolve('denied');
    }
  }

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], rewards: readonly ObservedReward[],
    boss: ObservedBoss | null, nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): void {
    this.musicPresentationMs = nowMs;
    for (const cue of this.observer.observe(previousDefense, currentDefense, enemies,
      rewards, boss, nowMs, projectiles)) this.play(cue);
  }

  resetObservation(): void {
    this.syncRadio('en', null, false);
    this.silenceArtillery();
    this.lastGrenadeAudioSeconds = -Infinity; this.grenadeSources.clear();
    this.supplyRewardAtMs=null;
    // Retry/load must not play a crash scheduled by the previous run's lethal hit.
    for (const source of this.active) { try { source.stop(); } catch { /* already ended */ } }
    this.radioSources.clear();
    this.observer.reset();
    this.environment.reset();
    this.nextEnvironmentCueMs = -Infinity;
    this.musicPresentationMs = 0;
    this.music?.reset();
    if(this.weaponBus&&this.context){this.weaponBus.gain.cancelScheduledValues(this.context.currentTime);this.weaponBus.gain.value=1;}
  }

  updateMusic(presentationMs: number, frame: MusicFrame): void {
    this.musicPresentationMs = presentationMs;
    if (!this.unlocked || !this.context || this.context.state !== 'running' || !this.master) return;
    this.music ??= new ProceduralMusic(this.context, this.master);
    this.music.update(presentationMs, { ...frame, musicVolume: frame.musicVolume * (this.radioActive ? .65 : 1) });
  }

  syncRadio(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds = Infinity,
    message: ObserverMessage = 'destroyer'): void {
    if (paused) {
      for (const source of this.radioSources) { try { source.stop(); } catch { /* ended */ } this.active.delete(source); }
      this.radioSources.clear();
    }
    const active = offset !== null && !paused;
    if (active !== this.radioActive && this.radioDuckBus && this.context) {
      const gain = this.radioDuckBus.gain, now = this.context.currentTime;
      gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
      gain.exponentialRampToValueAtTime(active ? .6 : 1, now + .15);
    }
    this.radioActive = active;
    if (!this.unlocked || !this.context || !this.master) return;
    this.voice ??= new ObserverVoice(this.context, this.master);
    this.voice.sync(locale, offset, paused || this.context.state !== 'running', windowSeconds, message);
  }

  silenceMusic(): void { this.music?.silence(); }

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

  updateEnvironment(nowMs: number): void {
    const events = this.environment.update(nowMs);
    for (const event of events) {
      if (nowMs < this.nextEnvironmentCueMs) break;
      if (event.kind === 'groundArtillery') this.play(event.kind, event);
      else this.play(event.kind);
      this.nextEnvironmentCueMs = nowMs + 350;
    }
  }

  play(cue: AudioCue, variation?: GroundArtilleryAudioEvent): void {
    if (cue === 'bossDeath') this.music?.duck(this.musicPresentationMs);
    const context = this.context;
    if (!this.unlocked || !context || context.state !== 'running' || !this.master) return;
    try {
      if (cue === 'enemyLockOn') {
        if (context.currentTime - this.lastLockOnSeconds < LOCK_ON_AUDIO_GAP_SECONDS) return;
        this.lastLockOnSeconds = context.currentTime;
      }
      const artillery = cue === 'enemyCannon' || cue === 'enemyShellImpact';
      // Two four-source reports may overlap; ambient artillery owns a separate scheduler.
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
      const weapon = cue==='rifle'||cue==='machineGun'||cue==='heavyRifle';
      if(weapon&&!this.weaponBus){this.weaponBus=context.createGain();this.weaponBus.gain.value=1;this.radioDuckBus=context.createGain();this.radioDuckBus.gain.value=this.radioActive ? .6 : 1;this.weaponBus.connect(this.radioDuckBus);this.radioDuckBus.connect(this.master);}
      if(cue==='supplyOpen'&&this.weaponBus){
        // Briefly clear space for opening and the unchanged reward chime,
        // including already-playing MG voices. Gameplay fire is unaffected.
        this.weaponBus.gain.cancelScheduledValues(context.currentTime);
        this.weaponBus.gain.setValueAtTime(.3,context.currentTime);
        this.weaponBus.gain.setValueAtTime(.3,context.currentTime+.35);
        this.weaponBus.gain.exponentialRampToValueAtTime(1,context.currentTime+.45);
      }
      const environmental = cue === 'groundArtillery' || cue === 'skyFlak' || cue === 'giantDeath' || cue === 'grenadeExplosion' || artillery;
      const filter = environmental ? context.createBiquadFilter() : null;
      if (filter) {
        filter.type = 'lowpass';
        filter.frequency.value = cue === 'enemyShellImpact' ? 1900 : cue === 'enemyCannon' ? 850
          : cue === 'grenadeExplosion' ? 2400 : cue === 'groundArtillery' ? 380 : 600;
        filter.connect(this.master);
      }
      const start = context.currentTime;
      const volumeScale = cue === 'groundArtillery' ? variation?.volumeScale ?? 1 : 1;
      const durationScale = cue === 'groundArtillery' ? variation?.durationScale ?? 1 : 1;
      const pitchScale = cue === 'groundArtillery' ? variation?.pitchScale ?? 1 : 1;
      const rumbleBuffer = cue === 'groundArtillery' || cue === 'giantDeath'
        ? (this.rumbleBuffer ??= this.createRumbleBuffer(context)) : null;
      const tones = [shape, shape.secondary, shape.tertiary].filter(
        (tone): tone is ToneShape => tone !== undefined);
      let remaining = tones.length + (cue === 'groundArtillery' || cue === 'giantDeath' || cue === 'grenadeExplosion' || artillery ? 1 : 0);
      const playTone = (tone: ToneShape): void => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = start + (tone.delaySeconds ?? 0) * durationScale;
        const toneEnd = toneStart + tone.seconds * durationScale;
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.from * pitchScale, toneStart);
        oscillator.frequency.exponentialRampToValueAtTime(tone.to * pitchScale, toneEnd);
        if (tone.attackSeconds) {
          gain.gain.setValueAtTime(.001, toneStart);
          gain.gain.exponentialRampToValueAtTime(tone.volume * volumeScale,
            toneStart + tone.attackSeconds * durationScale);
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
        if (artillery || cue === 'enemyLockOn') this.artillerySources.add(oscillator);
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
      if (cue === 'groundArtillery' || cue === 'giantDeath') {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = rumbleBuffer;
        const rumbleStart = start + (cue === 'giantDeath' ? GIANT_DEATH_RUMBLE_DELAY_MS / 1000 : .05) * durationScale;
        const rumbleEnd = rumbleStart + (cue === 'giantDeath' ? .6 : 1) * durationScale;
        gain.gain.setValueAtTime(.001, rumbleStart);
        gain.gain.exponentialRampToValueAtTime(.105 * volumeScale,
          rumbleStart + (cue === 'giantDeath' ? .03 : .15) * durationScale);
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
    if (this.disposed) return;
    this.disposed = true;
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
    }
    this.active.clear();
    this.radioSources.clear();
    this.voice?.dispose(); this.voice = null;
    this.radioDuckBus?.disconnect(); this.radioDuckBus = null;
    this.music?.dispose();
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
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.1), context.sampleRate);
    const samples = buffer.getChannelData(0); let seed = 0x48ad71, low = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 0x80000000 - 1, seconds = i / context.sampleRate;
      low = low * .94 + white * .06;
      samples[i] = white * .65 * Math.exp(-seconds * 13) + low * 2.3;
    }
    return buffer;
  }

  private createRumbleBuffer(context: AudioContext): AudioBuffer {
    const frames = Math.ceil(context.sampleRate * 1.7);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x713e9a4d;
    let low = 0;
    for (let index = 0; index < frames; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      low = low * .83 + (seed / 0x80000000 - 1) * .17;
      samples[index] = low;
    }
    return buffer;
  }

}
