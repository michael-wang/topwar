import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const DEATH_MS = 360;
const MAX_DEATH_VISUALS = 48;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  group: THREE.Group;
  armor: THREE.Mesh;
  startedAtMs: number;
  startZ: number;
}

export function enemyWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * 0.019 + id * 2.399963229728653);
  return { leftArm: stride * 0.35, rightArm: -stride * 0.35,
    leftLeg: -stride * 0.35, rightLeg: stride * 0.35,
    bob: Math.abs(stride) * 0.075 };
}

export class EnemyRenderer {
  private readonly armorMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterials: THREE.MeshStandardMaterial[];
  private readonly armorColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashColor = new THREE.Color('#ffe36e');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly deathBurst: DeathBurst;
  private readonly capacity = PALETTES.map(() => 1);
  private readonly bodyMeshes: THREE.InstancedMesh[];
  private readonly armorMeshes: THREE.InstancedMesh[];

  constructor(private readonly scene: THREE.Scene,
    private readonly bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly armorModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = armorModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Samurai armor needs a standard material');
    this.armorMaterial = source.clone();
    this.armorMaterial.color.set('white');
    this.deathMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.bodyMeshes = PALETTES.map((palette) => this.createTier(palette, 1, 'body'));
    this.armorMeshes = PALETTES.map((palette) => this.createTier(palette, 1, 'armor'));
    for (const palette of PALETTES) this.scene.add(this.bodyMeshes[palette], this.armorMeshes[palette]);
    this.deathBurst = new DeathBurst(scene);
  }

  update(enemies: readonly EnemyRenderState[], nowMs = performance.now()): void {
    const currentIds = new Set(enemies.map((enemy) => enemy.id));
    for (const previous of this.previousEnemies.values()) {
      if (!currentIds.has(previous.id)) {
        this.spawnDeath(previous, nowMs);
        this.flashUntilMs.delete(previous.id);
      }
    }
    for (const enemy of enemies) {
      const previous = this.previousEnemies.get(enemy.id);
      if (previous && enemy.hp < previous.hp) this.flashUntilMs.set(enemy.id, nowMs + HIT_FLASH_MS);
      this.previousEnemies.set(enemy.id, { ...enemy });
    }
    for (const id of this.previousEnemies.keys()) if (!currentIds.has(id)) this.previousEnemies.delete(id);
    this.updateDeaths(nowMs);
    this.deathBurst.update(nowMs);

    const counts = PALETTES.map(() => 0);
    for (const enemy of enemies) counts[paletteIndex(enemy.tier, PALETTES.length)]++;
    for (const palette of PALETTES) {
      if (counts[palette] > this.capacity[palette]) this.grow(palette, counts[palette]);
      this.bodyMeshes[palette].count = counts[palette];
      this.armorMeshes[palette].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    for (const enemy of enemies) {
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const pose = enemyWalkPose(enemy.id, nowMs);
      const transform = this.transform;
      transform.position.set(-enemy.x, pose.bob, enemy.z);
      transform.rotation.set(-0.12 + pose.leftLeg * 0.06, 0, pose.leftArm * 0.12);
      transform.scale.set(1 + pose.bob * 0.05, 1 - pose.bob * 0.08, 1);
      transform.updateMatrix();
      this.bodyMeshes[palette].setMatrixAt(index, transform.matrix);
      const armor = this.armorMeshes[palette];
      armor.setMatrixAt(index, transform.matrix);
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      armor.setColorAt(index, flashing ? this.flashColor : this.armorColors[palette]);
    }
    for (const palette of PALETTES) {
      this.bodyMeshes[palette].instanceMatrix.needsUpdate = true;
      this.armorMeshes[palette].instanceMatrix.needsUpdate = true;
      if (this.armorMeshes[palette].instanceColor) this.armorMeshes[palette].instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
    this.deathBurst.reset();
  }

  dispose(): void {
    for (const mesh of [...this.bodyMeshes, ...this.armorMeshes]) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.deathBurst.dispose();
    this.armorMaterial.dispose();
    for (const material of this.deathMaterials) material.dispose();
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    this.deathBurst.spawn(enemy, nowMs);
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.bodyModel.geometry, this.bodyModel.material);
      const armor = new THREE.Mesh(this.armorModel.geometry, this.deathMaterials[0]);
      group.add(body, armor);
      this.scene.add(group);
      visual = { group, armor, startedAtMs: nowMs, startZ: enemy.z };
      this.deathVisuals.push(visual);
    }
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    visual.startZ = enemy.z;
    visual.armor.material = this.deathMaterials[paletteIndex(enemy.tier, PALETTES.length)];
    visual.group.visible = true;
    visual.group.scale.set(1.2, .8, 1.2);
    visual.group.position.set(-enemy.x, 0, enemy.z);
    visual.group.rotation.set(0, 0, 0);
  }

  private updateDeaths(nowMs: number): void {
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      if (elapsed >= DEATH_MS) { visual.group.visible = false; continue; }
      const progress = Math.max(0, elapsed / DEATH_MS);
      visual.group.scale.setScalar((1 + 0.2 * Math.sin(Math.PI * progress)) * (1 - 0.45 * progress));
      visual.group.rotation.z = Math.PI * 0.8 * progress;
      visual.group.position.y = Math.sin(Math.PI * progress) * 0.3;
      visual.group.position.z = visual.startZ + progress * 0.35;
    }
  }

  private createTier(tier: number, capacity: number, part: 'body' | 'armor'): THREE.InstancedMesh {
    const model = part === 'body' ? this.bodyModel : this.armorModel;
    const material = part === 'body' ? model.material : this.armorMaterial;
    const mesh = new THREE.InstancedMesh(model.geometry, material, capacity);
    mesh.name = `${tier}-samurai-${part}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private grow(tier: number, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    for (const part of ['body', 'armor'] as const) {
      const list = part === 'body' ? this.bodyMeshes : this.armorMeshes;
      this.scene.remove(list[tier]);
      list[tier].dispose();
      list[tier] = this.createTier(tier, this.capacity[tier], part);
      this.scene.add(list[tier]);
    }
  }
}
