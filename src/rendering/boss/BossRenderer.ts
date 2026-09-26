import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const HIT_PULSE_MS = 100;
const DEATH_MS = 800;
const IMPACT_MS = 90;

export function bossWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * 0.009 + id * 2.399963229728653);
  return { leftArm: stride * 0.45, rightArm: -stride * 0.45,
    leftLeg: -stride * 0.40, rightLeg: stride * 0.40,
    bob: Math.abs(stride) * 0.02 };
}

export class BossRenderer {
  private readonly barGeometry = new THREE.PlaneGeometry(0.8, 0.065);
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly flashMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterial: THREE.MeshStandardMaterial;
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#27313a', side: THREE.DoubleSide });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ffe36e', side: THREE.DoubleSide });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly barBackground = new THREE.Mesh(this.barGeometry, this.barBackgroundMaterial);
  private readonly barFill = new THREE.Mesh(this.barGeometry, this.barFillMaterial);
  private previous: BossRenderState | null = null;
  private flashUntilMs = -Infinity;
  private hitAtMs = -Infinity;
  private deathStartedAtMs = -Infinity;
  private deathStartZ = 0;
  private deathScale = 1;

  constructor(private readonly scene: THREE.Scene,
    model: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = model.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Giant needs a standard material');
    this.tierMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.flashMaterial = source.clone();
    this.flashMaterial.color.set('#ffe36e');
    this.deathMaterial = source.clone();
    this.deathMaterial.color.set('#999999');
    this.body = new THREE.Mesh(model.geometry, this.tierMaterials[0]);
    this.active.add(this.body);
    this.death.add(new THREE.Mesh(model.geometry, this.deathMaterial));
    this.barBackground.position.set(0, 1.25, -0.14);
    this.barFill.position.set(0, 1.25, -0.15);
    this.active.add(this.barBackground, this.barFill);
    this.active.visible = false;
    this.death.visible = false;
    this.scene.add(this.active, this.death);
  }

  update(boss: BossRenderState | null, nowMs = performance.now()): void {
    if (this.previous && !boss) this.startDeath(this.previous, nowMs);
    if (boss && this.previous?.id !== boss.id) {
      this.flashUntilMs = -Infinity;
      this.hitAtMs = -Infinity;
      this.death.visible = false;
    }
    if (boss && this.previous?.id === boss.id && boss.hp < this.previous.hp) {
      this.flashUntilMs = nowMs + HIT_FLASH_MS;
      this.hitAtMs = nowMs;
    }
    this.previous = boss ? { ...boss } : null;
    this.active.visible = boss !== null;
    if (boss) {
      this.active.position.set(-boss.x, 0, boss.z);
      const hitAgeMs = nowMs - this.hitAtMs;
      this.active.scale.setScalar(boss.visualScale * (1 + 0.03
        * Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS)));
      const pose = bossWalkPose(boss.id, nowMs);
      this.body.position.y = pose.bob;
      this.body.rotation.x = pose.leftLeg * 0.06;
      this.body.material = nowMs < this.flashUntilMs ? this.flashMaterial
        : this.tierMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
      const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
      this.barFill.scale.x = ratio;
      this.barFill.position.x = -0.4 * (1 - ratio);
    }
    if (this.death.visible) {
      const elapsed = nowMs - this.deathStartedAtMs;
      if (elapsed >= DEATH_MS) this.death.visible = false;
      else {
        const progress = Math.max(0, elapsed / DEATH_MS);
        this.death.scale.setScalar(this.deathScale
          * (1 + 0.15 * Math.max(0, 1 - elapsed / IMPACT_MS)));
        this.death.rotation.x = Math.PI * progress;
        this.death.position.y = Math.sin(Math.PI * progress) * 0.6;
        this.death.position.z = this.deathStartZ + progress * 1.5;
      }
    }
  }

  reset(): void {
    this.previous = null;
    this.flashUntilMs = -Infinity;
    this.hitAtMs = -Infinity;
    this.deathStartedAtMs = -Infinity;
    this.active.visible = false;
    this.death.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.active, this.death);
    this.barGeometry.dispose();
    for (const material of [...this.tierMaterials, this.flashMaterial, this.deathMaterial,
      this.barBackgroundMaterial, this.barFillMaterial]) material.dispose();
  }

  private startDeath(boss: BossRenderState, nowMs: number): void {
    this.death.visible = true;
    this.deathStartedAtMs = nowMs;
    this.deathStartZ = boss.z;
    this.deathScale = boss.visualScale;
    this.death.position.set(-boss.x, 0, boss.z);
    this.death.rotation.set(0, 0, 0);
  }

}
