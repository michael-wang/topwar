import { GROUND_ARTILLERY_CUE, SKY_FLAK_CUE } from './EnvironmentAudioCue';
import { EnvironmentAudioScheduler } from './EnvironmentAudioScheduler';

export type AudioCue = 'rifle' | 'heavyRifle' | 'rocket' | 'damage' | 'fatal'
  | 'reward' | 'rewardHit' | 'bossHit' | 'bossDeath' | 'enemyHit' | 'enemyDeath'
  | 'groundArtillery' | 'skyFlak';

interface ObservedEnemy { id: number; hp: number }
interface ObservedReward { id: number; hitProgress: number }
interface ObservedBoss { id: number; hp: number }
interface ObservedProjectile { id: number; kind: 'rifle' | 'rocket'; tier: number }

// Presentation-only observation; enemy IDs restart on Retry.
export class AudioCueObserver {
  private previousEnemyHp = new Map<number, number>();
  private previousRewards = new Map<number, number>();
  private previousBoss: ObservedBoss | null = null;
  private lastSeenProjectileId = 0;
  private nextShotCueMs = -Infinity;
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
      this.nextShotCueMs = nowMs + 220;
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
      if (cues.has('enemyHit') || cues.has('enemyDeath')) this.nextEnemyCueMs = nowMs + 90;
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
    this.nextEnemyCueMs = -Infinity;
    this.nextBossHitCueMs = -Infinity;
  }
}

type ToneShape = { from: number; to: number; seconds: number;
  wave: OscillatorType; volume: number };
const cueShape: Record<AudioCue, ToneShape & { secondary?: ToneShape }> = {
  rifle: { from: 720, to: 220, seconds: .052, wave: 'sawtooth', volume: .09 },
  heavyRifle: { from: 340, to: 95, seconds: .11, wave: 'sawtooth', volume: .14 },
  rocket: { from: 160, to: 65, seconds: 0.16, wave: 'sawtooth', volume: 0.08 },
  reward: { from: 630, to: 980, seconds: 0.14, wave: 'sine', volume: 0.11 },
  damage: { from: 360, to: 125, seconds: .16, wave: 'triangle', volume: .18,
    secondary: { from: 145, to: 60, seconds: .14, wave: 'sine', volume: .065 } },
  fatal: { from: 300, to: 55, seconds: 0.29, wave: 'sine', volume: .22 },
  rewardHit: { from: 760, to: 950, seconds: 0.06, wave: 'sine', volume: 0.05 },
  enemyHit: { from: 240, to: 105, seconds: .075, wave: 'sine', volume: .055 },
  enemyDeath: { from: 180, to: 65, seconds: .11, wave: 'sine', volume: .068 },
  bossHit: { from: 125, to: 52, seconds: .13, wave: 'triangle', volume: .11,
    secondary: { from: 460, to: 180, seconds: .075, wave: 'sine', volume: .027 } },
  bossDeath: { from: 105, to: 34, seconds: .48, wave: 'sine', volume: .18,
    secondary: { from: 330, to: 55, seconds: .28, wave: 'sawtooth', volume: .035 } },
  groundArtillery: { from: 125, to: 40, seconds: .4, wave: 'sine', volume: .064 },
  skyFlak: { from: 260, to: 90, seconds: .19, wave: 'triangle', volume: .039 },
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly active = new Set<OscillatorNode>();
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
    const cues = this.environment.update(nowMs);
    if (nowMs < this.nextEnvironmentCueMs) return;
    if (cues & GROUND_ARTILLERY_CUE) {
      this.play('groundArtillery');
      this.nextEnvironmentCueMs = nowMs + 350;
    } else if (cues & SKY_FLAK_CUE) {
      this.play('skyFlak');
      this.nextEnvironmentCueMs = nowMs + 350;
    }
  }

  play(cue: AudioCue): void {
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
      const playTone = (tone: ToneShape, disconnectFilter = false): void => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(tone.to, start + tone.seconds);
        gain.gain.setValueAtTime(tone.volume, start);
        gain.gain.exponentialRampToValueAtTime(.001, start + tone.seconds);
        oscillator.connect(gain);
        gain.connect(filter ?? this.master!);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          if (disconnectFilter) filter?.disconnect();
          this.active.delete(oscillator);
        };
        this.active.add(oscillator);
        oscillator.start(start);
        oscillator.stop(start + tone.seconds);
      };
      playTone(shape, true);
      if (shape.secondary) playTone(shape.secondary);
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
