import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 60;
const HIT_FLASH_RETRIGGER_MS = 210;
const HIT_PULSE_MS = 100;
const DEATH_MS = 800;
const IMPACT_MS = 90;
const HELMET_SCALE = 0.92;
const HELMET_PIVOT_Y = 0.82;
const HELMET_SEAT_OFFSET_Y = -0.025;
const HELMET_FORWARD_OFFSET_Z = 0.10;

function tierArmorGeometry(source: THREE.BufferGeometry, tierColor: THREE.Color): THREE.BufferGeometry {
  const geometry = source.clone();
  const markers = source.getAttribute('color');
  const positions = source.getAttribute('position');
  const charcoal = new THREE.Color('#303238');
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index++) {
    const isDetail = markers !== undefined && markers.getX(index) < .75;
    const offset = index * 3;
    colors[offset] = isDetail ? Math.min(1, charcoal.r / tierColor.r) : 1;
    colors[offset + 1] = isDetail ? Math.min(1, charcoal.g / tierColor.g) : 1;
    colors[offset + 2] = isDetail ? Math.min(1, charcoal.b / tierColor.b) : 1;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function fitCommanderHelmet(helmet: THREE.Mesh): void {
  // Seat the rim on the upper forehead; the small forward shift covers hair
  // that otherwise intersects the shell in the baked sprint poses.
  helmet.scale.setScalar(HELMET_SCALE);
  helmet.position.y = HELMET_PIVOT_Y * (1 - HELMET_SCALE) + HELMET_SEAT_OFFSET_Y;
  helmet.position.z = HELMET_FORWARD_OFFSET_Z;
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
  private readonly barFrameGeometry = new THREE.PlaneGeometry(1.5, .28);
  private readonly barTrackGeometry = new THREE.PlaneGeometry(1.36, .17);
  private readonly barFillGeometry = new THREE.PlaneGeometry(1.3, .13);
  private readonly barBadgeGeometry = new THREE.PlaneGeometry(.19, .1);
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly vestMaterials: THREE.MeshStandardMaterial[];
  private readonly vestGeometries: THREE.BufferGeometry[];
  private readonly hitWashMaterial = new THREE.MeshBasicMaterial({ color: '#fff4df',
    transparent: true, opacity: .2, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#151b22',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly barTrackMaterial = new THREE.MeshBasicMaterial({ color: '#3a2024',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly barBadgeMaterial = new THREE.MeshBasicMaterial({ color: '#d4b58a',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b30',
    side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly bodyMesh: THREE.Mesh;
  private readonly defaultBodyGeometry: THREE.BufferGeometry;
  private readonly walkGeometries: readonly THREE.BufferGeometry[];
  private readonly slamGeometries: readonly THREE.BufferGeometry[];
  private readonly helmet: THREE.Mesh;
  private readonly vest: THREE.Mesh;
  private readonly bodyHitWash: THREE.Mesh;
  private readonly helmetHitWash: THREE.Mesh;
  private readonly vestHitWash: THREE.Mesh;
  private readonly deathHelmet: THREE.Mesh;
  private readonly deathVest: THREE.Mesh;
  private readonly barBackground = new THREE.Mesh(this.barFrameGeometry, this.barBackgroundMaterial);
  private readonly barTrack = new THREE.Mesh(this.barTrackGeometry, this.barTrackMaterial);
  private readonly barFill = new THREE.Mesh(this.barFillGeometry, this.barFillMaterial);
  private readonly barBadge = new THREE.Mesh(this.barBadgeGeometry, this.barBadgeMaterial);
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
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    this.tierMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.vestMaterials = this.tierMaterials.map((tierMaterial) => {
      const material = tierMaterial.clone();
      material.vertexColors = true;
      return material;
    });
    this.vestGeometries = this.tierMaterials.map((material) =>
      tierArmorGeometry(vestModel.geometry, material.color));
    this.helmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.helmet);
    this.vest = new THREE.Mesh(this.vestGeometries[0], this.vestMaterials[0]);
    this.bodyMesh = new THREE.Mesh(bodyModel.geometry, bodyModel.material);
    this.bodyHitWash = new THREE.Mesh(bodyModel.geometry, this.hitWashMaterial);
    this.helmetHitWash = new THREE.Mesh(helmetModel.geometry, this.hitWashMaterial);
    this.helmetHitWash.position.copy(this.helmet.position);
    this.helmetHitWash.scale.copy(this.helmet.scale).multiplyScalar(1.005);
    this.vestHitWash = new THREE.Mesh(this.vestGeometries[0], this.hitWashMaterial);
    for (const mesh of [this.bodyHitWash, this.helmetHitWash, this.vestHitWash]) {
      mesh.renderOrder = 10;
      mesh.visible = false;
    }
    this.body.add(this.bodyMesh, this.helmet, this.vest);
    this.body.rotation.y = Math.PI;
    this.active.add(this.body);
    this.deathHelmet = new THREE.Mesh(helmetModel.geometry, this.tierMaterials[0]);
    fitCommanderHelmet(this.deathHelmet);
    this.deathVest = new THREE.Mesh(this.vestGeometries[0], this.vestMaterials[0]);
    this.death.add(new THREE.Mesh(bodyModel.geometry, bodyModel.material), this.deathHelmet, this.deathVest);
    this.death.rotation.y = Math.PI;
    // The plate follows the Boss as a whole, independent of the animated pose.
    this.barAnchor.name = 'boss-hp-anchor';
    this.barAnchor.position.set(0, 1.36, -0.25);
    this.barAnchor.scale.setScalar(.32);
    this.barBackground.name = 'boss-hp-frame';
    this.barTrack.name = 'boss-hp-track';
    this.barFill.name = 'boss-hp-fill';
    this.barBadge.name = 'boss-hp-badge';
    this.barBackground.position.z = 0;
    this.barTrack.position.z = -0.01;
    this.barFill.position.z = -0.02;
    this.barBadge.position.set(0, .18, -.03);
    this.barBackground.renderOrder = 20;
    this.barTrack.renderOrder = 21;
    this.barFill.renderOrder = 22;
    this.barBadge.renderOrder = 23;
    this.barAnchor.add(this.barBackground, this.barTrack, this.barFill, this.barBadge);
    this.active.add(this.barAnchor);
    this.body.add(this.bodyHitWash, this.helmetHitWash, this.vestHitWash);
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
      // Sustained automatic fire still shows the Tier color between warm pulses.
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
      this.bodyHitWash.geometry = this.bodyMesh.geometry;
      this.body.position.y = impact ? -0.085 : boss.engaged ? 0 : pose.bob;
      this.body.rotation.x = boss.engaged ? 0 : -.10;
      this.body.rotation.z = boss.engaged ? 0 : pose.roll;
      this.body.scale.y = 1 - (impact ? 0.16 : 0)
        - Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS) * 0.1;
      const flashing = nowMs < this.flashUntilMs;
      this.bodyHitWash.visible = flashing;
      this.helmetHitWash.visible = flashing;
      this.vestHitWash.visible = flashing;
      const tierIndex = paletteIndex(boss.tier, ENEMY_PALETTE.length);
      this.helmet.material = this.tierMaterials[tierIndex];
      this.vest.material = this.vestMaterials[tierIndex];
      this.vest.geometry = this.vestGeometries[tierIndex];
      this.vestHitWash.geometry = this.vest.geometry;
      const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
      this.barFill.scale.x = ratio;
      this.barFill.position.x = -.65 * (1 - ratio);
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
    this.bodyHitWash.visible = false;
    this.helmetHitWash.visible = false;
    this.vestHitWash.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.active, this.death);
    this.barFrameGeometry.dispose();
    this.barTrackGeometry.dispose();
    this.barFillGeometry.dispose();
    this.barBadgeGeometry.dispose();
    for (const geometry of this.vestGeometries) geometry.dispose();
    for (const material of [...this.tierMaterials, ...this.vestMaterials, this.hitWashMaterial,
      this.barBackgroundMaterial, this.barTrackMaterial, this.barFillMaterial,
      this.barBadgeMaterial]) material.dispose();
  }

  private startDeath(boss: BossRenderState, nowMs: number): void {
    this.death.visible = true;
    this.deathStartedAtMs = nowMs;
    this.deathStartZ = boss.z;
    this.deathScale = boss.visualScale;
    const tierIndex = paletteIndex(boss.tier, ENEMY_PALETTE.length);
    this.deathHelmet.material = this.tierMaterials[tierIndex];
    this.deathVest.material = this.vestMaterials[tierIndex];
    this.deathVest.geometry = this.vestGeometries[tierIndex];
    this.death.position.set(-boss.x, 0, boss.z);
    this.death.rotation.set(0, Math.PI, 0);
  }

}
