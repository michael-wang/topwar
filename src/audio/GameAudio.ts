export type AudioCue = 'reward' | 'enemyDeath';

// Presentation-only observation; enemy IDs restart on Retry.
export class AudioCueObserver {
  private previousEnemyIds = new Set<number>();
  private nextDeathCueMs = -Infinity;

  observe(previousDefense: number, currentDefense: number,
    enemies: readonly { id: number }[], nowMs = performance.now()): AudioCue[] {
    const cues = new Set<AudioCue>();
    if (currentDefense > previousDefense) cues.add('reward');
    const currentEnemyIds = new Set(enemies.map((enemy) => enemy.id));
    if (nowMs >= this.nextDeathCueMs) {
      for (const id of this.previousEnemyIds) {
        if (!currentEnemyIds.has(id)) {
          cues.add('enemyDeath');
          this.nextDeathCueMs = nowMs + 100;
          break;
        }
      }
    }
    this.previousEnemyIds = currentEnemyIds;
    return [...cues];
  }

  reset(): void {
    this.previousEnemyIds.clear();
    this.nextDeathCueMs = -Infinity;
  }
}

const cueShape: Record<AudioCue, { from: number; to: number; seconds: number;
  wave: OscillatorType; volume: number }> = {
  reward: { from: 630, to: 980, seconds: 0.14, wave: 'sine', volume: 0.11 },
  enemyDeath: { from: 790, to: 165, seconds: 0.18, wave: 'sawtooth', volume: 0.055 },
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly active = new Set<OscillatorNode>();
  private readonly observer = new AudioCueObserver();
  private unlocked = false;
  private disposed = false;

  constructor(private readonly viewport: HTMLElement, private readonly keyTarget: Window = window) {
    viewport.addEventListener?.('pointerdown', this.unlock);
    keyTarget.addEventListener?.('keydown', this.unlock);
  }

  observe(previousDefense: number, currentDefense: number,
    enemies: readonly { id: number }[], nowMs = performance.now()): void {
    for (const cue of this.observer.observe(previousDefense, currentDefense, enemies, nowMs)) this.play(cue);
  }

  resetObservation(): void { this.observer.reset(); }

  play(cue: AudioCue): void {
    const context = this.context;
    if (!this.unlocked || !context || context.state !== 'running' || !this.master) return;
    try {
      const shape = cueShape[cue];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = shape.wave;
      oscillator.frequency.setValueAtTime(shape.from, start);
      oscillator.frequency.exponentialRampToValueAtTime(shape.to, start + shape.seconds);
      gain.gain.setValueAtTime(shape.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + shape.seconds);
      oscillator.connect(gain);
      const overtone = cue === 'enemyDeath' ? context.createOscillator() : null;
      if (overtone) {
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(shape.from * 1.38, start);
        overtone.frequency.exponentialRampToValueAtTime(shape.to * 1.18, start + shape.seconds);
        overtone.connect(gain);
        this.active.add(overtone);
        overtone.onended = () => {
          overtone.disconnect();
          this.active.delete(overtone);
        };
      }
      gain.connect(this.master);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.active.delete(oscillator);
      };
      this.active.add(oscillator);
      oscillator.start(start);
      oscillator.stop(start + shape.seconds);
      overtone?.start(start);
      overtone?.stop(start + shape.seconds);
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
    if (this.disposed || this.unlocked) return;
    const Constructor = globalThis.AudioContext;
    if (!Constructor) return;
    try {
      this.context ??= new Constructor();
      this.master ??= this.context.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.context.destination);
      void this.context.resume().then(() => {
        if (this.context?.state === 'running') {
          this.unlocked = true;
          this.removeUnlockListeners();
        }
      }).catch(() => {});
    } catch {
      // Unsupported or denied Web Audio must not interrupt gameplay.
    }
  };

  private removeUnlockListeners(): void {
    this.viewport.removeEventListener?.('pointerdown', this.unlock);
    this.keyTarget.removeEventListener?.('keydown', this.unlock);
  }
}
