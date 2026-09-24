import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const DEATH_MS = 450;
const MAX_DEATH_VISUALS = 48;
const IMPACT_MS = 90;
const PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);
type Part = typeof PARTS[number];
type TierMeshes = Record<Part, THREE.InstancedMesh>;

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
  private readonly torsoGeometry = new THREE.BoxGeometry(0.31, 0.43, 0.23);
  private readonly headGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  private readonly armGeometry = new THREE.BoxGeometry(0.10, 0.34, 0.11);
  private readonly legGeometry = new THREE.BoxGeometry(0.12, 0.34, 0.13);
  private readonly material = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly deathBodyMaterial = new THREE.MeshStandardMaterial({ color: '#777b7c' });
  private readonly deathHeadMaterial = new THREE.MeshStandardMaterial({ color: '#a3a5a3' });
  private readonly bodyColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly headColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.head));
  private readonly flashBodyColor = new THREE.Color('#ffe36e');
  private readonly flashHeadColor = new THREE.Color('#fff8d6');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly deathBurst: DeathBurst;
  private readonly capacity = PALETTES.map(() => 1);
  private readonly meshes: TierMeshes[];

  constructor(private readonly scene: THREE.Scene) {
    this.meshes = PALETTES.map((palette) => this.createTier(palette, 1));
    for (const palette of PALETTES) this.scene.add(...Object.values(this.meshes[palette]));
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
      for (const part of PARTS) this.meshes[palette][part].count = counts[palette];
    }
    const indices = PALETTES.map(() => 0);
    for (const enemy of enemies) {
      const palette = paletteIndex(enemy.tier, PALETTES.length);
      const index = indices[palette]++;
      const meshes = this.meshes[palette];
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      const bodyColor = flashing ? this.flashBodyColor : this.bodyColors[palette];
      const headColor = flashing ? this.flashHeadColor : this.headColors[palette];
      const pose = enemyWalkPose(enemy.id, nowMs);
      for (const part of PARTS) {
        const mesh = meshes[part];
        mesh.setColorAt(index, part === 'head' ? headColor : bodyColor);
        this.setPartMatrix(mesh, index, part, enemy, pose);
      }
    }
    for (const tier of PALETTES) {
      for (const part of PARTS) {
        const mesh = this.meshes[tier][part];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
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
      for (const mesh of Object.values(this.meshes[tier])) {
        this.scene.remove(mesh);
        mesh.dispose();
      }
    }
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.deathBurst.dispose();
    for (const geometry of [this.torsoGeometry, this.headGeometry, this.armGeometry, this.legGeometry]) geometry.dispose();
    for (const material of [this.material, this.deathBodyMaterial, this.deathHeadMaterial]) material.dispose();
  }

  private setPartMatrix(mesh: THREE.InstancedMesh, index: number, part: Part,
    enemy: EnemyRenderState, pose: ReturnType<typeof enemyWalkPose>): void {
    const transform = this.transform;
    transform.scale.setScalar(1);
    transform.rotation.set(0, 0, 0);
    const x = -enemy.x;
    const y = pose.bob;
    const z = enemy.z;
    switch (part) {
      case 'torso': transform.position.set(x, 0.53 + y, z); break;
      case 'head': transform.position.set(x, 0.90 + y, z - 0.065); break;
      case 'leftArm': transform.position.set(x - 0.23, 0.51 + y, z);
        transform.rotation.x = pose.leftArm; break;
      case 'rightArm': transform.position.set(x + 0.23, 0.51 + y, z);
        transform.rotation.x = pose.rightArm; break;
      case 'leftLeg': transform.position.set(x - 0.10, 0.17 + y, z);
        transform.rotation.x = pose.leftLeg; break;
      case 'rightLeg': transform.position.set(x + 0.10, 0.17 + y, z);
        transform.rotation.x = pose.rightLeg; break;
    }
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    this.deathBurst.spawn(enemy, nowMs);
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      for (const part of PARTS) {
        const mesh = new THREE.Mesh(this.geometryFor(part),
          part === 'head' ? this.deathHeadMaterial : this.deathBodyMaterial);
        switch (part) {
          case 'torso': mesh.position.y = 0.53; break;
          case 'head': mesh.position.set(0, 0.90, -0.065); break;
          case 'leftArm': mesh.position.set(-0.23, 0.51, 0); break;
          case 'rightArm': mesh.position.set(0.23, 0.51, 0); break;
          case 'leftLeg': mesh.position.set(-0.10, 0.17, 0); break;
          case 'rightLeg': mesh.position.set(0.10, 0.17, 0); break;
        }
        group.add(mesh);
      }
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

  private geometryFor(part: Part): THREE.BufferGeometry {
    if (part === 'head') return this.headGeometry;
    if (part === 'torso') return this.torsoGeometry;
    if (part === 'leftArm' || part === 'rightArm') return this.armGeometry;
    return this.legGeometry;
  }

  private createTier(tier: number, capacity: number): TierMeshes {
    const result = {} as TierMeshes;
    for (const part of PARTS) {
      const mesh = new THREE.InstancedMesh(this.geometryFor(part), this.material, capacity);
      mesh.name = `${tier}-${part}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      result[part] = mesh;
    }
    return result;
  }

  private grow(tier: number, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    for (const mesh of Object.values(this.meshes[tier])) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.meshes[tier] = this.createTier(tier, this.capacity[tier]);
    this.scene.add(...Object.values(this.meshes[tier]));
  }
}
