import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const DEATH_MS = 360;
const MAX_DEATH_VISUALS = 48;
export const ENEMY_VISUAL_SCALE = 0.78;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  group: THREE.Group;
  helmet: THREE.Mesh;
  startedAtMs: number;
  startZ: number;
}

export function enemyWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * 0.019 + id * 2.399963229728653);
  return { leftArm: stride * 0.28, rightArm: -stride * 0.28,
    leftLeg: -stride * 0.28, rightLeg: stride * 0.28,
    bob: Math.abs(stride) * 0.045 };
}

export class EnemyRenderer {
  private readonly helmetMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterials: THREE.MeshStandardMaterial[];
  private readonly helmetColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashColor = new THREE.Color('#ffe36e');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly deathBurst: DeathBurst;
  private readonly capacity = PALETTES.map(() => 1);
  private bodyCapacity = 1;
  private bodyMesh: THREE.InstancedMesh;
  private readonly helmetMeshes: THREE.InstancedMesh[];

  constructor(private readonly scene: THREE.Scene,
    private readonly bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Samurai helmet needs a standard material');
    this.helmetMaterial = source.clone();
    this.helmetMaterial.color.set('white');
    this.deathMaterials = ENEMY_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.bodyMesh = this.createBody(1);
    this.helmetMeshes = PALETTES.map((palette) => this.createTier(palette, 1));
    this.scene.add(this.bodyMesh, ...this.helmetMeshes);
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
    if (enemies.length > this.bodyCapacity) this.growBody(enemies.length);
    this.bodyMesh.count = enemies.length;
    for (const palette of PALETTES) {
      if (counts[palette] > this.capacity[palette]) this.growTier(palette, counts[palette]);
      this.helmetMeshes[palette].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    for (let bodyIndex = 0; bodyIndex < enemies.length; bodyIndex++) {
      const enemy = enemies[bodyIndex];
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const pose = enemyWalkPose(enemy.id, nowMs);
      const transform = this.transform;
      transform.position.set(-enemy.x, pose.bob, enemy.z);
      transform.rotation.set(-0.10 + pose.leftLeg * 0.05, Math.PI, pose.leftArm * 0.08);
      transform.scale.setScalar(ENEMY_VISUAL_SCALE);
      transform.updateMatrix();
      this.bodyMesh.setMatrixAt(bodyIndex, transform.matrix);
      const helmet = this.helmetMeshes[palette];
      helmet.setMatrixAt(index, transform.matrix);
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      helmet.setColorAt(index, flashing ? this.flashColor : this.helmetColors[palette]);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    for (const palette of PALETTES) {
      this.helmetMeshes[palette].instanceMatrix.needsUpdate = true;
      if (this.helmetMeshes[palette].instanceColor) this.helmetMeshes[palette].instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
    this.deathBurst.reset();
  }

  dispose(): void {
    for (const mesh of [this.bodyMesh, ...this.helmetMeshes]) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.deathBurst.dispose();
    this.helmetMaterial.dispose();
    for (const material of this.deathMaterials) material.dispose();
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    this.deathBurst.spawn(enemy, nowMs);
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.bodyModel.geometry, this.bodyModel.material);
      const helmet = new THREE.Mesh(this.helmetModel.geometry, this.deathMaterials[0]);
      group.add(body, helmet);
      this.scene.add(group);
      visual = { group, helmet, startedAtMs: nowMs, startZ: enemy.z };
      this.deathVisuals.push(visual);
    }
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    visual.startZ = enemy.z;
    visual.helmet.material = this.deathMaterials[paletteIndex(enemy.tier, PALETTES.length)];
    visual.group.visible = true;
    visual.group.scale.set(ENEMY_VISUAL_SCALE * 1.15,
      ENEMY_VISUAL_SCALE * .8, ENEMY_VISUAL_SCALE * 1.15);
    visual.group.position.set(-enemy.x, 0, enemy.z);
    visual.group.rotation.set(0, Math.PI, 0);
  }

  private updateDeaths(nowMs: number): void {
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      if (elapsed >= DEATH_MS) { visual.group.visible = false; continue; }
      const progress = Math.max(0, elapsed / DEATH_MS);
      visual.group.scale.setScalar(ENEMY_VISUAL_SCALE
        * (1 + 0.2 * Math.sin(Math.PI * progress)) * (1 - 0.45 * progress));
      visual.group.rotation.z = Math.PI * 0.8 * progress;
      visual.group.position.y = Math.sin(Math.PI * progress) * 0.3;
      visual.group.position.z = visual.startZ + progress * 0.35;
    }
  }

  private createBody(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.bodyModel.geometry, this.bodyModel.material, capacity);
    mesh.name = 'samurai-body';
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private createTier(tier: number, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.helmetModel.geometry, this.helmetMaterial, capacity);
    mesh.name = `${tier}-samurai-helmet`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private growBody(required: number): void {
    while (this.bodyCapacity < required) this.bodyCapacity *= 2;
    this.scene.remove(this.bodyMesh);
    this.bodyMesh.dispose();
    this.bodyMesh = this.createBody(this.bodyCapacity);
    this.scene.add(this.bodyMesh);
  }

  private growTier(tier: number, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    this.scene.remove(this.helmetMeshes[tier]);
    this.helmetMeshes[tier].dispose();
    this.helmetMeshes[tier] = this.createTier(tier, this.capacity[tier]);
    this.scene.add(this.helmetMeshes[tier]);
  }
}
