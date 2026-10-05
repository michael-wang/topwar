import * as THREE from 'three';
import type { GiantVisualFamily } from '../CharacterVisualFamilies';
import { GIANT_REVEAL_MS, giantReveal } from '../../presentation/GiantDrama';
import { deathVariant } from './DeathAssembly';
import { lethalUpperMatrix } from './LethalReaction';
import { ART } from '../../art/ArtDirection';
import { giantWeightPose, giantGripMotion } from '../../presentation/CharacterMotion';
import { prepareCrowdMaterial } from './CrowdPresentation';
import { prepareEnemyDeathMaterial } from './EnemyDeathMaterial';
import { ENEMY_DEATH_TIMING, enemyDeathPose, enemyReactionStage } from '../../presentation/EnemyDeathTiming';
import type { EnemyRenderState } from '../RenderState';
import { ENEMY_HIT_STYLE, type EnemyHitImpulse } from './EnemyHitImpulse';
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

// Three bounded slots allow two live Colossi and one recent lethal freeze. Resources
// are borrowed from the Giant family; only slot materials and effects are owned.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly helmet: THREE.Mesh;
  private readonly weapon = new THREE.Group();
  private readonly weaponRest = new THREE.Vector3();
  private readonly palette: { material: THREE.MeshStandardMaterial; color: THREE.Color; tint: ReturnType<typeof prepareEnemyDeathMaterial> }[];
  private readonly dimensions: { width: number; height: number; depth: number };
  private readonly hazeMap = hazeTexture();
  private readonly hazeMaterial = new THREE.SpriteMaterial({ map: this.hazeMap, color: ART.world.fog,
    transparent: true, opacity: 0, depthWrite: false });
  private readonly haze = new THREE.Group();
  private bornAt = -Infinity;
  private previous: EnemyRenderState | undefined;
  private deathAt = -Infinity;
  private readonly frozenHelmet = new THREE.Matrix4();
  private readonly frozenWeapon = new THREE.Matrix4();
  private readonly reactionWeaponMatrices: readonly [THREE.Matrix4, THREE.Matrix4];
  private readonly reactionMatrices: readonly [THREE.Matrix4, THREE.Matrix4];
  constructor(private readonly scene: THREE.Scene, private readonly family: GiantVisualFamily) {
    const reaction = family.lethalReaction;
    this.reactionMatrices = [lethalUpperMatrix(.5, reaction?.sink ?? 0, reaction?.tilt ?? 0),
      lethalUpperMatrix(1, reaction?.sink ?? 0, reaction?.tilt ?? 0)];
    this.reactionWeaponMatrices = this.reactionMatrices.map((matrix, index) => new THREE.Matrix4().makeTranslation(0, (index + 1) * .025, 0).multiply(matrix)) as unknown as readonly [THREE.Matrix4, THREE.Matrix4];
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
      tint: prepareEnemyDeathMaterial(material, true) }));
    this.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.group), size = bounds.getSize(new THREE.Vector3());
    this.dimensions = family.presentation ?? { width: size.x, height: bounds.max.y, depth: size.z };
    this.group.visible = false;
    this.haze.name = 'giant-emergence-haze';
    for (let i = 0; i < 4; i++) this.haze.add(new THREE.Sprite(this.hazeMaterial));
    this.haze.visible = false;
    scene.add(this.group, this.haze);
  }
  get id(): number | undefined { return this.previous?.id; }
  copyBodyWorld(target: THREE.Matrix4): boolean {
    if (!this.previous || !this.group.visible) return false;
    this.group.updateMatrixWorld(true); target.copy(this.group.matrixWorld);
    return true;
  }
  available(nowMs: number): boolean { return !this.previous || (Number.isFinite(this.deathAt) && nowMs - this.deathAt >= ENEMY_DEATH_TIMING.giant.totalMs); }
  barVisible(nowMs: number): boolean { return giantReveal(nowMs - this.bornAt).barVisible; }
  getModelDimensions(): { width: number; height: number; depth: number } { return { ...this.dimensions }; }
  healthBarLayout(enemy: EnemyRenderState): { width: number; height: number; y: number; x: number } {
    const base = enemy.visualScale ?? 1;
    const scale = enemy.visualScaleX ?? base;
    const bar = this.family.presentation?.healthBar ?? { width: this.dimensions.width * .75, height: this.dimensions.width * .75 / 6 };
    return { x: this.group.position.x, width: bar.width * scale, height: bar.height * scale,
      y: this.dimensions.height * (enemy.visualScaleY ?? base) + .35 };
  }
  die(enemy: EnemyRenderState, nowMs: number): THREE.Group {
    this.previous = enemy; this.deathAt = nowMs;
    // Current body geometry, root, helmet lag and grip/maul stay untouched.
    this.group.updateMatrixWorld(true);
    this.frozenHelmet.copy(this.helmet.matrix); this.frozenWeapon.copy(this.weapon.matrix);
    this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = false;
    return this.group;
  }
  private restorePalette(): void {
    for (const { material, color, tint } of this.palette) {
      tint.gray.value = tint.breakup.value = 0;
      material.color.copy(color); material.opacity = 1; material.transparent = false; material.depthWrite = true; material.emissiveIntensity = 0;
    }
  }
  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback, impulse?: EnemyHitImpulse): void {
    if (enemy) {
      this.helmet.geometry = this.family.helmet.geometry;
      if (this.family.weapon) (this.weapon.children[0] as THREE.Mesh).geometry = this.family.weapon.geometry;
      this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = true;
      if (this.previous?.id !== enemy.id) this.bornAt = nowMs;
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
      this.group.updateMatrixWorld(true); hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs); return;
    }
    this.haze.visible = false;
    const age = nowMs - this.deathAt;
    const pose = enemyDeathPose(age, ENEMY_DEATH_TIMING.giant);
    this.group.visible = !!this.previous && pose.bodyVisible;
    if (!this.group.visible) return;
    const stage = enemyReactionStage(age, 'giant'), reaction = this.family.lethalReaction;
    if (reaction && stage > 0) {
      this.body.geometry = (stage === 1 ? reaction.transition : reaction.final).geometry;
      const upper = this.reactionMatrices[stage - 1];
      this.helmet.matrix.copy(this.frozenHelmet).premultiply(upper);
      this.weapon.matrix.copy(this.frozenWeapon).premultiply(this.reactionWeaponMatrices[stage - 1]);
      // Cant/lift the complete grip-hand + maul, never a separate moving hand.
      this.helmet.matrixWorldNeedsUpdate = this.weapon.matrixWorldNeedsUpdate = true;
    }
    // All vertices in a logical piece share one bounded displacement; the
    // grip-hand and maul remain a single piece throughout the breakup.
    const scale = Math.max(this.group.scale.x,this.group.scale.y,this.group.scale.z);
    const separation = pose.breakup / Math.max(.001,scale);
    if (stage === 2 && this.family.deathAssembly) {
      this.body.geometry = this.family.deathAssembly.body;
      this.helmet.geometry = this.family.deathAssembly.helmet;
      (this.weapon.children[0] as THREE.Mesh).geometry = this.family.deathAssembly.weapon;
    }
    this.helmet.matrixWorldNeedsUpdate = this.weapon.matrixWorldNeedsUpdate = true;
    for (const { material, color, tint } of this.palette) {
      material.color.copy(color); tint.gray.value = pose.gray; tint.breakup.value = separation;
      tint.variant.value = deathVariant(this.previous!.id);
      material.transparent = pose.bodyOpacity < 1; material.depthWrite = true;
      material.opacity = pose.bodyOpacity; material.emissiveIntensity = 0;
    }
  }
  reset(): void {
    this.previous = undefined; this.deathAt = this.bornAt = -Infinity;
    this.group.visible = this.haze.visible = false;
    this.helmet.matrixAutoUpdate = this.weapon.matrixAutoUpdate = true;
    this.weapon.position.copy(this.weaponRest); this.restorePalette();
  }
  dispose(): void {
    this.scene.remove(this.group, this.haze);
    this.hazeMap.dispose(); this.hazeMaterial.dispose();
    for (const { material } of this.palette) material.dispose();
  }
}
