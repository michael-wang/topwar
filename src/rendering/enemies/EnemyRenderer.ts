import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';
import type { PresentationEvent } from '../../simulation/PresentationEvent';
import { ENEMY_DEATH_MS, ENEMY_DEATH_POP, enemyDeathPose } from '../../presentation/EnemyDeathTiming';

const HIT_FLASH_MS = 80;
const MAX_DEATH_VISUALS = 48;
export const ENEMY_CONTACT_MS = 240;
const MAX_CONTACT_VISUALS = 48;
const CONTACT_FLASH_MS = 150;
export const ENEMY_VISUAL_SCALE = 0.82;
export const ENEMY_GAIT_CYCLE_MS = 360;
export const HEAVY_GAIT_CYCLE_MS = 650;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  scale: THREE.Vector3;
  group: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  gearMaterial: THREE.MeshStandardMaterial;
  startedAtMs: number;
}

interface ContactVisual {
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

function setEnemyScale(target: THREE.Vector3, enemy?: EnemyRenderState): void {
  const base = enemy?.visualScale ?? ENEMY_VISUAL_SCALE;
  target.set(enemy?.visualScaleX ?? base, enemy?.visualScaleY ?? base, enemy?.visualScaleZ ?? base);
}

export class EnemyRenderer {
  getDebugStats(): { current: number; bodyCapacities: number[]; tierCapacities: number[];
    deathVisuals: number; contactVisuals: number } {
    return { current: this.previousEnemies.size, bodyCapacities: [...this.bodyCapacity],
      tierCapacities: [...this.capacity], deathVisuals: this.deathVisuals.length,
      contactVisuals: this.contactVisuals.length };
  }
  private readonly modelTop: number;
  private readonly helmetMaterial: THREE.MeshStandardMaterial;
  private readonly grayBodyMaterial: THREE.MeshStandardMaterial;
  private readonly helmetColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashColor = new THREE.Color('#ffe36e');
  private readonly heavyColor = new THREE.Color('#e7ad43');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly contactVisuals: ContactVisual[] = [];
  private readonly contactIds = new Set<number>();
  private readonly contactFlashMaterial = new THREE.MeshBasicMaterial({
    color: '#fff47d', toneMapped: false });
  private readonly deathBurst: DeathBurst;
  private readonly healthBars: { backing: THREE.Sprite; fill: THREE.Sprite }[] = [];
  private readonly barBackingMaterial = new THREE.SpriteMaterial({ color: '#171c20', depthTest: false, toneMapped: false });
  private readonly barFillMaterial = new THREE.SpriteMaterial({ color: '#ffd35c', depthTest: false, toneMapped: false });
  private readonly capacity = PALETTES.map(() => 1);
  private readonly bodyCapacity = [1, 1, 1, 1];
  private readonly bodyMeshes: THREE.InstancedMesh[];
  private readonly helmetMeshes: THREE.InstancedMesh[];
  private readonly vestMeshes: THREE.InstancedMesh[];

  constructor(private readonly scene: THREE.Scene,
    private readonly bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly runFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[],
    private readonly grayBodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    if (runFrames.length !== 4) throw new Error('Toy soldier run requires four baked poses');
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    if (!(grayBodyModel.material instanceof THREE.MeshStandardMaterial)) {
      throw new Error('Gray death body needs a standard material');
    }
    this.modelTop = Math.max(...[helmetModel, ...runFrames].map(model => {
      model.geometry.computeBoundingBox();
      return model.geometry.boundingBox!.max.y;
    }));
    this.grayBodyMaterial = grayBodyModel.material;
    this.helmetMaterial = source.clone();
    this.helmetMaterial.color.set('white');
    this.bodyMeshes = runFrames.map((_, frame) => this.createBody(frame, 1));
    this.helmetMeshes = PALETTES.map((palette) => this.createTier(palette, 1));
    this.vestMeshes = PALETTES.map((palette) => this.createTier(palette, 1, true));
    this.scene.add(...this.bodyMeshes, ...this.helmetMeshes, ...this.vestMeshes);
    this.deathBurst = new DeathBurst(scene);
  }

