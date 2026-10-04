import * as THREE from 'three';
import type { GiantVisualFamily } from '../CharacterVisualFamilies';
import { GIANT_REVEAL_MS, GIANT_DEATH_MS, GIANT_CRASH_MS, giantReveal, giantDeathPose } from '../../presentation/GiantDrama';
import { ART } from '../../art/ArtDirection';
import { giantWeightPose, giantGripMotion } from '../../presentation/CharacterMotion';
import { prepareCrowdMaterial } from './CrowdPresentation';
import { PALE_DEATH_COLORS, preparePaleDeathMaterial } from './PaleDeathMaterial';
import { deathFragmentVelocity } from './PaleShatterFragments';
import { fragmentLandingSeconds } from './GroundedFragments';
import type { EnemyRenderState } from '../RenderState';
import { SURVIVING_HIT_STYLES, type HeavyHitFeedback } from './HeavyHitFeedback';

function hazeTexture(): THREE.DataTexture {
  const size = 32, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - 15.5) / 15.5, dy = (y - 15.5) / 15.5, radius = dx * dx + dy * dy;
    const at = (y * size + x) * 4; bytes[at] = bytes[at + 1] = bytes[at + 2] = 255;
    bytes[at + 3] = Math.round(180 * Math.pow(Math.max(0, 1 - radius), 1.5));
  }
  const texture = new THREE.DataTexture(bytes, size, size); texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; return texture;
}

