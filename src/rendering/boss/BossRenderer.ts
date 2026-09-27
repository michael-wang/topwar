import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 90;
const HIT_FLASH_RETRIGGER_MS = 170;
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

export function bossWalkPose(id: number, nowMs: number): { frame: number; bob: number;
  roll: number } {
  // The Kenney sprint poses run at less than half the grunt cadence to give
  // the giant deliberate alternating steps and a heavier weight transfer.
  const phase = ((nowMs / 1100 + id * .071) % 1 + 1) % 1;
  const stride = Math.sin(phase * Math.PI * 2);
  return { frame: Math.floor(phase * 4), bob: Math.abs(stride) * .04,
    roll: stride * .045 };
}

export class BossRenderer {
  private readonly barFrameGeometry = new THREE.PlaneGeometry(1.1, .15);
  private readonly barFillGeometry = new THREE.PlaneGeometry(1.04, .09);
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly vestMaterials: THREE.MeshStandardMaterial[];
  private readonly flashMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff',
    side: THREE.DoubleSide, toneMapped: false });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#250b12',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b30',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly bodyMesh: THREE.Mesh;
  private readonly defaultBodyGeometry: THREE.BufferGeometry;
  private readonly defaultBodyMaterial: THREE.Material;
  private readonly walkGeometries: readonly THREE.BufferGeometry[];
  private readonly slamGeometries: readonly THREE.BufferGeometry[];
  private readonly helmet: THREE.Mesh;
  private readonly vest: THREE.Mesh;
  private readonly deathHelmet: THREE.Mesh;
  private readonly deathVest: THREE.Mesh;
  private readonly barBackground = new THREE.Mesh(this.barFrameGeometry, this.barBackgroundMaterial);
  private readonly barFill = new THREE.Mesh(this.barFillGeometry, this.barFillMaterial);
  private readonly barAnchor = new THREE.Group();
  private previous: BossRenderState | null = null;
  private flashUntilMs = -Infinity;
  private lastFlashAtMs = -Infinity;
  private hitAtMs = -Infinity;
  private deathStartedAtMs = -Infinity;
  private deathStartZ = 0;
  private deathScale = 1;
  private slamAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene,
    bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    walkFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[],
    slamFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]) {
    if (walkFrames.length !== 4) throw new Error('Boss locomotion requires four baked poses');
    if (slamFrames.length !== 4) throw new Error('Boss slam requires four baked poses');
    this.walkGeometries = walkFrames.map((frame) => frame.geometry);
    this.slamGeometries = slamFrames.map((frame) => frame.geometry);
    this.defaultBodyGeometry = bodyModel.geometry;
    this.defaultBodyMaterial = bodyModel.material;
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    this.tierMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.vestMaterials = this.tierMaterials.map((tierMaterial) => {
      const material = tierMaterial.clone();
      material.color.lerp(new THREE.Color('#3c4147'), .45);
      return material;
    });
    this.helmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.helmet);
    this.vest = new THREE.Mesh(vestModel.geometry, this.vestMaterials[0]);
    this.bodyMesh = new THREE.Mesh(bodyModel.geometry, bodyModel.material);
    this.body.add(this.bodyMesh, this.helmet, this.vest);
    this.body.rotation.y = Math.PI;
    this.active.add(this.body);
    this.deathHelmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.deathHelmet);
    this.deathVest = new THREE.Mesh(vestModel.geometry, this.vestMaterials[0]);
    this.death.add(new THREE.Mesh(bodyModel.geometry, bodyModel.material), this.deathHelmet, this.deathVest);
    this.death.rotation.y = Math.PI;
    // The framed red bar rides the head but compensates for the giant's 7× scale.
    this.barAnchor.position.set(0, 1.0, 0.34);
    this.barAnchor.scale.setScalar(.31);
    this.barBackground.position.z = 0;
    this.barFill.position.z = 0.01;
    this.barBackground.renderOrder = 20;
    this.barFill.renderOrder = 21;
    this.barAnchor.add(this.barBackground, this.barFill);
    this.body.add(this.barAnchor);
    this.active.visible = false;
    this.death.visible = false;
    this.scene.add(this.active, this.death);
  }

  update(boss: BossRenderState | null, nowMs = performance.now()): void {
    if (this.previous && !boss) this.startDeath(this.previous, nowMs);
    if (boss && this.previous?.id !== boss.id) {
      this.flashUntilMs = -Infinity;
      this.lastFlashAtMs = -Infinity;
      this.hitAtMs = -Infinity;
      this.death.visible = false;
      this.slamAtMs = boss.engaged && boss.slamCount > 0
        && boss.slamCooldownRemainingSeconds > 1.62
        ? nowMs - (2 - boss.slamCooldownRemainingSeconds) * 1000 : -Infinity;
    }
    if (boss && this.previous?.id === boss.id && boss.slamCount > this.previous.slamCount) {
      this.slamAtMs = nowMs;
    }
    if (boss && this.previous?.id === boss.id && boss.hp < this.previous.hp) {
      // Sustained automatic fire still shows the armor between white pulses.
      if (nowMs - this.lastFlashAtMs >= HIT_FLASH_RETRIGGER_MS) {
        this.flashUntilMs = nowMs + HIT_FLASH_MS;
        this.lastFlashAtMs = nowMs;
      }
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
      const slamAgeMs = nowMs - this.slamAtMs;
      const impact = slamAgeMs >= 0 && slamAgeMs < 140;
      const recovering = slamAgeMs >= 140 && slamAgeMs < 380;
      const windingUp = boss.engaged && boss.slamCooldownRemainingSeconds <= 0.6;
      const frame = impact ? 2 : recovering ? 3
        : windingUp ? (boss.slamCooldownRemainingSeconds > 0.25 ? 0 : 1) : -1;
      this.bodyMesh.geometry = frame >= 0 ? this.slamGeometries[frame]
        : boss.engaged ? this.defaultBodyGeometry : this.walkGeometries[pose.frame];
      this.body.position.y = impact ? -0.085 : boss.engaged ? 0 : pose.bob;
      this.body.rotation.x = boss.engaged ? 0 : -.10;
      this.body.rotation.z = boss.engaged ? 0 : pose.roll;
      this.body.scale.y = 1 - (impact ? 0.16 : 0)
        - Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS) * 0.1;
      const flashing = nowMs < this.flashUntilMs;
      this.bodyMesh.material = flashing ? this.flashMaterial : this.defaultBodyMaterial;
      this.helmet.material = flashing ? this.flashMaterial
        : this.tierMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
      this.vest.material = flashing ? this.flashMaterial
        : this.vestMaterials[paletteIndex(boss.tier, ENEMY_PALETTE.length)];
      const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
      this.barFill.scale.x = ratio;
      this.barFill.position.x = -.52 * (1 - ratio);
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
    this.lastFlashAtMs = -Infinity;
    this.hitAtMs = -Infinity;
    this.deathStartedAtMs = -Infinity;
    this.slamAtMs = -Infinity;
    this.active.visible = false;
    this.death.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.active, this.death);
    this.barFrameGeometry.dispose();
    this.barFillGeometry.dispose();
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
