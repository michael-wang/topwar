import { canShareCrowdBatch, ENEMY_GAIT_CYCLE_MS, type CharacterVisualFamilies,
  type CharacterParts, type CrowdVisualFamily } from '../CharacterVisualFamilies';
import { stepWeightPose } from '../../presentation/CharacterMotion';
import { prepareGiantBarFill } from './GiantHealthBar';
import { framedBarTexture } from '../art/FramedBarTextures';
import { ART } from '../../art/ArtDirection';
import { prepareCrowdMaterial } from './CrowdPresentation';
import { lethalUpperMatrix } from './LethalReaction';
import { GiantRenderer } from './GiantRenderer';
import { hitBloodVariation } from './HitBloodVariation';
import { IntegratedDeathBlood } from './IntegratedDeathBlood';
import { deathVariant } from './DeathAssembly';
import { EnemyHitImpulse, ENEMY_HIT_STYLE, HIT_BLOOD_TIMING, HIT_BLOOD_CAPACITY } from './EnemyHitImpulse';
import { HeavyHitFeedback, HEAVY_HIT_FLASH_MS } from './HeavyHitFeedback';
import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { BloodSplat, GroundBloodStains, hitBloodAtlas, groundBloodAtlas } from './BloodSplat';
import { CrowdDeathBatches } from './CrowdDeathBatches';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';
import type { PresentationEvent } from '../../simulation/PresentationEvent';
import { ENEMY_DEATH_TIMING, enemyDeathPose, enemyReactionStage, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
import { prepareEnemyDeathMaterial } from './EnemyDeathMaterial';

export { ENEMY_GAIT_CYCLE_MS, HEAVY_GAIT_CYCLE_MS } from '../CharacterVisualFamilies';

const HIT_FLASH_MS = 80;
const MAX_DEATH_VISUALS = 48;
export const ENEMY_CONTACT_MS = 240;
const MAX_CONTACT_VISUALS = 48;
const CONTACT_FLASH_MS = 150;
export const ENEMY_VISUAL_SCALE = 0.82;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  id: number;
  gearFreeze: readonly [THREE.Matrix4, THREE.Matrix4];
  parts: CharacterParts;
  scale: THREE.Vector3;
  group: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  gearMaterial: THREE.MeshStandardMaterial;
  startedAtMs: number;
  heavy: boolean;
  role: EnemyDeathRole;
  bodyTint: ReturnType<typeof prepareEnemyDeathMaterial>;
  gearTint: ReturnType<typeof prepareEnemyDeathMaterial>;
}

interface ContactVisual {
  parts: CharacterParts;
  scale: THREE.Vector3;
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  startedAtMs: number;
  x: number;
  z: number;
  direction: number;
}

export function enemyWalkPose(id: number, nowMs: number, cycleMs = ENEMY_GAIT_CYCLE_MS): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * (Math.PI * 2 / cycleMs) + id * 2.399963229728653);
  return { leftArm: stride * 0.43, rightArm: -stride * 0.43,
    leftLeg: -stride * 0.43, rightLeg: stride * 0.43,
    bob: Math.abs(stride) * 0.052 };
}

export function enemyRunFrame(id: number, nowMs: number, cycleMs = ENEMY_GAIT_CYCLE_MS): number {
  return Math.floor(nowMs / (cycleMs / 4) + id * 1.52788745) & 3;
}

function setEnemyScale(target: THREE.Vector3, enemy?: EnemyRenderState, scaleY = 1): void {
  const base = enemy?.visualScale ?? ENEMY_VISUAL_SCALE;
  target.set(enemy?.visualScaleX ?? base, (enemy?.visualScaleY ?? base) * scaleY, enemy?.visualScaleZ ?? base);
}

interface CrowdBatch {
  family: CrowdVisualFamily;
  modelTop: number;
  helmetMaterial: THREE.MeshStandardMaterial;
  capacity: number[];
  bodyCapacity: number[];
  bodyMeshes: THREE.InstancedMesh[];
  helmetMeshes: THREE.InstancedMesh[];
  vestMeshes: THREE.InstancedMesh[];
}