  present(events: readonly PresentationEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.kind !== 'normalEnemyContact') continue;
      this.contactIds.add(event.enemyId);
      this.spawnContact(event.enemyTier, event.attackerX, event.attackerZ,
        event.enemyId, nowMs);
    }
  }

  update(enemies: readonly EnemyRenderState[], nowMs = performance.now()): void {
    const currentIds = new Set(enemies.map((enemy) => enemy.id));
    for (const previous of this.previousEnemies.values()) {
      if (!currentIds.has(previous.id)) {
        if (!this.contactIds.has(previous.id)) this.spawnDeath(previous, nowMs);
        this.flashUntilMs.delete(previous.id);
      }
    }
    for (const enemy of enemies) {
      const previous = this.previousEnemies.get(enemy.id);
      if (previous && enemy.hp < previous.hp) this.flashUntilMs.set(enemy.id, nowMs + HIT_FLASH_MS);
      this.previousEnemies.set(enemy.id, { ...enemy });
    }
    for (const id of this.previousEnemies.keys()) if (!currentIds.has(id)) this.previousEnemies.delete(id);
    this.contactIds.clear();
    this.updateDeaths(nowMs);
    this.updateContacts(nowMs);
    this.deathBurst.update(nowMs);

    let barIndex = 0;
    for (const enemy of enemies) {
      if (enemy.archetype !== 'heavy' || enemy.maxHp === undefined) continue;
      let bar = this.healthBars[barIndex++];
      if (!bar) {
        bar = { backing: new THREE.Sprite(this.barBackingMaterial), fill: new THREE.Sprite(this.barFillMaterial) };
        bar.backing.name = 'heavy-hp-backing';
        bar.fill.name = 'heavy-hp-fill';
        bar.backing.renderOrder = 10;
        bar.fill.renderOrder = 11;
        this.scene.add(bar.backing, bar.fill);
        this.healthBars.push(bar);
      }
      const fraction = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      const width = 1.1;
      const y = (enemy.visualScaleY ?? enemy.visualScale ?? ENEMY_VISUAL_SCALE) * this.modelTop + .3;
      bar.backing.visible = true;
      bar.fill.visible = fraction > 0;
      bar.backing.position.set(-enemy.x, y, enemy.z);
      bar.backing.scale.set(width + .08, .18, 1);
      bar.fill.position.set(-enemy.x + width * (1 - fraction) / 2, y, enemy.z);
      bar.fill.scale.set(width * fraction, .11, 1);
    }
    for (; barIndex < this.healthBars.length; barIndex++) {
      this.healthBars[barIndex].backing.visible = false;
      this.healthBars[barIndex].fill.visible = false;
    }
    const counts = PALETTES.map(() => 0);
    const bodyCounts = [0, 0, 0, 0];
    for (const enemy of enemies) {
      counts[paletteIndex(enemy.tier, PALETTES.length)]++;
      bodyCounts[enemyRunFrame(enemy.id, nowMs, enemy.archetype === 'heavy' ? HEAVY_GAIT_CYCLE_MS : ENEMY_GAIT_CYCLE_MS)]++;
    }
    for (let frame = 0; frame < 4; frame++) {
      if (bodyCounts[frame] > this.bodyCapacity[frame]) this.growBody(frame, bodyCounts[frame]);
      this.bodyMeshes[frame].count = bodyCounts[frame];
    }
    for (const palette of PALETTES) {
      if (counts[palette] > this.capacity[palette]) this.growTier(palette, counts[palette]);
      this.helmetMeshes[palette].count = counts[palette];
      this.vestMeshes[palette].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    const bodyIndices = [0, 0, 0, 0];
    for (let bodyIndex = 0; bodyIndex < enemies.length; bodyIndex++) {
      const enemy = enemies[bodyIndex];
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const pose = enemyWalkPose(enemy.id, nowMs, enemy.archetype === 'heavy' ? HEAVY_GAIT_CYCLE_MS : ENEMY_GAIT_CYCLE_MS);
      const transform = this.transform;
      transform.position.set(-enemy.x, pose.bob, enemy.z);
      transform.rotation.set(-0.15 + pose.leftLeg * 0.035, Math.PI,
        pose.leftArm * 0.09);
      setEnemyScale(transform.scale, enemy);
      transform.updateMatrix();
      const frame = enemyRunFrame(enemy.id, nowMs, enemy.archetype === 'heavy' ? HEAVY_GAIT_CYCLE_MS : ENEMY_GAIT_CYCLE_MS);
      this.bodyMeshes[frame].setMatrixAt(bodyIndices[frame]++, transform.matrix);
      const helmet = this.helmetMeshes[palette];
      helmet.setMatrixAt(index, transform.matrix);
      const vest = this.vestMeshes[palette];
      vest.setMatrixAt(index, transform.matrix);
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      const color = enemy.archetype === 'heavy' ? this.heavyColor : this.helmetColors[palette];
      helmet.setColorAt(index, flashing ? this.flashColor : color);
      vest.setColorAt(index, flashing ? this.flashColor : color);
    }
    for (const mesh of this.bodyMeshes) mesh.instanceMatrix.needsUpdate = true;
    for (const palette of PALETTES) {
      this.helmetMeshes[palette].instanceMatrix.needsUpdate = true;
      if (this.helmetMeshes[palette].instanceColor) this.helmetMeshes[palette].instanceColor.needsUpdate = true;
      this.vestMeshes[palette].instanceMatrix.needsUpdate = true;
      if (this.vestMeshes[palette].instanceColor) this.vestMeshes[palette].instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.contactIds.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
    for (const visual of this.contactVisuals) visual.group.visible = false;
    for (const bar of this.healthBars) { bar.backing.visible = false; bar.fill.visible = false; }
    this.deathBurst.reset();
  }

  dispose(): void {
    for (const mesh of [...this.bodyMeshes, ...this.helmetMeshes, ...this.vestMeshes]) {
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
    this.flashUntilMs.clear();
    for (const bar of this.healthBars) this.scene.remove(bar.backing, bar.fill);
    this.healthBars.length = 0;
    this.barBackingMaterial.dispose();
    this.barFillMaterial.dispose();
    this.deathBurst.dispose();
    this.helmetMaterial.dispose();
    this.contactFlashMaterial.dispose();
  }

  private spawnContact(tier: number, x: number, z: number, id: number, nowMs: number): void {
    let visual = this.contactVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.contactVisuals.length < MAX_CONTACT_VISUALS) {
      const models = [this.bodyModel, this.helmetModel, this.vestModel];
      const group = new THREE.Group();
      group.name = 'enemy-contact-exchange';
      const materials = models.map((model) => {
        if (!(model.material instanceof THREE.MeshStandardMaterial)) {
          throw new Error('Enemy contact visuals require standard materials');
        }
        const material = model.material.clone();
        material.transparent = true;
        material.depthWrite = false;
        return material;
      });
      models.forEach((model, index) => group.add(new THREE.Mesh(model.geometry, materials[index])));
      this.scene.add(group);
      visual = { group, materials, startedAtMs: nowMs, x, z, direction: 1, scale: new THREE.Vector3() };
      this.contactVisuals.push(visual);
    }
    if (!visual) visual = this.contactVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    visual.x = x;
    visual.z = z;
    visual.direction = id % 2 === 0 ? -1 : 1;
    setEnemyScale(visual.scale, this.previousEnemies.get(id));
    visual.group.visible = true;
    visual.group.rotation.set(0, Math.PI, 0);
    visual.group.position.set(-x, 0, z);
    visual.group.scale.copy(visual.scale);
    for (const material of visual.materials) material.opacity = 1;
    const color = this.previousEnemies.get(id)?.archetype === 'heavy' ? this.heavyColor
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

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    this.deathBurst.spawn(enemy, nowMs);
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      const bodyMaterial = this.grayBodyMaterial.clone();
      bodyMaterial.transparent = true;
      bodyMaterial.depthWrite = false;
      const gearMaterial = this.helmetMaterial.clone();
      gearMaterial.transparent = true;
      gearMaterial.depthWrite = false;
      const body = new THREE.Mesh(this.grayBodyModel.geometry, bodyMaterial);
      const helmet = new THREE.Mesh(this.helmetModel.geometry, gearMaterial);
      const vest = new THREE.Mesh(this.vestModel.geometry, gearMaterial);
      group.add(body, helmet, vest);
      this.scene.add(group);
      visual = { group, bodyMaterial, gearMaterial, startedAtMs: nowMs, scale: new THREE.Vector3() };
      this.deathVisuals.push(visual);
    }
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    setEnemyScale(visual.scale, enemy);
    visual.bodyMaterial.opacity = 1;
    visual.gearMaterial.opacity = 1;
    visual.gearMaterial.color.set('#fff1a0');
    visual.group.visible = true;
    visual.group.scale.copy(visual.scale).multiplyScalar(enemyDeathPose(0).scale);
    visual.group.position.set(-enemy.x, ENEMY_DEATH_POP, enemy.z);
    visual.group.rotation.set(0, Math.PI, 0);
  }

  private updateDeaths(nowMs: number): void {
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      if (elapsed >= ENEMY_DEATH_MS) { visual.group.visible = false; continue; }
      const { scale, opacity, rise } = enemyDeathPose(elapsed);
      visual.gearMaterial.color.set(elapsed < 35 ? '#fff1a0' : '#adb4b8');
      visual.bodyMaterial.opacity = opacity;
      visual.gearMaterial.opacity = opacity;
      visual.group.scale.copy(visual.scale).multiplyScalar(scale);
      visual.group.position.y = rise;
    }
  }

  private createBody(frame: number, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.runFrames[frame].geometry,
      this.bodyModel.material, capacity);
    mesh.name = `toy-soldier-run-${frame}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private createTier(tier: number, capacity: number, vest = false): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(vest ? this.vestModel.geometry : this.helmetModel.geometry,
      this.helmetMaterial, capacity);
    mesh.name = `${tier}-toy-soldier-${vest ? 'vest' : 'helmet'}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private growBody(frame: number, required: number): void {
    while (this.bodyCapacity[frame] < required) this.bodyCapacity[frame] *= 2;
    this.scene.remove(this.bodyMeshes[frame]);
    this.bodyMeshes[frame].dispose();
    this.bodyMeshes[frame] = this.createBody(frame, this.bodyCapacity[frame]);
    this.scene.add(this.bodyMeshes[frame]);
  }

  private growTier(tier: number, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    this.scene.remove(this.helmetMeshes[tier]);
    this.helmetMeshes[tier].dispose();
    this.helmetMeshes[tier] = this.createTier(tier, this.capacity[tier]);
    this.scene.add(this.helmetMeshes[tier]);
    this.scene.remove(this.vestMeshes[tier]);
    this.vestMeshes[tier].dispose();
    this.vestMeshes[tier] = this.createTier(tier, this.capacity[tier], true);
    this.scene.add(this.vestMeshes[tier]);
  }
}
