import * as THREE from 'three';
import type { GiantVisualFamily } from '../CharacterVisualFamilies';
import { deathVariant } from './DeathAssembly';
import { ART } from '../../art/ArtDirection';
import { giantWeightPose, giantGripMotion } from '../../presentation/CharacterMotion';
import { GiantDebris, giantDebrisOpacity, GIANT_DEBRIS } from './GiantDebris';
import { ENEMY_DEATH_TIMING } from '../../presentation/EnemyDeathTiming';
import { GiantDestruction } from './GiantDestruction';
import type { GiantImpactDust } from './GiantImpactDust';
import type { EnemyRenderState } from '../RenderState';
import { ENEMY_HIT_STYLE, type EnemyHitImpulse } from './EnemyHitImpulse';
import { SURVIVING_HIT_STYLES, type HeavyHitFeedback } from './HeavyHitFeedback';

// Three bounded slots allow two live Colossi and one recent lethal freeze. Resources
// are borrowed from the Giant family; only slot materials and effects are owned.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly destruction: GiantDestruction;
  private readonly body: THREE.Mesh;
  private readonly helmet: THREE.Mesh;
  private readonly weapon = new THREE.Group();
  private readonly weaponRest = new THREE.Vector3();
  private readonly palette: { material: THREE.MeshStandardMaterial; color: THREE.Color }[];
  private readonly debris: GiantDebris;
  private readonly dimensions: { width: number; height: number; depth: number };
  private previous: EnemyRenderState | undefined;
  private deathAt = -Infinity;

  private readonly frozenRoot = new THREE.Matrix4();

  private readonly maulContact = new THREE.Vector3();
  private dustTriggered = false;

  constructor(private readonly scene: THREE.Scene, private readonly family: GiantVisualFamily, private readonly impactDust?: GiantImpactDust) {
    this.destruction = new GiantDestruction(scene);
    const material = (source: THREE.Material) => {
      if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires standard family materials');
      const result = (source.clone());
      result.color.set('white'); result.emissive.set(ART.fx.core); result.emissiveIntensity = 0; return result;
    };
    const bodyMaterial = material(family.body.material), gearMaterial = material(family.helmet.material);
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
    this.palette = [bodyMaterial, gearMaterial].map(material => ({ material, color: material.color.clone() }));
    const meshes = [this.body, this.helmet];
    if (this.weapon.children[0]) meshes.push(this.weapon.children[0] as THREE.Mesh);
    this.debris = new GiantDebris(meshes, [family.body.geometry, ...family.runFrames.map(frame => frame.geometry)]);
    for (const { material } of this.palette) this.debris.prepareMaterial(material);
    for (const mesh of meshes) mesh.frustumCulled = false;
    this.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.group), size = bounds.getSize(new THREE.Vector3());
    this.dimensions = family.presentation ?? { width: size.x, height: bounds.max.y, depth: size.z };
    this.group.visible = false;
    scene.add(this.group);
  }
  get id(): number | undefined { return this.previous?.id; }
  applyBlastReaction(x: number, z: number, strength: number): void {
    this.group.position.x += x * strength * .07;
    this.group.position.z += z * strength * .07;
    this.group.rotation.x += z * strength * .12;
    this.group.rotation.z -= x * strength * .12;
    this.group.updateMatrixWorld(true);
  }
  copyBodyWorld(target: THREE.Matrix4): boolean {
    if (!this.previous || !this.group.visible) return false;
    this.group.updateMatrixWorld(true); target.copy(this.group.matrixWorld);
    return true;
  }
  available(nowMs: number): boolean { return !this.previous || (Number.isFinite(this.deathAt) && nowMs - this.deathAt >= ENEMY_DEATH_TIMING.giant.totalMs); }
  barVisible(): boolean { return !!this.previous && !Number.isFinite(this.deathAt); }
  getModelDimensions(): { width: number; height: number; depth: number } { return { ...this.dimensions }; }
  healthBarLayout(enemy: EnemyRenderState): { width: number; height: number; y: number; x: number } {
    const base = enemy.visualScale ?? 1;
    const scale = enemy.visualScaleX ?? base;
    const bar = this.family.presentation?.healthBar ?? { width: this.dimensions.width * .75, height: this.dimensions.width * .75 / 6 };
    return { x: this.group.position.x, width: bar.width * scale, height: bar.height * scale,
      y: this.dimensions.height * (enemy.visualScaleY ?? base) + .35 };
  }
  die(enemy: EnemyRenderState, nowMs: number, variant=deathVariant(enemy.id), _attackerX?: number, _attackerZ?: number): THREE.Group {
    this.previous = enemy; this.deathAt = nowMs; this.dustTriggered = false;
    // Current body geometry, root, helmet lag and grip/maul stay untouched.
    this.group.updateMatrixWorld(true);
    this.frozenRoot.copy(this.group.matrixWorld);
    this.debris.capture(variant);
    this.destruction.present(this.frozenRoot, nowMs);
    // Burning interiors follow the authored torso landing sites, never the old standing pose.
    for (let source = 0; source < 2; source++) {
      this.debris.landingCenter(3 + source, this.maulContact);
      this.destruction.setWreckSource(source, this.maulContact, this.debris.landingAgeMs(3 + source));
    }
    this.group.matrixAutoUpdate = false;
    this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = false;
    return this.group;
  }
  private restorePalette(): void {
    for (const { material, color } of this.palette) {
      material.color.copy(color); material.opacity = 1; material.transparent = false; material.depthWrite = true; material.emissiveIntensity = 0;
    }
  }
  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback, impulse?: EnemyHitImpulse): void {
    if (enemy) {
      this.destruction.reset(); this.debris.reset();
      this.group.matrixAutoUpdate = true;
      this.helmet.geometry = this.family.helmet.geometry;
      if (this.family.weapon) (this.weapon.children[0] as THREE.Mesh).geometry = this.family.weapon.geometry;
      this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = true;
      this.previous = enemy; this.deathAt = -Infinity;
      const cycle = enemy.gaitCycleMs ?? 850, weight = giantWeightPose(enemy.id, nowMs, cycle), hit = hits.strength(enemy.id, nowMs);
      const kick = impulse?.strength(enemy.id, nowMs) ?? 0;
      this.body.geometry = this.family.runFrames[Math.floor(nowMs / (cycle / 4) + enemy.id * 1.52788745) & 3].geometry;
      const grip = giantGripMotion(weight.phase);
      this.weapon.position.set(this.weaponRest.x + grip.x, this.weaponRest.y + grip.y, this.weaponRest.z + grip.z);
      this.weapon.rotation.set(weight.weapon + .03 * hit, 0, Math.sin(weight.phase - .8) * .045);
      this.helmet.rotation.z = Math.cos(weight.phase - .25) * .012;
      this.group.position.set(-enemy.x + weight.shift * (enemy.visualScaleX ?? enemy.visualScale ?? 1), weight.bob, enemy.z + kick * ENEMY_HIT_STYLE.giant.distance);
      this.group.rotation.set(-.12 + kick * ENEMY_HIT_STYLE.giant.lean, Math.PI, weight.sway);
      const scale = enemy.visualScale ?? 1;
      this.group.scale.set(enemy.visualScaleX ?? scale, (enemy.visualScaleY ?? scale) * (1 - weight.compression - kick * ENEMY_HIT_STYLE.giant.compression), enemy.visualScaleZ ?? scale);
      this.group.visible = true; this.restorePalette();
      for (const { material } of this.palette) {
        material.emissive.set(SURVIVING_HIT_STYLES.giant.overlayColor);
        material.emissiveIntensity = SURVIVING_HIT_STYLES.giant.emissivePeak * hit;
      }
      this.group.updateMatrixWorld(true); hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs); return;
    }
    this.destruction.update(nowMs);
    const age = nowMs - this.deathAt;
    this.group.visible = !!this.previous && age >= 0 && age < GIANT_DEBRIS.totalMs;
    if (!this.group.visible) {
      if (age >= GIANT_DEBRIS.totalMs) for (const { material } of this.palette) material.opacity = 0;
      return;
    }
    this.debris.update(age);
    for (const { material, color } of this.palette) {
      material.color.copy(color); material.opacity = giantDebrisOpacity(age);
      material.transparent = material.opacity < 1; material.depthWrite = true; material.emissiveIntensity = 0;
    }
    if (!this.dustTriggered && age >= this.debris.landingAgeMs(7)) {
      this.debris.landingPoint(7, this.maulContact);
      this.impactDust?.spawn(this.maulContact.x, this.maulContact.z, this.deathAt + this.debris.landingAgeMs(7));
      this.dustTriggered = true;
    }
  }

  reset(): void {
    this.destruction.reset(); this.debris.reset();
    this.previous = undefined; this.deathAt = -Infinity;
    this.group.visible = false;
    this.group.matrixAutoUpdate = true;
    this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = true;
    this.weapon.position.copy(this.weaponRest); this.restorePalette();
  }
  dispose(): void {
    this.destruction.dispose();
    this.scene.remove(this.group);
    for (const { material } of this.palette) material.dispose();
  }
}