export class EnemyRenderer {
  getDebugStats(): { current: number; bodyCapacities: number[]; tierCapacities: number[];
    deathVisuals: number; contactVisuals: number } {
    return { current: this.previousEnemies.size, bodyCapacities: this.batches.flatMap(batch => batch.bodyCapacity),
      tierCapacities: this.batches.flatMap(batch => batch.capacity), deathVisuals: this.deathVisuals.reduce((n,v)=>n+(v.group.visible?1:0),0),
      contactVisuals: this.contactVisuals.length };
  }
  private readonly batches: CrowdBatch[] = [];
  private readonly roleBatches: Record<'grunt' | 'heavy', CrowdBatch>;
  private readonly helmetColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashColor = new THREE.Color(ART.fx.core);
  private readonly authoredBodyColor = new THREE.Color('white');
  private readonly gruntBodyColor = new THREE.Color(ART.faction.grunt);
  private readonly heavyBodyColor = new THREE.Color(ART.faction.heavyBody);
  private readonly heavyColor = new THREE.Color(ART.faction.heavy);
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly contactVisuals: ContactVisual[] = [];
  private readonly contactIds = new Set<number>();
  private readonly contactFlashMaterial = new THREE.MeshBasicMaterial({
    color: ART.fx.core, toneMapped: false });
  private readonly heavyHits: HeavyHitFeedback;
  private readonly giantRenderers: GiantRenderer[];
  // Indices of the last drawn instance, captured before live batches are rewritten.
  private readonly renderedCrowd = new Map<number, { batch: CrowdBatch; frame: number; bodyIndex: number; palette: number; gearIndex: number }>();
  private readonly inverseFrozen = new THREE.Matrix4();
  private readonly feedbackOrigin = new THREE.Vector3();
  private readonly feedbackScale = new THREE.Vector3();
  private readonly feedbackMatrix = new THREE.Matrix4();
  private readonly pendingHitBlood = new Map<number, number>();
  private readonly hitTexture = hitBloodAtlas();
  private readonly stainTexture = groundBloodAtlas();
  private readonly stains: GroundBloodStains;
  private sceneMode: boolean | undefined;
  private readonly blood: IntegratedDeathBlood;
  private readonly hitBlood: BloodSplat;
  private readonly hitImpulse = new EnemyHitImpulse();
  private readonly reactionMatrices = new Map<string, readonly [THREE.Matrix4, THREE.Matrix4]>();
  private readonly deathBatches: CrowdDeathBatches;
  private readonly healthBars: { backing: THREE.Sprite; fill: THREE.Sprite; clip: ReturnType<typeof prepareGiantBarFill> }[] = [];
  private readonly barFrameTexture = framedBarTexture(false, ART.enemyHealth);
  private readonly barHitColor = new THREE.Color(ART.enemyHealth.hit);
  private readonly barFillTexture = framedBarTexture(true);
  private readonly barBackingMaterial = new THREE.SpriteMaterial({ map: this.barFrameTexture, depthTest: false, toneMapped: false });
  private readonly barFillMaterial = new THREE.SpriteMaterial({ map: this.barFillTexture, color: ART.enemyHealth.heavy, depthTest: false, toneMapped: false });
  private readonly giantBarFillMaterial = new THREE.SpriteMaterial({ map: this.barFillTexture, color: ART.enemyHealth.giant, depthTest: false, toneMapped: false });
  constructor(private readonly scene: THREE.Scene,
    private readonly families: Pick<CharacterVisualFamilies, 'grunt' | 'heavy' | 'giant'>) {
    for (const family of [families.grunt, families.heavy, families.giant]) if (family.lethalReaction) {
      const { sink, tilt } = family.lethalReaction;
      this.reactionMatrices.set(family.role, [lethalUpperMatrix(.5, sink, tilt), lethalUpperMatrix(1, sink, tilt)]);
    }
    const grunt = this.createBatch(families.grunt);
    const heavy = canShareCrowdBatch(families.grunt, families.heavy) ? grunt : this.createBatch(families.heavy);
    this.roleBatches = { grunt, heavy };
    this.hitBlood = new BloodSplat(scene, this.hitTexture, HIT_BLOOD_CAPACITY, 'enemy-hit-blood');
    this.stains = new GroundBloodStains(scene, this.stainTexture);
    this.blood = new IntegratedDeathBlood(scene, this.stains);
    this.deathBatches = new CrowdDeathBatches(scene, MAX_DEATH_VISUALS);
    for (let i = 0; i < MAX_DEATH_VISUALS; i++) this.createDeathVisual(families.grunt);
    this.heavyHits = new HeavyHitFeedback(scene);
    this.giantRenderers = Array.from({ length: 3 }, () => new GiantRenderer(scene, families.giant));
  }

  private createBatch(family: CrowdVisualFamily): CrowdBatch {
    const { body: bodyModel, helmet: helmetModel, runFrames } = family;
    if (runFrames.length !== 4) throw new Error('Toy soldier run requires four baked poses');
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    const modelTop = Math.max(...[helmetModel, ...runFrames].map(model => {
      model.geometry.computeBoundingBox();
      return model.geometry.boundingBox!.max.y;
    }));
    if (bodyModel.material instanceof THREE.MeshStandardMaterial) prepareCrowdMaterial(bodyModel.material, family.presentation, 'body');
    if (!(family.death.body.material instanceof THREE.MeshStandardMaterial)) throw new Error('Gray death body needs a standard material');
    prepareCrowdMaterial(family.death.body.material, family.presentation, 'death');
    const helmetMaterial = prepareCrowdMaterial(source.clone(), family.presentation);
    helmetMaterial.color.set('white');
    const batch: CrowdBatch = { family, modelTop, helmetMaterial, capacity: PALETTES.map(() => 1),
      bodyCapacity: [1, 1, 1, 1], bodyMeshes: [], helmetMeshes: [], vestMeshes: [] };
    batch.bodyMeshes = runFrames.map((_, frame) => this.createBody(batch, frame, 1));
    batch.helmetMeshes = PALETTES.map(palette => this.createTier(batch, palette, 1));
    batch.vestMeshes = PALETTES.map(palette => this.createTier(batch, palette, 1, true));
    this.scene.add(...batch.bodyMeshes, ...batch.helmetMeshes, ...batch.vestMeshes);
    this.batches.push(batch);
    return batch;
  }

