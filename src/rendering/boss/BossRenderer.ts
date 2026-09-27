import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const HIT_PULSE_MS = 100;
const DEATH_MS = 800;
const IMPACT_MS = 90;
const HELMET_SCALE = 0.8;
const HELMET_PIVOT_Y = 0.82;
const HELMET_DROP = 0.03;

function fitCommanderHelmet(helmet: THREE.Mesh): void {
  // Scale around the head instead of the character's feet, then seat it lower.
  helmet.scale.setScalar(HELMET_SCALE);
  helmet.position.y = HELMET_PIVOT_Y * (1 - HELMET_SCALE) - HELMET_DROP;
}

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
  private readonly vestMaterials: THREE.MeshStandardMaterial[];
  private readonly flashMaterial: THREE.MeshStandardMaterial;
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#27313a', side: THREE.DoubleSide });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ffe36e', side: THREE.DoubleSide });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly helmet: THREE.Mesh;
  private readonly vest: THREE.Mesh;
  private readonly deathHelmet: THREE.Mesh;
  private readonly deathVest: THREE.Mesh;
  private readonly barBackground = new THREE.Mesh(this.barGeometry, this.barBackgroundMaterial);
  private readonly barFill = new THREE.Mesh(this.barGeometry, this.barFillMaterial);
  private previous: BossRenderState | null = null;
  private flashUntilMs = -Infinity;
  private hitAtMs = -Infinity;
  private deathStartedAtMs = -Infinity;
  private deathStartZ = 0;
  private deathScale = 1;

  constructor(private readonly scene: THREE.Scene,
    bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    this.tierMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.vestMaterials = this.tierMaterials.map((tierMaterial) => {
      const material = tierMaterial.clone();
      material.color.lerp(new THREE.Color('#3c4147'), .7);
      return material;
    });
    this.flashMaterial = source.clone();
    this.flashMaterial.color.set('#ffe36e');
    this.helmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.helmet);
    this.vest = new THREE.Mesh(vestModel.geometry, this.vestMaterials[0]);
    this.body.add(new THREE.Mesh(bodyModel.geometry, bodyModel.material), this.helmet, this.vest);
    this.body.rotation.y = Math.PI;
    this.active.add(this.body);
    this.deathHelmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.deathHelmet);
    this.deathVest = new THREE.Mesh(vestModel.geometry, this.vestMaterials[0]);
    this.death.add(new THREE.Mesh(bodyModel.geometry, bodyModel.material), this.deathHelmet, this.deathVest);
    this.death.rotation.y = Math.PI;
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
      this.body.position.y = pose.bob * 2;
      this.body.rotation.z = pose.leftArm * 0.10;
      this.body.scale.y = 1 - Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS) * 0.1;
      this.helmet.material = nowMs < this.flashUntilMs ? this.flashMaterial
        : this.tierMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
      this.vest.material = nowMs < this.flashUntilMs ? this.flashMaterial
        : this.vestMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
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
        this.death.rotation.z = Math.PI * 0.42 * progress;
        this.death.position.y = Math.sin(Math.PI * progress) * 0.35;
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
    for (const material of [...this.tierMaterials, ...this.vestMaterials, this.flashMaterial,
      this.barBackgroundMaterial, this.barFillMaterial]) material.dispose();
  }

  private startDeath(boss: BossRenderState, nowMs: number): void {
    this.death.visible = true;
    this.deathStartedAtMs = nowMs;
    this.deathStartZ = boss.z;
    this.deathScale = boss.visualScale;
    this.deathHelmet.material = this.tierMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
    this.deathVest.material = this.vestMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
    this.death.position.set(-boss.x, 0, boss.z);
    this.death.rotation.set(0, Math.PI, 0);
  }

}
