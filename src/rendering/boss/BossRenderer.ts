import * as THREE from 'three';
import type { BossRenderState } from '../RenderState';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';
import { BOSS_DEATH_FADE_START_MS, BOSS_DEATH_FALL_START_MS,
  BOSS_DEATH_FALL_DURATION_MS, BOSS_DEATH_GRAY_IN_MS,
  BOSS_DEATH_IMPACT_MS, BOSS_DEATH_MS } from '../../presentation/BossDeathTiming';

const HIT_FLASH_MS = 60;
const HIT_FLASH_RETRIGGER_MS = 210;
const HIT_PULSE_MS = 100;
const HP_TICK_MS = 85;
const HP_TICK_RETRIGGER_MS = 130;
const DEATH_FORWARD_PITCH = -Math.PI * 0.46;
const DEATH_GRAY = new THREE.Color('#adb4b8');
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
    colors[offset] = isDetail ? charcoal.r / tierColor.r : 1;
    colors[offset + 1] = isDetail ? charcoal.g / tierColor.g : 1;
    colors[offset + 2] = isDetail ? charcoal.b / tierColor.b : 1;
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
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly vestMaterials: THREE.MeshStandardMaterial[];
  private readonly vestGeometries: THREE.BufferGeometry[];
  private readonly hitWashMaterial = new THREE.MeshBasicMaterial({ color: '#fff4df',
    transparent: true, opacity: .2, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#151b22',
    side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false });
  private readonly barTrackMaterial = new THREE.MeshBasicMaterial({ color: '#3a2024',
    side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b30',
    side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false });
  private readonly active = new THREE.Group();
  private readonly death = new THREE.Group();
  private readonly deathFallPivot = new THREE.Group();
  private readonly deathPose = new THREE.Group();
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
  private readonly deathBodyLive: THREE.Mesh;
  private readonly deathBodyGray: THREE.Mesh;
  private readonly deathBodyHitWash: THREE.Mesh;
  private readonly deathHelmetHitWash: THREE.Mesh;
  private readonly deathVestHitWash: THREE.Mesh;
  private readonly deathBodyLiveMaterial: THREE.MeshStandardMaterial;
  private readonly deathBodyGrayMaterial: THREE.MeshStandardMaterial;
  private readonly deathHelmetMaterial: THREE.MeshStandardMaterial;
  private readonly deathVestMaterial: THREE.MeshStandardMaterial;
  private readonly deathVestGeometry: THREE.BufferGeometry;
  private readonly deathTierColor = new THREE.Color();
  private readonly barBackground = new THREE.Mesh(this.barFrameGeometry, this.barBackgroundMaterial);
  private readonly barTrack = new THREE.Mesh(this.barTrackGeometry, this.barTrackMaterial);
  private readonly barFill = new THREE.Mesh(this.barFillGeometry, this.barFillMaterial);
  private readonly barAnchor = new THREE.Group();
  private previous: BossRenderState | null = null;
  private flashUntilMs = -Infinity;
  private lastFlashAtMs = -Infinity;
  private hitAtMs = -Infinity;
  private barHitAtMs = -Infinity;
  private deathStartedAtMs = -Infinity;
  private deathStartY = 0;
  private slamAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene,
    bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    walkFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[],
    slamFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[],
    grayBodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    if (walkFrames.length !== 4) throw new Error('Boss locomotion requires four baked poses');
    if (slamFrames.length !== 4) throw new Error('Boss slam requires four baked poses');
    this.walkGeometries = walkFrames.map((frame) => frame.geometry);
    this.slamGeometries = slamFrames.map((frame) => frame.geometry);
    this.defaultBodyGeometry = bodyModel.geometry;
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    if (!(bodyModel.material instanceof THREE.MeshStandardMaterial)
      || !(grayBodyModel.material instanceof THREE.MeshStandardMaterial)) {
      throw new Error('Boss death body needs standard materials');
    }
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
    this.deathBodyLiveMaterial = bodyModel.material.clone();
    this.deathBodyGrayMaterial = grayBodyModel.material.clone();
    this.deathHelmetMaterial = source.clone();
    this.deathVestMaterial = source.clone();
    this.deathVestMaterial.vertexColors = true;
    this.deathVestGeometry = tierArmorGeometry(vestModel.geometry, DEATH_GRAY);
    for (const material of [this.deathBodyLiveMaterial, this.deathBodyGrayMaterial,
      this.deathHelmetMaterial, this.deathVestMaterial]) {
      material.transparent = true;
      material.depthWrite = false;
    }
    this.setLiveDeathMaterialsFadeable(false);
    this.deathBodyLive = new THREE.Mesh(bodyModel.geometry, this.deathBodyLiveMaterial);
    this.deathBodyLive.name = 'boss-death-body-live';
    this.deathBodyGray = new THREE.Mesh(bodyModel.geometry, this.deathBodyGrayMaterial);
    this.deathBodyGray.name = 'boss-death-body-gray';
    this.deathBodyGray.renderOrder = 1;
    this.deathHelmet = new THREE.Mesh(helmetModel.geometry, this.deathHelmetMaterial);
    this.deathHelmet.name = 'boss-death-helmet';
    fitCommanderHelmet(this.deathHelmet);
    this.deathVest = new THREE.Mesh(this.deathVestGeometry, this.deathVestMaterial);
    this.deathVest.name = 'boss-death-vest';
    this.deathBodyHitWash = new THREE.Mesh(bodyModel.geometry, this.hitWashMaterial);
    this.deathBodyHitWash.name = 'boss-death-body-hit-wash';
    this.deathHelmetHitWash = new THREE.Mesh(helmetModel.geometry, this.hitWashMaterial);
    this.deathHelmetHitWash.name = 'boss-death-helmet-hit-wash';
    this.deathVestHitWash = new THREE.Mesh(this.deathVestGeometry, this.hitWashMaterial);
    this.deathVestHitWash.name = 'boss-death-vest-hit-wash';
    for (const mesh of [this.deathBodyHitWash, this.deathHelmetHitWash,
      this.deathVestHitWash]) {
      mesh.renderOrder = 10;
      mesh.visible = false;
    }
    this.deathPose.name = 'boss-death-pose';
    this.deathPose.add(this.deathBodyLive, this.deathHelmet, this.deathVest,
      this.deathBodyGray, this.deathBodyHitWash, this.deathHelmetHitWash,
      this.deathVestHitWash);
    this.deathFallPivot.name = 'boss-death-fall-pivot';
    this.deathFallPivot.add(this.deathPose);
    this.death.add(this.deathFallPivot);
    this.death.name = 'boss-death';
    // The plate follows the Boss as a whole, independent of the animated pose.
    this.barAnchor.name = 'boss-hp-anchor';
    this.barAnchor.position.set(0, 1.1, -0.25);
    this.barAnchor.scale.setScalar(.32);
    this.barBackground.name = 'boss-hp-frame';
    this.barTrack.name = 'boss-hp-track';
    this.barFill.name = 'boss-hp-fill';
    this.barBackground.position.z = 0;
    this.barTrack.position.z = -0.01;
    this.barFill.position.z = -0.02;
    this.barBackground.renderOrder = 20;
    this.barTrack.renderOrder = 21;
    this.barFill.renderOrder = 22;
    this.barAnchor.add(this.barBackground, this.barTrack, this.barFill);
    this.active.add(this.barAnchor);
    this.body.add(this.bodyHitWash, this.helmetHitWash, this.vestHitWash);
    this.active.visible = false;
    this.death.visible = false;
    this.scene.add(this.active, this.death);
  }

  update(boss: BossRenderState | null, nowMs = performance.now(), playerZ?: number): void {
    if (this.previous && !boss) this.startDeath(this.previous, nowMs);
    if (boss && this.previous?.id !== boss.id) {
      this.flashUntilMs = -Infinity;
      this.lastFlashAtMs = -Infinity;
      this.hitAtMs = -Infinity;
      this.barHitAtMs = -Infinity;
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
      if (nowMs - this.barHitAtMs >= HP_TICK_RETRIGGER_MS) this.barHitAtMs = nowMs;
    }
    this.previous = boss ? { ...boss } : null;
    this.active.visible = boss !== null;
    if (boss) {
      this.active.position.set(-boss.x, 0, boss.z);
      // The world-space plate fades in only once its owner emerges from the haze.
      const visibility = playerZ === undefined ? 1
        : Math.max(0, Math.min(1, (90 - (boss.z - playerZ)) / 24));
      this.barAnchor.visible = visibility > 0;
      for (const material of [this.barBackgroundMaterial, this.barTrackMaterial,
        this.barFillMaterial]) material.opacity = visibility;
      const hitAgeMs = nowMs - this.hitAtMs;
      this.active.scale.setScalar(boss.visualScale);
      const bodyPulse = 1 + 0.03 * Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS);
      const barTick = Math.max(0, 1 - (nowMs - this.barHitAtMs) / HP_TICK_MS);
      this.barAnchor.scale.setScalar(.32 * (1 + .035 * barTick));
      this.barAnchor.position.x = .012 * barTick;
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
      this.body.scale.set(bodyPulse, bodyPulse * (1 - (impact ? 0.16 : 0)
        - Math.max(0, 1 - hitAgeMs / HIT_PULSE_MS) * 0.1), bodyPulse);
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
      if (elapsed >= BOSS_DEATH_MS) this.death.visible = false;
      else {
        const fall = Math.min(1, Math.max(0,
          (elapsed - BOSS_DEATH_FALL_START_MS) / BOSS_DEATH_FALL_DURATION_MS));
        this.deathFallPivot.rotation.x = DEATH_FORWARD_PITCH * fall * fall * fall;
        this.death.position.y = this.deathStartY - .03 * Math.min(1,
          Math.max(0, (elapsed - BOSS_DEATH_IMPACT_MS) / 50));
        const gray = Math.min(1, Math.max(0, elapsed / BOSS_DEATH_GRAY_IN_MS));
        const opacity = Math.min(1, Math.max(0,
          (BOSS_DEATH_MS - elapsed) / (BOSS_DEATH_MS - BOSS_DEATH_FADE_START_MS)));
        if (gray > 0) this.setLiveDeathMaterialsFadeable(true);
        this.deathVest.geometry = gray > 0 ? this.deathVestGeometry : this.vest.geometry;
        this.deathBodyLiveMaterial.opacity = (1 - gray) * opacity;
        this.deathBodyGrayMaterial.opacity = gray * opacity;
        this.deathHelmetMaterial.color.copy(this.deathTierColor).lerp(DEATH_GRAY, gray);
        this.deathVestMaterial.color.copy(this.deathTierColor).lerp(DEATH_GRAY, gray);
        this.deathHelmetMaterial.opacity = opacity;
        this.deathVestMaterial.opacity = opacity;
        const deathWashVisible = nowMs < this.flashUntilMs;
        this.deathBodyHitWash.visible = deathWashVisible && this.bodyHitWash.visible;
        this.deathHelmetHitWash.visible = deathWashVisible && this.helmetHitWash.visible;
        this.deathVestHitWash.visible = deathWashVisible && this.vestHitWash.visible;
      }
    }
  }

  reset(): void {
    this.previous = null;
    this.flashUntilMs = -Infinity;
    this.lastFlashAtMs = -Infinity;
    this.hitAtMs = -Infinity;
    this.barHitAtMs = -Infinity;
    this.barAnchor.scale.setScalar(.32);
    this.barAnchor.position.x = 0;
    this.deathStartedAtMs = -Infinity;
    this.slamAtMs = -Infinity;
    this.active.visible = false;
    this.barAnchor.visible = true;
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
    for (const geometry of [...this.vestGeometries, this.deathVestGeometry]) geometry.dispose();
    for (const material of [...this.tierMaterials, ...this.vestMaterials, this.hitWashMaterial,
      this.barBackgroundMaterial, this.barTrackMaterial, this.barFillMaterial,
      this.deathBodyLiveMaterial, this.deathBodyGrayMaterial,
      this.deathHelmetMaterial, this.deathVestMaterial]) material.dispose();
  }

  private startDeath(boss: BossRenderState, nowMs: number): void {
    this.death.visible = true;
    this.deathStartedAtMs = nowMs;
    this.deathStartY = this.active.position.y;
    const tierIndex = paletteIndex(boss.tier, ENEMY_PALETTE.length);
    this.deathTierColor.copy(this.tierMaterials[tierIndex].color);
    this.deathHelmetMaterial.color.copy(this.deathTierColor);
    this.deathVestMaterial.color.copy(this.deathTierColor);
    this.deathBodyLiveMaterial.opacity = 1;
    this.deathBodyGrayMaterial.opacity = 0;
    this.deathHelmetMaterial.opacity = 1;
    this.deathVestMaterial.opacity = 1;
    this.setLiveDeathMaterialsFadeable(false);
    this.deathBodyLive.geometry = this.bodyMesh.geometry;
    this.deathBodyGray.geometry = this.bodyMesh.geometry;
    this.deathVest.geometry = this.vest.geometry;
    this.deathHelmet.position.copy(this.helmet.position);
    this.deathHelmet.rotation.copy(this.helmet.rotation);
    this.deathHelmet.scale.copy(this.helmet.scale);
    this.deathVest.position.copy(this.vest.position);
    this.deathVest.rotation.copy(this.vest.rotation);
    this.deathVest.scale.copy(this.vest.scale);
    this.deathBodyHitWash.geometry = this.bodyHitWash.geometry;
    this.deathVestHitWash.geometry = this.vestHitWash.geometry;
    for (const [deathWash, liveWash] of [
      [this.deathBodyHitWash, this.bodyHitWash],
      [this.deathHelmetHitWash, this.helmetHitWash],
      [this.deathVestHitWash, this.vestHitWash],
    ] as const) {
      deathWash.position.copy(liveWash.position);
      deathWash.rotation.copy(liveWash.rotation);
      deathWash.scale.copy(liveWash.scale);
      deathWash.visible = liveWash.visible;
    }
    this.deathPose.position.copy(this.body.position);
    this.deathPose.rotation.copy(this.body.rotation);
    this.deathPose.scale.copy(this.body.scale);
    this.deathFallPivot.position.set(0, 0, 0);
    this.deathFallPivot.rotation.set(0, 0, 0);
    this.deathFallPivot.scale.setScalar(1);
    this.death.position.copy(this.active.position);
    this.death.rotation.copy(this.active.rotation);
    this.death.scale.copy(this.active.scale);
  }

  private setLiveDeathMaterialsFadeable(fadeable: boolean): void {
    if (this.deathBodyLiveMaterial.transparent === fadeable) return;
    for (const material of [this.deathBodyLiveMaterial, this.deathHelmetMaterial,
      this.deathVestMaterial]) {
      material.transparent = fadeable;
      material.depthWrite = !fadeable;
      material.needsUpdate = true;
    }
  }

}
