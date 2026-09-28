import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { BOSS_DEATH_FALL_MS, BOSS_DEATH_MS } from './BossRenderer';

export class BossCameraFraming {
  private hadBoss = false;
  private deathStartedAtMs = -Infinity;
  private deathStartWeight = 0;
  private weight = 0;

  update(camera: THREE.PerspectiveCamera, boss: BossRenderState | null,
    playerZ: number, nowMs: number): number {
    if (boss) {
      const distance = boss.z - playerZ;
      this.weight = Math.max(0, Math.min(1, (24 - distance) / 21));
      this.deathStartedAtMs = -Infinity;
    } else {
      if (this.hadBoss) {
        this.deathStartedAtMs = nowMs;
        this.deathStartWeight = this.weight;
      }
      const elapsed = nowMs - this.deathStartedAtMs;
      if (elapsed <= BOSS_DEATH_FALL_MS) this.weight = this.deathStartWeight;
      else if (elapsed < BOSS_DEATH_MS) {
        const progress = (elapsed - BOSS_DEATH_FALL_MS)
          / (BOSS_DEATH_MS - BOSS_DEATH_FALL_MS);
        const eased = progress * progress * (3 - 2 * progress);
        this.weight = this.deathStartWeight * (1 - eased);
      } else this.weight = 0;
    }
    this.hadBoss = boss !== null;
    camera.position.y = 6.5 + 2.7 * this.weight;
    camera.position.z = playerZ - (10 + 8 * this.weight);
    camera.lookAt(0, 0, playerZ + 12.5);
    return this.weight;
  }

  reset(): void {
    this.hadBoss = false;
    this.deathStartedAtMs = -Infinity;
    this.deathStartWeight = 0;
    this.weight = 0;
  }
}
