import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const DEATH_MS = 450;
const MAX_DEATH_VISUALS = 48;
const IMPACT_MS = 90;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  group: THREE.Group;
  startedAtMs: number;
  startZ: number;
}

export function enemyWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * 0.014 + id * 2.399963229728653);
  return { leftArm: stride * 0.45, rightArm: -stride * 0.45,
    leftLeg: -stride * 0.40, rightLeg: stride * 0.40,
    bob: Math.abs(stride) * 0.02 };
}

export class EnemyRenderer {
  private readonly material: THREE.MeshStandardMaterial;
  private readonly deathMaterial: THREE.MeshStandardMaterial;
  private readonly bodyColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashBodyColor = new THREE.Color('#ffe36e');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly deathBurst: DeathBurst;
  private readonly capacity = PALETTES.map(() => 1);
  private readonly meshes: THREE.InstancedMesh[];

  constructor(private readonly scene: THREE.Scene,
    private readonly model: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = model.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Zombie needs a standard material');
    this.material = source.clone();
    this.material.color.set('white');
    this.deathMaterial = source.clone();
    this.deathMaterial.color.set('#999999');
    this.meshes = PALETTES.map((palette) => this.createTier(palette, 1));
    for (const palette of PALETTES) this.scene.add(this.meshes[palette]);
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
      this.meshes[palette].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    for (const enemy of enemies) {
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const mesh = this.meshes[palette];
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      const bodyColor = flashing ? this.flashBodyColor : this.bodyColors[palette];
      const pose = enemyWalkPose(enemy.id, nowMs);
      mesh.setColorAt(index, bodyColor);
      const transform = this.transform;
      transform.position.set(-enemy.x, pose.bob, enemy.z);
      transform.rotation.set(-0.06 + pose.leftLeg * 0.08, 0, 0);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    }
    for (const tier of PALETTES) {
      const mesh = this.meshes[tier];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
    this.deathBurst.reset();
  }

  dispose(): void {
    for (const tier of PALETTES) {
      this.scene.remove(this.meshes[tier]);
      this.meshes[tier].dispose();
    }
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.deathBurst.dispose();
    this.material.dispose();
    this.deathMaterial.dispose();
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    this.deathBurst.spawn(enemy, nowMs);
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(this.model.geometry, this.deathMaterial));
      this.scene.add(group);
      visual = { group, startedAtMs: nowMs, startZ: enemy.z };
      this.deathVisuals.push(visual);
    }
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    visual.startZ = enemy.z;
    visual.group.visible = true;
    visual.group.scale.setScalar(1.15);
    visual.group.position.set(-enemy.x, 0, enemy.z);
    visual.group.rotation.set(0, 0, 0);
  }

  private updateDeaths(nowMs: number): void {
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      if (elapsed >= DEATH_MS) {
        visual.group.visible = false;
        continue;
      }
      const progress = Math.max(0, elapsed / DEATH_MS);
      visual.group.scale.setScalar(1 + 0.15 * Math.max(0, 1 - elapsed / IMPACT_MS));
      visual.group.rotation.x = Math.PI * progress;
      visual.group.position.y = Math.sin(Math.PI * progress) * 0.35;
      visual.group.position.z = visual.startZ + progress * 0.5;
    }
  }

  private createTier(tier: number, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.model.geometry, this.material, capacity);
    mesh.name = `${tier}-zombie`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private grow(tier: number, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    const mesh = this.meshes[tier];
    this.scene.remove(mesh);
    mesh.dispose();
    this.meshes[tier] = this.createTier(tier, this.capacity[tier]);
    this.scene.add(this.meshes[tier]);
  }
}
