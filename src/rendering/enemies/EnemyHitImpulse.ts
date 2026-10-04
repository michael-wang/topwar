import type { BloodSplatTiming } from '../../presentation/EnemyDeathTiming';
export const ENEMY_HIT_IMPULSE_MS = 140;
export const HIT_BLOOD_CAPACITY = 128;
export const ENEMY_HIT_STYLE = {
  grunt: { distance: .14, lean: .06, bloodScale: .45 },
  heavy: { distance: .10, lean: .04, bloodScale: 1.45 * .40 },
  giant: { distance: .055, lean: .025, bloodScale: 2.2 * .30 },
} as const;
export const HIT_BLOOD_TIMING: Record<keyof typeof ENEMY_HIT_STYLE, BloodSplatTiming> = {
  grunt: { bloodStartMs: 0, bloodEndMs: 100, bloodPulseCount: 1, bloodScale: ENEMY_HIT_STYLE.grunt.bloodScale },
  heavy: { bloodStartMs: 0, bloodEndMs: 100, bloodPulseCount: 1, bloodScale: ENEMY_HIT_STYLE.heavy.bloodScale },
  giant: { bloodStartMs: 0, bloodEndMs: 100, bloodPulseCount: 1, bloodScale: ENEMY_HIT_STYLE.giant.bloodScale },
};
interface Impulse { startedAt: number; strength: number; from: number; sequence: number }
const smooth = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
// Rendering only: no positions or combat state enter this tracker. One entry per
// current enemy, reused on rapid hits; never a new Object3D/material per impact.
export class EnemyHitImpulse {
  private readonly entries = new Map<number, Impulse>();
  observe(id: number, nowMs: number): number {
    const current = this.strength(id, nowMs);
    let entry = this.entries.get(id);
    if (!entry) { entry = { startedAt: nowMs, strength: 0, from: 0, sequence: 0 }; this.entries.set(id, entry); }
    entry.startedAt = nowMs; entry.from = current;
    entry.strength = Math.min(1, current + .85); entry.sequence++;
    return entry.sequence;
  }
  strength(id: number, nowMs: number): number {
    const entry = this.entries.get(id); if (!entry) return 0;
    const age = nowMs - entry.startedAt;
    if (age < 0 || age >= ENEMY_HIT_IMPULSE_MS) return 0;
    if (age < 12) return entry.from + (entry.strength - entry.from) * smooth(age / 12);
    return entry.strength * (1 - smooth((age - 12) / (ENEMY_HIT_IMPULSE_MS - 12)));
  }
  prune(ids: ReadonlySet<number>): void { for (const id of this.entries.keys()) if (!ids.has(id)) this.entries.delete(id); }
  reset(): void { this.entries.clear(); }
}
