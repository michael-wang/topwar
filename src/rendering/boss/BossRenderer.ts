import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const HIT_PULSE_MS = 100;
const DEATH_MS = 800;
const IMPACT_MS = 90;
const PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
type Part = typeof PARTS[number];

export function bossWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * 0.009 + id * 2.399963229728653);
  return { leftArm: stride * 0.45, rightArm: -stride * 0.45,
    leftLeg: -stride * 0.40, rightLeg: stride * 0.40,
    bob: Math.abs(stride) * 0.02 };
}

export class BossRenderer {
  private readonly torsoGeometry = new THREE.BoxGeometry(0.31, 0.43, 0.23);
  private readonly headGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  private readonly armGeometry = new THREE.BoxGeometry(0.10, 0.34, 0.11);
  private readonly legGeometry = new THREE.BoxGeometry(0.12, 0.34, 0.13);
  private readonly barGeometry = new THREE.PlaneGeometry(0.8, 0.065);
  private readonly bodyMaterials = ENEMY_PALETTE.map((entry) =>
    new THREE.MeshStandardMaterial({ color: entry.body }));
  private readonly headMaterials = ENEMY_PALETTE.map((entry) =>
    new THREE.MeshStandardMaterial({ color: entry.head }));
  private readonly flashBodyMaterial = new THREE.MeshStandardMaterial({ color: '#ffe36e' });
  private readonly flashHeadMaterial = new THREE.MeshStandardMaterial({ color: '#fff8d6' });
  private readonly deathBodyMaterial = new THREE.MeshStandardMaterial({ color: '#777b7c' });
  private readonly deathHeadMaterial = new THREE.MeshStandardMaterial({ color: '#a3a5a3' });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#27313a', side: THREE.DoubleSide });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ffe36e', side: THREE.DoubleSide });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly parts = {} as Record<Part, THREE.Mesh>;
  private readonly barBackground = new THREE.Mesh(this.barGeometry, this.barBackgroundMaterial);
  private readonly barFill = new THREE.Mesh(this.barGeometry, this.barFillMaterial);
  private previous: BossRenderState | null = null;
  private flashUntilMs = -Infinity;
  private hitAtMs = -Infinity;
  private deathStartedAtMs = -Infinity;
  private deathStartZ = 0;
  private deathScale = 1;

  constructor(private readonly scene: THREE.Scene) {
    for (const part of PARTS) {
      const geometry = this.geometryFor(part);
      const mesh = new THREE.Mesh(geometry,
        part === 'head' ? this.headMaterials[0] : this.bodyMaterials[0]);
      this.positionPart(mesh, part);
      this.parts[part] = mesh;
      this.active.add(mesh);
      const corpse = new THREE.Mesh(geometry,
        part === 'head' ? this.deathHeadMaterial : this.deathBodyMaterial);
      this.positionPart(corpse, part);
      this.death.add(corpse);
    }
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
      for (const part of PARTS) {
        const mesh = this.parts[part];
        mesh.position.y = this.partY(part) + pose.bob;
        mesh.rotation.x = part === 'leftArm' ? pose.leftArm : part === 'rightArm' ? pose.rightArm
          : part === 'leftLeg' ? pose.leftLeg : part === 'rightLeg' ? pose.rightLeg : 0;
        mesh.material = nowMs < this.flashUntilMs
          ? part === 'head' ? this.flashHeadMaterial : this.flashBodyMaterial
          : part === 'head' ? this.headMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)]
            : this.bodyMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
      }
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
    for (const geometry of [this.torsoGeometry, this.headGeometry, this.armGeometry,
      this.legGeometry, this.barGeometry]) geometry.dispose();
    for (const material of [...this.bodyMaterials, ...this.headMaterials, this.flashBodyMaterial,
      this.flashHeadMaterial, this.deathBodyMaterial, this.deathHeadMaterial,
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

  private geometryFor(part: Part): THREE.BufferGeometry {
    if (part === 'head') return this.headGeometry;
    if (part === 'torso') return this.torsoGeometry;
    if (part === 'leftArm' || part === 'rightArm') return this.armGeometry;
    return this.legGeometry;
  }

  private partY(part: Part): number {
    return part === 'head' ? 0.90 : part === 'leftLeg' || part === 'rightLeg' ? 0.17
      : part === 'torso' ? 0.53 : 0.51;
  }

  private positionPart(mesh: THREE.Mesh, part: Part): void {
    const x = part === 'leftArm' ? -0.23 : part === 'rightArm' ? 0.23
      : part === 'leftLeg' ? -0.10 : part === 'rightLeg' ? 0.10 : 0;
    mesh.position.set(x, this.partY(part), part === 'head' ? -0.065 : 0);
  }
}
