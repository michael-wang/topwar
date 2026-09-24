import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

const HIT_FLASH_MS = 80;
const DEATH_MS = 450;
const MAX_DEATH_VISUALS = 48;

interface DeathVisual {
  group: THREE.Group;
  startedAtMs: number;
  startZ: number;
}

export class EnemyRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly gruntBodyMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly gruntHeadMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly bruteBodyMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
  private readonly bruteHeadMaterial = new THREE.MeshStandardMaterial({ color: 'white' });
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
  private gruntBody: THREE.InstancedMesh;
  private gruntHead: THREE.InstancedMesh;
  private bruteBody: THREE.InstancedMesh;
  private bruteHead: THREE.InstancedMesh;
  private gruntCapacity = 1;
  private bruteCapacity = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.gruntBody = this.createMesh(this.bodyGeometry, this.gruntBodyMaterial, this.gruntCapacity);
    this.gruntHead = this.createMesh(this.headGeometry, this.gruntHeadMaterial, this.gruntCapacity);
    this.bruteBody = this.createMesh(this.bodyGeometry, this.bruteBodyMaterial, this.bruteCapacity);
    this.bruteHead = this.createMesh(this.headGeometry, this.bruteHeadMaterial, this.bruteCapacity);
    this.scene.add(this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead);
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
    if (gruntCount > this.gruntCapacity) this.growGrunts(gruntCount);
    if (bruteCount > this.bruteCapacity) this.growBrutes(bruteCount);
    this.gruntBody.count = this.gruntHead.count = gruntCount;
    this.bruteBody.count = this.bruteHead.count = bruteCount;
    let gruntIndex = 0;
    let bruteIndex = 0;
    for (const enemy of enemies) {
      const isBrute = enemy.type === 'brute';
      const index = isBrute ? bruteIndex++ : gruntIndex++;
      const body = isBrute ? this.bruteBody : this.gruntBody;
      const head = isBrute ? this.bruteHead : this.gruntHead;
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      body.setColorAt(index, flashing ? this.flashBodyColor
        : isBrute ? this.bruteBodyColor : this.gruntBodyColor);
      head.setColorAt(index, flashing ? this.flashHeadColor
        : isBrute ? this.bruteHeadColor : this.gruntHeadColor);
      const scale = isBrute ? 1.9 : 1;
      this.transform.scale.setScalar(scale);
      // Match the squad's visual X flip for the camera that looks along +Z.
      this.transform.position.set(-enemy.x, 0.32 * scale, enemy.z);
      this.transform.updateMatrix();
      body.setMatrixAt(index, this.transform.matrix);
      this.transform.position.y = 0.75 * scale;
      this.transform.updateMatrix();
      head.setMatrixAt(index, this.transform.matrix);
    }
    for (const mesh of [this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  reset(): void {
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const visual of this.deathVisuals) visual.group.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead);
    for (const visual of this.deathVisuals) this.scene.remove(visual.group);
    this.deathVisuals.length = 0;
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    for (const mesh of [this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead]) mesh.dispose();
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.gruntBodyMaterial.dispose();
    this.gruntHeadMaterial.dispose();
    this.bruteBodyMaterial.dispose();
    this.bruteHeadMaterial.dispose();
    this.deathBodyMaterial.dispose();
    this.deathHeadMaterial.dispose();
  }

  private spawnDeath(enemy: EnemyRenderState, nowMs: number): void {
    let visual = this.deathVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.deathVisuals.length < MAX_DEATH_VISUALS) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.bodyGeometry, this.deathBodyMaterial);
      body.position.y = 0.32;
      const head = new THREE.Mesh(this.headGeometry, this.deathHeadMaterial);
      head.position.y = 0.75;
      group.add(body, head);
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

  private createMesh(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private growGrunts(required: number): void {
    while (this.gruntCapacity < required) this.gruntCapacity *= 2;
    this.scene.remove(this.gruntBody, this.gruntHead);
    this.gruntBody.dispose();
    this.gruntHead.dispose();
    this.gruntBody = this.createMesh(this.bodyGeometry, this.gruntBodyMaterial, this.gruntCapacity);
    this.gruntHead = this.createMesh(this.headGeometry, this.gruntHeadMaterial, this.gruntCapacity);
    this.scene.add(this.gruntBody, this.gruntHead);
  }

  private growBrutes(required: number): void {
    while (this.bruteCapacity < required) this.bruteCapacity *= 2;
    this.scene.remove(this.bruteBody, this.bruteHead);
    this.bruteBody.dispose();
    this.bruteHead.dispose();
    this.bruteBody = this.createMesh(this.bodyGeometry, this.bruteBodyMaterial, this.bruteCapacity);
    this.bruteHead = this.createMesh(this.headGeometry, this.bruteHeadMaterial, this.bruteCapacity);
    this.scene.add(this.bruteBody, this.bruteHead);
  }
}
