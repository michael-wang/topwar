import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

const HIT_FLASH_MS = 80;
const DEATH_MS = 450;
const MAX_DEATH_VISUALS = 48;
const PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
type Part = typeof PARTS[number];
type Tier = EnemyRenderState['type'];
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
  private readonly gruntMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly bruteMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly deathBodyMaterial = new THREE.MeshStandardMaterial({ color: '#777b7c' });
  private readonly deathHeadMaterial = new THREE.MeshStandardMaterial({ color: '#a3a5a3' });
  private readonly gruntBodyColor = new THREE.Color('#c93332');
  private readonly gruntHeadColor = new THREE.Color('#f15a4c');
  private readonly bruteBodyColor = new THREE.Color('#761a22');
  private readonly bruteHeadColor = new THREE.Color('#ab3034');
  private readonly flashBodyColor = new THREE.Color('#ffe36e');
  private readonly flashHeadColor = new THREE.Color('#fff8d6');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly capacity: Record<Tier, number> = { grunt: 1, brute: 1 };
  private readonly meshes: Record<Tier, TierMeshes>;

  constructor(private readonly scene: THREE.Scene) {
    this.meshes = { grunt: this.createTier('grunt', 1), brute: this.createTier('brute', 1) };
    this.scene.add(...Object.values(this.meshes.grunt), ...Object.values(this.meshes.brute));
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

    let gruntCount = 0;
    for (const enemy of enemies) if (enemy.type === 'grunt') gruntCount++;
    const bruteCount = enemies.length - gruntCount;
    if (gruntCount > this.capacity.grunt) this.grow('grunt', gruntCount);
    if (bruteCount > this.capacity.brute) this.grow('brute', bruteCount);
    for (const part of PARTS) {
      this.meshes.grunt[part].count = gruntCount;
      this.meshes.brute[part].count = bruteCount;
    }
    let gruntIndex = 0;
    let bruteIndex = 0;
    for (const enemy of enemies) {
      const isBrute = enemy.type === 'brute';
      const index = isBrute ? bruteIndex++ : gruntIndex++;
      const meshes = this.meshes[enemy.type];
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      const bodyColor = flashing ? this.flashBodyColor : isBrute ? this.bruteBodyColor : this.gruntBodyColor;
      const headColor = flashing ? this.flashHeadColor : isBrute ? this.bruteHeadColor : this.gruntHeadColor;
      const pose = enemyWalkPose(enemy.id, nowMs);
      const scale = isBrute ? 1.9 : 1;
      for (const part of PARTS) {
        const mesh = meshes[part];
        mesh.setColorAt(index, part === 'head' ? headColor : bodyColor);
        this.setPartMatrix(mesh, index, part, enemy, pose, scale);
      }
    }
    for (const tier of ['grunt', 'brute'] as const) {
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
  }

  dispose(): void {
    for (const tier of ['grunt', 'brute'] as const) {
      for (const mesh of Object.values(this.meshes[tier])) {
        this.scene.remove(mesh);
        mesh.dispose();
      }
    }
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const geometry of [this.torsoGeometry, this.headGeometry, this.armGeometry, this.legGeometry]) geometry.dispose();
    for (const material of [this.gruntMaterial, this.bruteMaterial,
      this.deathBodyMaterial, this.deathHeadMaterial]) material.dispose();
  }

  private setPartMatrix(mesh: THREE.InstancedMesh, index: number, part: Part,
    enemy: EnemyRenderState, pose: ReturnType<typeof enemyWalkPose>, scale: number): void {
    const transform = this.transform;
    transform.scale.setScalar(scale);
    transform.rotation.set(0, 0, 0);
    const x = -enemy.x;
    const y = pose.bob;
    const z = enemy.z;
    switch (part) {
      case 'torso': transform.position.set(x, (0.53 + y) * scale, z); break;
      case 'head': transform.position.set(x, (0.90 + y) * scale, z - 0.065 * scale); break;
      case 'leftArm': transform.position.set(x - 0.23 * scale, (0.51 + y) * scale, z);
        transform.rotation.x = pose.leftArm; break;
      case 'rightArm': transform.position.set(x + 0.23 * scale, (0.51 + y) * scale, z);
        transform.rotation.x = pose.rightArm; break;
      case 'leftLeg': transform.position.set(x - 0.10 * scale, (0.17 + y) * scale, z);
        transform.rotation.x = pose.leftLeg; break;
      case 'rightLeg': transform.position.set(x + 0.10 * scale, (0.17 + y) * scale, z);
        transform.rotation.x = pose.rightLeg; break;
    }
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
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
    visual.group.scale.setScalar(enemy.type === 'brute' ? 1.9 : 1);
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

  private createTier(tier: Tier, capacity: number): TierMeshes {
    const material = tier === 'grunt' ? this.gruntMaterial : this.bruteMaterial;
    const result = {} as TierMeshes;
    for (const part of PARTS) {
      const mesh = new THREE.InstancedMesh(this.geometryFor(part), material, capacity);
      mesh.name = `${tier}-${part}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      result[part] = mesh;
    }
    return result;
  }

  private grow(tier: Tier, required: number): void {
    while (this.capacity[tier] < required) this.capacity[tier] *= 2;
    for (const mesh of Object.values(this.meshes[tier])) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.meshes[tier] = this.createTier(tier, this.capacity[tier]);
    this.scene.add(...Object.values(this.meshes[tier]));
  }
}