  private crowdFamily(enemy?: EnemyRenderState): CrowdVisualFamily {
    return enemy?.archetype === 'heavy' ? this.families.heavy : this.families.grunt;
  }

  private batchFor(enemy: EnemyRenderState): CrowdBatch {
    return this.roleBatches[enemy.archetype === 'heavy' ? 'heavy' : 'grunt'];
  }

  present(events: readonly PresentationEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.kind !== 'normalEnemyContact') continue;
      this.contactIds.add(event.enemyId);
      this.spawnContact(event.enemyTier, event.attackerX, event.attackerZ,
        event.enemyId, nowMs);
    }
  }

  update(enemies: readonly EnemyRenderState[], nowMs = performance.now(), sceneMode?: boolean): void {
    this.pendingHitBlood.clear();
    if (sceneMode !== undefined) {
      if (this.sceneMode !== undefined && this.sceneMode !== sceneMode) this.reset();
      this.sceneMode = sceneMode;
    }
    const currentIds = new Set(enemies.map((enemy) => enemy.id));
    for (const previous of this.previousEnemies.values()) {
      if (!currentIds.has(previous.id)) {
        this.hitBlood.cancel(previous.id);
        if (!this.contactIds.has(previous.id)) {
          const frozen = previous.archetype === 'giant'
            ? this.giantRenderers.find(renderer => renderer.id === previous.id)?.die(previous, nowMs)
            : this.spawnDeath(previous, nowMs);
          if (frozen) this.scheduleKillFeedback(previous, frozen, nowMs);
        }
        if (this.contactIds.has(previous.id) && previous.archetype === 'giant')
          this.giantRenderers.find(renderer => renderer.id === previous.id)?.reset();
        this.flashUntilMs.delete(previous.id);
        this.renderedCrowd.delete(previous.id);
      }
    }
    for (const enemy of enemies) {
      const previous = this.previousEnemies.get(enemy.id);
      if (previous && enemy.hp > 0 && enemy.hp < previous.hp) {
        this.pendingHitBlood.set(enemy.id, this.hitImpulse.observe(enemy.id, nowMs, enemy.archetype ?? 'grunt'));
        if (enemy.archetype !== 'heavy' && enemy.archetype !== 'giant') this.flashUntilMs.set(enemy.id, nowMs + HIT_FLASH_MS);
        else if (this.heavyHits.observe(enemy, nowMs)) this.flashUntilMs.set(enemy.id, nowMs + HEAVY_HIT_FLASH_MS);
      }
      this.previousEnemies.set(enemy.id, { ...enemy });
    }
    for (const id of this.previousEnemies.keys()) if (!currentIds.has(id)) this.previousEnemies.delete(id);
    this.hitImpulse.prune(currentIds);
    this.contactIds.clear();
    this.updateDeaths(nowMs);
    this.updateContacts(nowMs);
    this.heavyHits.update(currentIds, nowMs);
    for (const enemy of enemies) if (enemy.archetype === 'giant') {
      const renderer = this.giantRenderers.find(slot => slot.id === enemy.id)
        ?? this.giantRenderers.find(slot => slot.available(nowMs));
      renderer?.update(enemy, nowMs, this.heavyHits, this.hitImpulse);
    }
    for (const renderer of this.giantRenderers) if (!currentIds.has(renderer.id ?? -1)) renderer.update(undefined, nowMs, this.heavyHits, this.hitImpulse);
    this.blood.update(nowMs);
    this.stains.update(nowMs);

    const giantCount = enemies.reduce((count, enemy) => count + (enemy.archetype === 'giant' ? 1 : 0), 0);
    let barIndex = 0;
    for (const enemy of enemies) {
      if ((enemy.archetype !== 'heavy' && enemy.archetype !== 'giant') || enemy.maxHp === undefined) continue;
      const giantSlot = enemy.archetype === 'giant' ? this.giantRenderers.find(slot => slot.id === enemy.id) : undefined;
      if (giantSlot && !giantSlot.barVisible(nowMs)) continue;
      let bar = this.healthBars[barIndex++];
      if (!bar) {
        const material = this.barFillMaterial.clone();
        bar = { backing: new THREE.Sprite(this.barBackingMaterial), fill: new THREE.Sprite(material),
          clip: prepareGiantBarFill(material) };
        bar.backing.name = 'heavy-hp-backing';
        bar.fill.name = 'heavy-hp-fill';
        bar.backing.renderOrder = 10;
        bar.fill.renderOrder = 11;
        this.scene.add(bar.backing, bar.fill);
        this.healthBars.push(bar);
      }
      const fraction = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      const giantBar = enemy.archetype === 'giant' ? giantSlot!.healthBarLayout(enemy) : undefined;
      const presentation = this.families.heavy.presentation;
      const width = giantBar ? giantBar.width * (giantCount > 1 ? .8 : 1)
        : presentation.hpAnchor ? presentation.hpAnchor.width * (enemy.visualScaleX ?? enemy.visualScale ?? ENEMY_VISUAL_SCALE) : 1.1;
      const y = giantBar?.y ?? (enemy.visualScaleY ?? enemy.visualScale ?? ENEMY_VISUAL_SCALE)
        * (presentation.scaleY ?? 1) * (presentation.hpAnchor?.top ?? this.roleBatches.heavy.modelTop) + .3;
      bar.backing.visible = true;
      bar.fill.visible = fraction > 0;
      bar.backing.position.set(giantBar?.x ?? -enemy.x, y, enemy.z);
      // Reuse the rate-limited additive hit impulse; each pooled bar owns its tint.
      const hit = this.heavyHits.strength(enemy.id, nowMs);
      (bar.fill.material as THREE.SpriteMaterial).color.copy(giantBar ? this.giantBarFillMaterial.color : this.barFillMaterial.color)
        .lerp(this.barHitColor, hit);
      bar.backing.scale.set(giantBar ? width : width + .10, giantBar ? giantBar.height * (giantCount > 1 ? .8 : 1) : .26, 1);
      bar.clip.enabled.value = giantBar ? 1 : 0; bar.clip.fraction.value = fraction;
      if (giantBar) {
        bar.fill.position.copy(bar.backing.position);
        bar.fill.scale.copy(bar.backing.scale);
      } else {
        bar.fill.position.set(-enemy.x + width * (1 - fraction) / 2, y, enemy.z);
        bar.fill.scale.set(width * fraction, .14 * (1 + this.heavyHits.strength(enemy.id, nowMs) * .12), 1);
      }
    }
    for (; barIndex < this.healthBars.length; barIndex++) {
      this.healthBars[barIndex].backing.visible = false;
      this.healthBars[barIndex].fill.visible = false;
    }
    for (const batch of this.batches) this.updateBatch(batch, enemies, nowMs);
    for (const enemy of enemies) {
      const sequence = this.pendingHitBlood.get(enemy.id);
      if (sequence === undefined && this.hitImpulse.strength(enemy.id, nowMs) === 0) continue;
      if (!this.copyBodyWorld(enemy, this.feedbackMatrix)) continue;
      if (sequence !== undefined) this.presentSurvivingHit(enemy, sequence, nowMs);
      this.hitBlood.follow(enemy.id, this.feedbackMatrix);
    }
    this.hitBlood.update(nowMs);
  }

  private updateBatch(batch: CrowdBatch, enemies: readonly EnemyRenderState[], nowMs: number): void {
    const counts = PALETTES.map(() => 0);
    const bodyCounts = [0, 0, 0, 0];
    for (const enemy of enemies) {
      if (enemy.archetype === 'giant' || this.batchFor(enemy) !== batch) continue;
      counts[paletteIndex(enemy.tier, PALETTES.length)]++;
      bodyCounts[enemyRunFrame(enemy.id, nowMs, this.crowdFamily(enemy).gaitCycleMs)]++;
    }
    for (let frame = 0; frame < 4; frame++) {
      if (bodyCounts[frame] > batch.bodyCapacity[frame]) this.growBody(batch, frame, bodyCounts[frame]);
      batch.bodyMeshes[frame].count = bodyCounts[frame];
    }
    for (const palette of PALETTES) {
      if (counts[palette] > batch.capacity[palette]) this.growTier(batch, palette, counts[palette]);
      batch.helmetMeshes[palette].count = counts[palette];
      batch.vestMeshes[palette].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    const bodyIndices = [0, 0, 0, 0];
    for (let bodyIndex = 0; bodyIndex < enemies.length; bodyIndex++) {
      const enemy = enemies[bodyIndex];
      if (enemy.archetype === 'giant' || this.batchFor(enemy) !== batch) continue;
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const pose = enemyWalkPose(enemy.id, nowMs, this.crowdFamily(enemy).gaitCycleMs);
      const transform = this.transform;
      const heavy = enemy.archetype === 'heavy';
      const presentation = this.crowdFamily(enemy).presentation;
      const step = presentation.stepWeight && stepWeightPose(enemy.id, nowMs, this.crowdFamily(enemy).gaitCycleMs);
      // Low bounce, stronger alternating weight transfer distinguish a Heavy.
      const sway = step ? step.support * presentation.stepWeight!.roll : pose.leftArm * (heavy ? .18 : .075);
      transform.position.set(-enemy.x + (step ? step.support * presentation.stepWeight!.shift
        * (enemy.visualScaleX ?? enemy.visualScale ?? ENEMY_VISUAL_SCALE) : 0),
        step ? (1 - step.landing) * .007 : pose.bob * (heavy ? .38 : .80), enemy.z);
      transform.rotation.set(-0.15 + pose.leftLeg * 0.035, Math.PI,
        sway);
      const hitStrength = this.heavyHits.strength(enemy.id, nowMs);
      const impact = this.hitImpulse.strength(enemy.id, nowMs), style = ENEMY_HIT_STYLE[heavy ? 'heavy' : 'grunt'];
      transform.position.z += style.distance * impact;
      transform.rotation.x += style.lean * impact;
      setEnemyScale(transform.scale, enemy, presentation.scaleY);
      if (step) transform.scale.y *= 1 - step.landing * presentation.stepWeight!.compression;
      transform.scale.y *= 1 - Math.max((presentation.hitCompression ?? 0) * hitStrength, style.compression * impact);
      transform.updateMatrix();
      const frame = enemyRunFrame(enemy.id, nowMs, this.crowdFamily(enemy).gaitCycleMs);
      const bodySlot = bodyIndices[frame]++;
      batch.bodyMeshes[frame].setMatrixAt(bodySlot, transform.matrix);
      // Authored vertex colors stay neutral; legacy instances select the tunic swatch.
      batch.bodyMeshes[frame].setColorAt(bodySlot, batch.family.presentation.bodyTint === 'authored' ? this.authoredBodyColor
        : heavy ? this.heavyBodyColor : this.gruntBodyColor);
      this.heavyHits.setBody(enemy.id, batch.family.runFrames[frame].geometry, transform.matrix, nowMs);
      const helmet = batch.helmetMeshes[palette];
      // Gear follows the torso a little late; retain the same instancing batches.
      transform.rotation.z = sway * .82;
      transform.updateMatrix();
      helmet.setMatrixAt(index, transform.matrix);
      const vest = batch.vestMeshes[palette];
      transform.rotation.z = sway * .92;
      transform.updateMatrix();
      vest.setMatrixAt(index, transform.matrix);
      let rendered = this.renderedCrowd.get(enemy.id);
      if (!rendered) {
        rendered = { batch, frame, bodyIndex: bodySlot, palette, gearIndex: index };
        this.renderedCrowd.set(enemy.id, rendered);
      } else { rendered.batch = batch; rendered.frame = frame; rendered.bodyIndex = bodySlot; rendered.palette = palette; rendered.gearIndex = index; }
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      const color = batch.family.presentation.gearTint === 'authored' ? this.authoredBodyColor
        : enemy.archetype === 'heavy' ? this.heavyColor : this.helmetColors[palette];
      helmet.setColorAt(index, flashing ? this.flashColor : color);
      vest.setColorAt(index, flashing ? this.flashColor : color);
    }
    for (const mesh of batch.bodyMeshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const palette of PALETTES) {
      batch.helmetMeshes[palette].instanceMatrix.needsUpdate = true;
      if (batch.helmetMeshes[palette].instanceColor) batch.helmetMeshes[palette].instanceColor.needsUpdate = true;
      batch.vestMeshes[palette].instanceMatrix.needsUpdate = true;
      if (batch.vestMeshes[palette].instanceColor) batch.vestMeshes[palette].instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.renderedCrowd.clear();
    this.pendingHitBlood.clear();
    this.flashUntilMs.clear();
    this.contactIds.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
    for (const visual of this.contactVisuals) visual.group.visible = false;
    for (const bar of this.healthBars) { bar.backing.visible = false; bar.fill.visible = false; }
    this.blood.reset(); this.hitBlood.reset(); this.hitImpulse.reset();
    this.stains.reset();
    this.deathBatches.reset();
    this.heavyHits.reset();
    this.giantRenderers.forEach(renderer => renderer.reset());
  }

  dispose(): void {
    for (const batch of this.batches) for (const mesh of [...batch.bodyMeshes, ...batch.helmetMeshes, ...batch.vestMeshes]) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    for (const visual of this.deathVisuals) {
      this.scene.remove(visual.group);
      visual.bodyMaterial.dispose();
      visual.gearMaterial.dispose();
    }
    this.deathVisuals.length = 0;
    for (const visual of this.contactVisuals) {
      this.scene.remove(visual.group);
      for (const material of visual.materials) material.dispose();
    }
    this.contactVisuals.length = 0;
    this.previousEnemies.clear();
    this.renderedCrowd.clear();
    this.flashUntilMs.clear();
    for (const bar of this.healthBars) { this.scene.remove(bar.backing, bar.fill); bar.fill.material.dispose(); }
    this.healthBars.length = 0;
    this.barBackingMaterial.dispose();
    this.barFillMaterial.dispose(); this.giantBarFillMaterial.dispose();
    this.barFrameTexture.dispose(); this.barFillTexture.dispose();
    this.blood.dispose(); this.hitBlood.dispose(); this.hitImpulse.reset();
    this.stains.dispose(); this.hitTexture.dispose(); this.stainTexture.dispose();
    this.deathBatches.dispose();
    this.heavyHits.dispose();
    this.giantRenderers.forEach(renderer => renderer.dispose());
    for (const batch of this.batches) batch.helmetMaterial.dispose();
    this.contactFlashMaterial.dispose();
  }

  private spawnContact(tier: number, x: number, z: number, id: number, nowMs: number): void {
    const enemy = this.previousEnemies.get(id);
    const giant = enemy?.archetype === 'giant';
    const parts = giant ? this.families.giant.contact : this.crowdFamily(enemy).contact;
    const presentation = giant ? this.families.giant.contactPresentation : this.crowdFamily(enemy).presentation;
    let visual = this.contactVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.contactVisuals.length < MAX_CONTACT_VISUALS) {
      const models = [parts.body, parts.helmet, parts.vest];
      const group = new THREE.Group();
      group.name = 'enemy-contact-exchange';
      const materials = models.map((model, index) => {
        if (!(model.material instanceof THREE.MeshStandardMaterial)) {
          throw new Error('Enemy contact visuals require standard materials');
        }
        const material = prepareCrowdMaterial(model.material.clone(), presentation, index === 0 ? 'body' : 'gear');
        material.transparent = true;
        material.depthWrite = false;
        return material;
      });
      models.forEach((model, index) => {
        const mesh = new THREE.Mesh(model.geometry, materials[index]);
        mesh.visible = model.visible;
        group.add(mesh);
      });
      this.scene.add(group);
      visual = { parts, group, materials, startedAtMs: nowMs, x, z, direction: 1, scale: new THREE.Vector3() };
      this.contactVisuals.push(visual);
    }
    if (!visual) visual = this.contactVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    if (!this.sameParts(visual.parts, parts)) {
      const models = [parts.body, parts.helmet, parts.vest];
      models.forEach((model, index) => {
        if (!(model.material instanceof THREE.MeshStandardMaterial)) throw new Error('Enemy contact visuals require standard materials');
        visual!.materials[index].dispose();
        const material = prepareCrowdMaterial(model.material.clone(), presentation, index === 0 ? 'body' : 'gear');
        material.transparent = true; material.depthWrite = false;
        visual!.materials[index] = material;
        const mesh = visual!.group.children[index] as THREE.Mesh;
        mesh.geometry = model.geometry;
        mesh.material = material;
        mesh.visible = model.visible;
      });
      visual.parts = parts;
    }
    visual.startedAtMs = nowMs;
    visual.x = x;
    visual.z = z;
    visual.direction = id % 2 === 0 ? -1 : 1;
    setEnemyScale(visual.scale, enemy, giant ? 1 : this.crowdFamily(enemy).presentation.scaleY);
    visual.group.visible = true;
    visual.group.rotation.set(0, Math.PI, 0);
    visual.group.position.set(-x, 0, z);
    visual.group.scale.copy(visual.scale);
    for (const material of visual.materials) material.opacity = 1;
    const color = presentation.gearTint === 'authored' ? this.authoredBodyColor : enemy?.archetype === 'heavy' ? this.heavyColor
      : this.helmetColors[paletteIndex(tier, PALETTES.length)];
    visual.materials[1].color.copy(color);
    visual.materials[2].color.copy(color);
  }

  private updateContacts(nowMs: number): void {
    for (const visual of this.contactVisuals) {
      if (!visual.group.visible) continue;
      const age = nowMs - visual.startedAtMs;
      if (age >= ENEMY_CONTACT_MS) { visual.group.visible = false; continue; }
      const progress = Math.max(0, age / ENEMY_CONTACT_MS);
      const flashing = age < CONTACT_FLASH_MS;
      visual.group.children.forEach((part, index) => {
        (part as THREE.Mesh).material = flashing ? this.contactFlashMaterial : visual.materials[index];
        visual.materials[index].opacity = flashing ? 1 : Math.max(0,
          1 - (age - CONTACT_FLASH_MS) / (ENEMY_CONTACT_MS - CONTACT_FLASH_MS));
      });
      visual.group.position.set(-visual.x + visual.direction * .8 * progress,
        .5 * Math.sin(Math.PI * progress), visual.z + .9 * progress);
      visual.group.rotation.z = visual.direction * .45 * progress;
      visual.group.scale.copy(visual.scale).multiplyScalar(1.12 - .26 * progress);
    }
  }

  private copyBodyWorld(enemy: EnemyRenderState, target: THREE.Matrix4): boolean {
    if (enemy.archetype === 'giant') return this.giantRenderers.find(slot => slot.id === enemy.id)?.copyBodyWorld(target) ?? false;
    const rendered = this.renderedCrowd.get(enemy.id); if (!rendered) return false;
    const mesh = rendered.batch.bodyMeshes[rendered.frame];
    mesh.updateWorldMatrix(true, false); mesh.getMatrixAt(rendered.bodyIndex, target);
    target.premultiply(mesh.matrixWorld); return true;
  }

  private presentSurvivingHit(enemy: EnemyRenderState, sequence: number, nowMs: number): void {
    const role = enemy.archetype ?? 'grunt';
    const variation = hitBloodVariation(enemy.id, sequence, role);
    this.feedbackOrigin.fromArray(variation.localAnchor).applyMatrix4(this.feedbackMatrix);
    this.feedbackScale.setFromMatrixScale(this.feedbackMatrix);
    const adaptation = Math.sqrt((this.feedbackScale.x + this.feedbackScale.y + this.feedbackScale.z) / 3);
    this.hitBlood.spawnStyled(enemy.id, HIT_BLOOD_TIMING[role], nowMs, this.feedbackOrigin, adaptation, enemy.id, variation);
  }

  private scheduleKillFeedback(enemy: EnemyRenderState, frozen: THREE.Group, nowMs: number): void {
    const role = enemy.archetype === 'giant' ? 'giant' : enemy.archetype === 'heavy' ? 'heavy' : 'grunt';
    frozen.updateMatrixWorld(true); this.feedbackMatrix.copy(frozen.matrixWorld);
    // Blood origins are authored in the final assembly's already-reacted local
    // coordinates. Applying the upper-mass reaction again would bury the red
    // masses below the actual torso seams.
    this.blood.spawn(enemy.id, role, nowMs, this.feedbackMatrix, frozen.position.x, frozen.position.z);
  }

  // Pose holders/materials are preallocated; deaths never allocate Mesh objects.
  private createDeathVisual(family: CrowdVisualFamily): void {
    const { death: parts, presentation } = family, role = family.role;
    const procedural = presentation.materialStyle === 'vertex-colors';
      const group = new THREE.Group();
      group.name = 'enemy-pale-death-body';
      const bodyMaterial = prepareCrowdMaterial(((procedural ? family.body : parts.body).material as THREE.MeshStandardMaterial).clone(), presentation, 'death');
      const bodyTint = prepareEnemyDeathMaterial(bodyMaterial);
      const gearMaterial = prepareCrowdMaterial((parts.helmet.material as THREE.MeshStandardMaterial).clone(), presentation);
      const gearTint = prepareEnemyDeathMaterial(gearMaterial);
      const body = new THREE.Mesh(parts.body.geometry, bodyMaterial);
      const helmet = new THREE.Mesh(parts.helmet.geometry, gearMaterial);
      const vest = new THREE.Mesh(parts.vest.geometry, gearMaterial);
      vest.visible = parts.vest.visible;
      group.add(body, helmet, vest);
      // Pose holders are inspected/reused but rendered through shared batches.
      group.children.forEach(part => part.layers.set(31));
      this.scene.add(group);
      group.visible = false;
      this.deathVisuals.push({ id: -1, gearFreeze: [new THREE.Matrix4(), new THREE.Matrix4()], parts, group, bodyMaterial, gearMaterial, bodyTint, gearTint, startedAtMs: -Infinity, scale: new THREE.Vector3(), heavy: false, role });
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): THREE.Group | undefined {
    const rendered = this.renderedCrowd.get(enemy.id);
    if (!rendered) return undefined;
    const family = this.crowdFamily(enemy), { death: parts, presentation } = family;
    const procedural = presentation.materialStyle === 'vertex-colors';
    const role = family.role;
    let visual = this.deathVisuals.find(candidate => !candidate.group.visible);
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    if (!this.sameParts(visual.parts, parts)) {
      const rebind = (target: THREE.MeshStandardMaterial, source: THREE.MeshStandardMaterial, surface: 'death' | 'gear') => {
        target.copy(source); target.onBeforeCompile = source.onBeforeCompile;
        target.customProgramCacheKey = source.customProgramCacheKey;
        prepareCrowdMaterial(target, presentation, surface); target.needsUpdate = true;
      };
      rebind(visual.bodyMaterial, (procedural ? family.body : parts.body).material as THREE.MeshStandardMaterial, 'death');
      rebind(visual.gearMaterial, parts.helmet.material as THREE.MeshStandardMaterial, 'gear');
      visual.bodyTint = prepareEnemyDeathMaterial(visual.bodyMaterial);
      visual.gearTint = prepareEnemyDeathMaterial(visual.gearMaterial);
      [parts.body, parts.helmet, parts.vest].forEach((model, index) => {
        const mesh = visual!.group.children[index] as THREE.Mesh;
        mesh.geometry = model.geometry;
        mesh.material = index === 0 ? visual!.bodyMaterial : visual!.gearMaterial;
        mesh.visible = model.visible;
      });
      visual.parts = parts;
    }
    visual.startedAtMs = nowMs;
    visual.id = enemy.id;
    visual.role = role;
    visual.heavy = enemy.archetype === 'heavy';
    setEnemyScale(visual.scale, enemy, presentation.scaleY);
    // Keep depth writes during the intact fade so a hollow helmet shell
    // preserves its exact opaque silhouette instead of showing its inner faces.
    visual.bodyMaterial.transparent = visual.gearMaterial.transparent = false;
    visual.bodyMaterial.depthWrite = visual.gearMaterial.depthWrite = true;
    visual.bodyMaterial.opacity = 1;
    visual.gearMaterial.opacity = 1;
    visual.bodyTint.gray.value = visual.gearTint.gray.value = 0;
    visual.gearMaterial.color.copy(presentation.gearTint === 'authored' ? this.authoredBodyColor
      : visual.heavy ? this.heavyColor : this.helmetColors[paletteIndex(enemy.tier, PALETTES.length)]);
    visual.group.visible = true;
    // Copy actual GPU instance matrices, including hit compression and delayed
    // helmet/gear weight transfer. Never evaluate a gait or death transform here.
    const root = visual.group;
    root.matrixAutoUpdate = false;
    rendered.batch.bodyMeshes[rendered.frame].getMatrixAt(rendered.bodyIndex, root.matrix);
    root.matrix.decompose(root.position, root.quaternion, root.scale);
    root.matrixWorldNeedsUpdate = true;
    visual.scale.copy(root.scale);
    this.inverseFrozen.copy(root.matrix).invert();
    const body = root.children[0] as THREE.Mesh;
    body.geometry = rendered.batch.bodyMeshes[rendered.frame].geometry;
    body.matrixAutoUpdate = false; body.matrix.identity();
    for (let index = 1; index <= 2; index++) {
      const part = root.children[index];
      const mesh = (index === 1 ? rendered.batch.helmetMeshes : rendered.batch.vestMeshes)[rendered.palette];
      part.matrixAutoUpdate = false;
      mesh.getMatrixAt(rendered.gearIndex, part.matrix);
      part.matrix.premultiply(this.inverseFrozen);
      visual.gearFreeze[index - 1].copy(part.matrix);
      part.matrix.decompose(part.position, part.quaternion, part.scale);
    }
    root.updateMatrixWorld(true);
    return root;
  }

  private updateDeaths(nowMs: number): void {
    this.deathBatches.begin();
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      const pose = enemyDeathPose(elapsed, ENEMY_DEATH_TIMING[visual.role]);
      const reaction = this.families[visual.role].lethalReaction;
      const stage = enemyReactionStage(elapsed, visual.role);
      if (reaction && stage > 0) {
        (visual.group.children[0] as THREE.Mesh).geometry = (stage === 1 ? reaction.transition : reaction.final).geometry;
        for (let index = 1; index <= 2; index++) {
          const part = visual.group.children[index];
          part.matrix.copy(visual.gearFreeze[index - 1]).premultiply(this.reactionMatrices.get(visual.role)![stage - 1]);
          part.matrixWorldNeedsUpdate = true;
        }
      }
      if (stage === 2 && this.families[visual.role].deathAssembly)
        (visual.group.children[1] as THREE.Mesh).geometry = this.families[visual.role].deathAssembly!.helmet;
      visual.group.visible = pose.bodyVisible;
      visual.bodyTint.gray.value = visual.gearTint.gray.value = pose.gray;
      visual.bodyMaterial.transparent = visual.gearMaterial.transparent = pose.bodyOpacity < 1;
      visual.bodyMaterial.opacity = visual.gearMaterial.opacity = pose.bodyOpacity;
      if (pose.bodyVisible) {
        this.deathBatches.submit(visual.group, pose.gray, pose.breakup, pose.bodyOpacity, deathVariant(visual.id));
      }
    }
    this.deathBatches.finish();
  }

  private sameParts(a: CharacterParts, b: CharacterParts): boolean {
    return a.body === b.body && a.helmet === b.helmet && a.vest === b.vest;
  }

  private createBody(batch: CrowdBatch, frame: number, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(batch.family.runFrames[frame].geometry,
      batch.family.body.material, capacity);
    mesh.name = `toy-soldier-run-${frame}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private createTier(batch: CrowdBatch, tier: number, capacity: number, vest = false): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(vest ? batch.family.vest.geometry : batch.family.helmet.geometry,
      batch.helmetMaterial, capacity);
    mesh.name = `${tier}-toy-soldier-${vest ? 'vest' : 'helmet'}`;
    // An explicitly hidden secondary source retains the legacy resource slot
    // while contributing no live draw (the simplified Grunt has no waistband).
    mesh.visible = !vest || batch.family.vest.visible;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private growBody(batch: CrowdBatch, frame: number, required: number): void {
    while (batch.bodyCapacity[frame] < required) batch.bodyCapacity[frame] *= 2;
    this.scene.remove(batch.bodyMeshes[frame]);
    batch.bodyMeshes[frame].dispose();
    batch.bodyMeshes[frame] = this.createBody(batch, frame, batch.bodyCapacity[frame]);
    this.scene.add(batch.bodyMeshes[frame]);
  }

  private growTier(batch: CrowdBatch, tier: number, required: number): void {
    while (batch.capacity[tier] < required) batch.capacity[tier] *= 2;
    this.scene.remove(batch.helmetMeshes[tier]);
    batch.helmetMeshes[tier].dispose();
    batch.helmetMeshes[tier] = this.createTier(batch, tier, batch.capacity[tier]);
    this.scene.add(batch.helmetMeshes[tier]);
    this.scene.remove(batch.vestMeshes[tier]);
    batch.vestMeshes[tier].dispose();
    batch.vestMeshes[tier] = this.createTier(batch, tier, batch.capacity[tier], true);
    this.scene.add(batch.vestMeshes[tier]);
  }
}