// Three bounded slots allow two live Colossi and one recent collapse. Resources
// are borrowed from the Giant family; only slot materials and effects are owned.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly helmet: THREE.Mesh;
  private readonly weapon = new THREE.Group();
  private readonly weaponRest = new THREE.Vector3();
  private readonly palette: { material: THREE.MeshStandardMaterial; color: THREE.Color; pale: { value: number } }[];
  private readonly dimensions: { width: number; height: number; depth: number };
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: ART.fx.dust, transparent: true,
    opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private readonly ringGeometry = new THREE.RingGeometry(1, 1.2, 32);
  private readonly ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly hazeMap = hazeTexture();
  private readonly hazeMaterial = new THREE.SpriteMaterial({ map: this.hazeMap, color: ART.world.fog,
    transparent: true, opacity: 0, depthWrite: false });
  private readonly haze = new THREE.Group();
  private readonly chunkGeometry = new THREE.SphereGeometry(.5, 10, 6);
  private readonly chunksMaterial = new THREE.MeshStandardMaterial({ color: 'white', roughness: 1, transparent: true });
  private readonly chunks = new THREE.InstancedMesh(this.chunkGeometry, this.chunksMaterial, 12);
  private readonly debrisGroup = new THREE.Object3D();
  private readonly transform = new THREE.Object3D();
  private bornAt = -Infinity;
  private previous: EnemyRenderState | undefined;
  private deathAt = -Infinity;
  constructor(private readonly scene: THREE.Scene, private readonly family: GiantVisualFamily) {
    const material = (source: THREE.Material, surface: 'body' | 'gear') => {
      if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires standard family materials');
      const result = prepareCrowdMaterial(source.clone(), family.contactPresentation, surface);
      result.color.set('white'); result.emissive.set(ART.fx.core); result.emissiveIntensity = 0; return result;
    };
    const bodyMaterial = material(family.body.material, 'body'), gearMaterial = material(family.helmet.material, 'gear');
    this.body = new THREE.Mesh(family.body.geometry, bodyMaterial);
    this.body.name = 'giant-body';
    this.helmet = new THREE.Mesh(family.helmet.geometry, gearMaterial); this.helmet.name = 'giant-crest-helmet';
    const armor = new THREE.Mesh(family.vest.geometry, gearMaterial); armor.name = 'giant-shoulder-yoke'; armor.visible = family.vest.visible;
    this.group.name = 'giant-assault-soldier'; this.group.add(this.body, this.helmet, armor);
    this.weapon.name = 'giant-maul';
    if (family.weapon) {
      const maul = new THREE.Mesh(family.weapon.geometry, gearMaterial);
      // The authored grip is inside the same mesh as shaft/head. The pivot is
      // the hand, so delayed rotation gives the maul inertia without detaching it.
      this.weaponRest.fromArray(family.weaponGrip ?? [.60, .36, .08]);
      this.weapon.position.copy(this.weaponRest); maul.position.copy(this.weaponRest).negate();
      this.weapon.add(maul); this.group.add(this.weapon);
    }
    this.palette = [bodyMaterial, gearMaterial].map(material => ({ material, color: material.color.clone(),
      pale: preparePaleDeathMaterial(material) }));
    this.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.group), size = bounds.getSize(new THREE.Vector3());
    this.dimensions = family.presentation ?? { width: size.x, height: bounds.max.y, depth: size.z };
    this.ring.rotation.x = -Math.PI / 2; this.ring.name = 'giant-death-impact';
    this.group.visible = this.ring.visible = false;
    this.haze.name = 'giant-emergence-haze';
    for (let i = 0; i < 4; i++) this.haze.add(new THREE.Sprite(this.hazeMaterial));
    this.chunks.name = 'giant-armor-wreckage'; this.chunks.visible = false; this.chunks.frustumCulled = false;
    for (let i = 0; i < 12; i++) this.chunks.setColorAt(i, new THREE.Color(PALE_DEATH_COLORS[i % 3]));
    this.haze.visible = false; this.debrisGroup.add(this.chunks);
    scene.add(this.group, this.ring, this.haze, this.debrisGroup);
  }
  get id(): number | undefined { return this.previous?.id; }
  available(nowMs: number): boolean { return !this.previous || (Number.isFinite(this.deathAt) && nowMs - this.deathAt >= GIANT_DEATH_MS); }
  barVisible(nowMs: number): boolean { return giantReveal(nowMs - this.bornAt).barVisible; }
  getModelDimensions(): { width: number; height: number; depth: number } { return { ...this.dimensions }; }
  healthBarLayout(enemy: EnemyRenderState): { width: number; height: number; y: number; x: number } {
    const base = enemy.visualScale ?? 1;
    const scale = enemy.visualScaleX ?? base;
    const bar = this.family.presentation?.healthBar ?? { width: this.dimensions.width * .75, height: this.dimensions.width * .75 / 6 };
    return { x: this.group.position.x, width: bar.width * scale, height: bar.height * scale,
      y: this.dimensions.height * (enemy.visualScaleY ?? base) + .35 };
  }
  die(enemy: EnemyRenderState, nowMs: number): void {
    this.previous = enemy; this.deathAt = nowMs; this.ring.position.set(-enemy.x, .06, enemy.z - 1.5);
  }
  private restorePalette(): void {
    for (const { material, color, pale } of this.palette) {
      pale.value = 0;
      material.color.copy(color); material.opacity = 1; material.transparent = false; material.emissiveIntensity = 0;
    }
  }
  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback): void {
    if (enemy) {
      if (this.previous?.id !== enemy.id) this.bornAt = nowMs;
      this.previous = enemy; this.deathAt = -Infinity;
      const cycle = enemy.gaitCycleMs ?? 850, weight = giantWeightPose(enemy.id, nowMs, cycle), hit = hits.strength(enemy.id, nowMs);
      this.body.geometry = this.family.runFrames[Math.floor(nowMs / (cycle / 4) + enemy.id * 1.52788745) & 3].geometry;
      const grip = giantGripMotion(weight.phase);
      this.weapon.position.set(this.weaponRest.x + grip.x, this.weaponRest.y + grip.y, this.weaponRest.z + grip.z);
      this.weapon.rotation.set(weight.weapon + .03 * hit, 0, Math.sin(weight.phase - .8) * .045);
      this.helmet.rotation.z = Math.cos(weight.phase - .25) * .012;
      this.group.position.set(-enemy.x + weight.shift * (enemy.visualScaleX ?? enemy.visualScale ?? 1), weight.bob, enemy.z + hit * .11);
      this.group.rotation.set(-.12 + hit * .06, Math.PI, weight.sway);
      const scale = enemy.visualScale ?? 1;
      this.group.scale.set(enemy.visualScaleX ?? scale, (enemy.visualScaleY ?? scale) * (1 - weight.compression), enemy.visualScaleZ ?? scale);
      this.group.visible = true; this.ring.visible = false; this.restorePalette();
      const reveal = giantReveal(nowMs - this.bornAt);
      for (const { material, color } of this.palette) {
        material.transparent = reveal.opacity < 1; material.opacity = reveal.opacity;
        material.color.set(ART.world.near).lerp(color, reveal.color);
        material.emissive.set(SURVIVING_HIT_STYLES.giant.overlayColor);
        material.emissiveIntensity = SURVIVING_HIT_STYLES.giant.emissivePeak * hit;
      }
      this.haze.visible = nowMs - this.bornAt < GIANT_REVEAL_MS;
      this.hazeMaterial.color.set(ART.world.fog); this.hazeMaterial.opacity = reveal.haze;
      const height = this.dimensions.height * (enemy.visualScaleY ?? scale);
      this.haze.children.forEach((cloud, index) => {
        cloud.position.set(-enemy.x + Math.sin(index * 2.4) * 1.1 + (nowMs - this.bornAt) * .00025,
          // Leave the crest above the highest cloud: identity emerges first.
          height * (.12 + index * .18), enemy.z - 1.1 - index * .15);
        cloud.scale.set(4.7 + index * .35, height * .43, 1);
      });
      this.chunks.visible = false;
      this.group.updateMatrixWorld(true); hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs); return;
    }
    this.haze.visible = false;
    const age = nowMs - this.deathAt;
    if (!this.previous || age < 0 || age >= GIANT_DEATH_MS) {
      this.group.visible = this.ring.visible = this.chunks.visible = false; return;
    }
    const pose = giantDeathPose(age), scale = this.previous.visualScale ?? 1, fall = pose.falling;
    this.group.visible = pose.bodyVisible; this.ring.visible = pose.ringOpacity > 0;
    this.group.rotation.set(-.12 - 1.42 * fall, Math.PI, .22 * fall);
    this.weapon.rotation.set(-.9 * fall, 0, .25 * fall); this.helmet.rotation.z = .06 * fall;
    this.group.scale.set(this.previous.visualScaleX ?? scale, this.previous.visualScaleY ?? scale, this.previous.visualScaleZ ?? scale);
    this.group.position.set(-this.previous.x, .03 + .08 * (1 - fall) + .9 * fall, this.previous.z + .4 * fall);
    for (const { material, color, pale } of this.palette) {
      material.color.copy(color); pale.value = pose.pale;
      material.transparent = false; material.opacity = 1; material.emissiveIntensity = 0;
    }
    const impactAge = Math.max(0, age - GIANT_CRASH_MS);
    this.haze.visible = pose.crash && impactAge < 850; this.hazeMaterial.color.set(ART.fx.dust);
    this.hazeMaterial.opacity = .45 * Math.min(1, impactAge / 60) * Math.max(0, 1 - impactAge / 850);
    this.haze.children.forEach((cloud, index) => {
      const angle = index * 2.399963, spread = .8 + impactAge * .002;
      cloud.position.set(-this.previous!.x + Math.cos(angle) * spread, .35 + index * .12,
        this.previous!.z - 1.5 + Math.sin(angle) * spread); cloud.scale.set(3 + impactAge * .003, 1 + impactAge * .001, 1);
    });
    this.ring.scale.setScalar((this.previous.visualScaleX ?? scale) * .8 * (1 + impactAge / 280)); this.ringMaterial.opacity = pose.ringOpacity;
    this.chunks.visible = pose.debrisVisible; this.chunksMaterial.opacity = pose.debrisOpacity;
    if (pose.debrisVisible) {
      for (let i = 0; i < 12; i++) {
        const phase = i * 2.399963 + this.previous.id * .71, velocity = deathFragmentVelocity(this.previous.id, i);
        const sx = this.previous.visualScaleX ?? scale, sy = this.previous.visualScaleY ?? scale;
        const sz = this.previous.visualScaleZ ?? scale;
        const originSpread = .18 + (i % 3) * .05;
        // Sphere radius .5: each broad chunk rests on its own scaled half-height.
        const shapes = [[.30, .22, .28], [.32, .28, .30], [.30, .15, .25], [.12, .35, .20]];
        const shape = shapes[i % 4], floor = shape[1] * sy * .5, originY = .12 + .16 * sy;
        const contact = fragmentLandingSeconds(originY, velocity.y * .7, floor, 9);
        const seconds = Math.min(Math.max(0, impactAge / 1000), contact);
        this.transform.position.set(-this.previous.x + Math.cos(phase) * originSpread * sx + velocity.x * sx * .6 * seconds,
          impactAge / 1000 >= contact ? floor : originY + velocity.y * .7 * seconds - 4.5 * seconds * seconds,
          this.previous.z - 1.5 + Math.sin(phase) * originSpread * sz + velocity.z * sz * .6 * seconds);
        const settle = Math.pow(Math.max(0, 1 - seconds / contact), 2);
        this.transform.rotation.set(Math.sin(phase + seconds * 2) * settle, phase * .7 + seconds, Math.cos(phase) * settle);
        // Rounded helmet/body/shoe masses plus a few taller crest/maul abstractions.
        this.transform.scale.set(shape[0] * sx, shape[1] * sy, shape[2] * sz);
        this.transform.updateMatrix(); this.chunks.setMatrixAt(i, this.transform.matrix);
      }
      this.chunks.instanceMatrix.needsUpdate = true;
    }
  }
  reset(): void {
    this.previous = undefined; this.deathAt = this.bornAt = -Infinity;
    this.group.visible = this.ring.visible = this.haze.visible = this.chunks.visible = false;
    this.weapon.position.copy(this.weaponRest); this.restorePalette();
  }
  dispose(): void {
    this.scene.remove(this.group, this.ring, this.haze, this.debrisGroup);
    this.hazeMap.dispose(); this.hazeMaterial.dispose(); this.chunksMaterial.dispose(); this.chunks.dispose();
    this.chunkGeometry.dispose(); this.ringGeometry.dispose(); this.ringMaterial.dispose();
    for (const { material } of this.palette) material.dispose();
  }
}
