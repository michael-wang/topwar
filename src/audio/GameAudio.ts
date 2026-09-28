import { EnvironmentAudioScheduler, type GroundArtilleryAudioEvent } from './EnvironmentAudioScheduler';

export type AudioCue = 'rifle' | 'heavyRifle' | 'rocket' | 'damage' | 'fatal'
  | 'reward' | 'rewardHit' | 'bossHit' | 'bossDeath' | 'enemyHit' | 'enemyDeath'
  | 'groundArtillery' | 'skyFlak';

interface ObservedEnemy { id: number; hp: number }
interface ObservedReward { id: number; hitProgress: number }
interface ObservedBoss { id: number; hp: number }
interface ObservedProjectile { id: number; kind: 'rifle' | 'rocket'; tier: number }

// Vary audible samples of deterministic auto-fire without touching weapon timing or gameplay RNG.
export function shotCueGapMs(index: number): number {
  let value = Math.imul(index + 1, 0x9e3779b1) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  return 150 + (value % 111);
}

// Presentation-only observation; enemy IDs restart on Retry.
export class AudioCueObserver {
  private previousEnemyHp = new Map<number, number>();
  private previousRewards = new Map<number, number>();
  private previousBoss: ObservedBoss | null = null;
  private lastSeenProjectileId = 0;
  private nextShotCueMs = -Infinity;
  private shotCueIndex = 0;
  private nextEnemyCueMs = -Infinity;
  private nextBossHitCueMs = -Infinity;

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], rewards: readonly ObservedReward[],
    boss: ObservedBoss | null, nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): AudioCue[] {
    const cues = new Set<AudioCue>();
    let highestNewRifleTier = 0;
    const previousProjectileId = this.lastSeenProjectileId;
    for (const projectile of projectiles) {
      if (projectile.id > previousProjectileId) {
        if (projectile.kind === 'rocket') cues.add('rocket');
        else highestNewRifleTier = Math.max(highestNewRifleTier, projectile.tier);
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
    if (highestNewRifleTier > 0 && nowMs >= this.nextShotCueMs) {
      cues.add(highestNewRifleTier > 1 ? 'heavyRifle' : 'rifle');
      this.nextShotCueMs = nowMs + shotCueGapMs(this.shotCueIndex++);
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
    this.previousEnemyHp.clear();
    this.previousRewards.clear();
    this.previousBoss = null;
    this.lastSeenProjectileId = 0;
    this.nextShotCueMs = -Infinity;
    this.shotCueIndex = 0;
    this.nextEnemyCueMs = -Infinity;
    this.nextBossHitCueMs = -Infinity;
  }
}

type ToneShape = { from: number; to: number; seconds: number;
  wave: OscillatorType; volume: number; attackSeconds?: number; delaySeconds?: number };
const cueShape: Record<AudioCue, ToneShape & { secondary?: ToneShape; tertiary?: ToneShape }> = {
  rifle: { from: 1050, to: 280, seconds: .038, wave: 'sawtooth', volume: .09 },
  heavyRifle: { from: 850, to: 210, seconds: .055, wave: 'sawtooth', volume: .12,
    secondary: { from: 170, to: 75, seconds: .075, wave: 'triangle', volume: .04 } },
  rocket: { from: 160, to: 65, seconds: 0.16, wave: 'sawtooth', volume: 0.08 },
  reward: { from: 630, to: 980, seconds: 0.14, wave: 'sine', volume: 0.11 },
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
  bossDeath: { from: 285, to: 90, seconds: .66, wave: 'triangle', volume: .17,
    attackSeconds: .04,
    secondary: { from: 440, to: 135, seconds: .54, wave: 'sine', volume: .06,
      attackSeconds: .05 },
    tertiary: { from: 105, to: 33, seconds: .46, wave: 'sine', volume: .095,
      delaySeconds: .2 } },
  groundArtillery: { from: 120, to: 44, seconds: .22, wave: 'triangle', volume: .11,
    secondary: { from: 74, to: 32, seconds: 1, wave: 'sine', volume: .055,
      delaySeconds: .05, attackSeconds: .1 } },
  skyFlak: { from: 260, to: 90, seconds: .19, wave: 'triangle', volume: .039 },
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly active = new Set<AudioScheduledSourceNode>();
  private rumbleBuffer: AudioBuffer | null = null;
  private readonly observer = new AudioCueObserver();
  private readonly environment = new EnvironmentAudioScheduler();
  private nextEnvironmentCueMs = -Infinity;
  private unlocked = false;
  private disposed = false;

  constructor(private readonly viewport: HTMLElement, private readonly keyTarget: Window = window) {
    viewport.addEventListener?.('pointerdown', this.unlock, true);
    keyTarget.addEventListener?.('keydown', this.unlock);
  }

  observe(previousDefense: number | bigint, currentDefense: number | bigint,
    enemies: readonly ObservedEnemy[], rewards: readonly ObservedReward[],
    boss: ObservedBoss | null, nowMs = performance.now(),
    projectiles: readonly ObservedProjectile[] = []): void {
    for (const cue of this.observer.observe(previousDefense, currentDefense, enemies,
      rewards, boss, nowMs, projectiles)) this.play(cue);
  }

  resetObservation(): void {
    this.observer.reset();
    this.environment.reset();
    this.nextEnvironmentCueMs = -Infinity;
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
    const context = this.context;
    if (!this.unlocked || !context || context.state !== 'running' || !this.master) return;
    try {
      const shape = cueShape[cue];
      const environmental = cue === 'groundArtillery' || cue === 'skyFlak';
      const filter = environmental ? context.createBiquadFilter() : null;
      if (filter) {
        filter.type = 'lowpass';
        filter.frequency.value = cue === 'groundArtillery' ? 380 : 600;
        filter.connect(this.master);
      }
      const start = context.currentTime;
      const volumeScale = cue === 'groundArtillery' ? variation?.volumeScale ?? 1 : 1;
      const durationScale = cue === 'groundArtillery' ? variation?.durationScale ?? 1 : 1;
      const pitchScale = cue === 'groundArtillery' ? variation?.pitchScale ?? 1 : 1;
      const rumbleBuffer = cue === 'groundArtillery'
        ? (this.rumbleBuffer ??= this.createRumbleBuffer(context)) : null;
      const tones = [shape, shape.secondary, shape.tertiary].filter(
        (tone): tone is ToneShape => tone !== undefined);
      let remaining = tones.length + (cue === 'groundArtillery' ? 1 : 0);
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
        gain.gain.exponentialRampToValueAtTime(.001, toneEnd);
        oscillator.connect(gain);
        gain.connect(filter ?? this.master!);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          if (--remaining === 0) filter?.disconnect();
          this.active.delete(oscillator);
        };
        this.active.add(oscillator);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd);
      };
      for (const tone of tones) playTone(tone);
      if (cue === 'groundArtillery') {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = rumbleBuffer;
        const rumbleStart = start + .05 * durationScale;
        const rumbleEnd = rumbleStart + durationScale;
        gain.gain.setValueAtTime(.001, rumbleStart);
        gain.gain.exponentialRampToValueAtTime(.085 * volumeScale,
          rumbleStart + .15 * durationScale);
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
    this.removeUnlockListeners();
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
    }
    this.active.clear();
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.rumbleBuffer = null;
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

  private readonly unlock = (): void => {
    if (this.disposed || (this.unlocked && this.context?.state === 'running')) return;
    const Constructor = globalThis.AudioContext;
    if (!Constructor) return;
    try {
      this.context ??= new Constructor();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = 0.70;
        this.master.connect(this.context.destination);
      }
      void this.context.resume().then(() => {
        if (this.context?.state === 'running') {
          this.unlocked = true;
        }
      }).catch(() => {});
    } catch {
      // Unsupported or denied Web Audio must not interrupt gameplay.
    }
  };

  private removeUnlockListeners(): void {
    this.viewport.removeEventListener?.('pointerdown', this.unlock, true);
    this.keyTarget.removeEventListener?.('keydown', this.unlock);
  }
}
