import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import { DeathBurst } from './DeathBurst';
import { ENEMY_PALETTE, paletteIndex } from '../tierPalettes';

const HIT_FLASH_MS = 80;
const DEATH_MS = 320;
const MAX_DEATH_VISUALS = 48;
export const ENEMY_VISUAL_SCALE = 0.82;
const PALETTES = ENEMY_PALETTE.map((_, index) => index);

interface DeathVisual {
  group: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  gearMaterial: THREE.MeshStandardMaterial;
  startedAtMs: number;
}

export function enemyWalkPose(id: number, nowMs: number): { leftArm: number; rightArm: number;
  leftLeg: number; rightLeg: number; bob: number } {
  const stride = Math.sin(nowMs * (Math.PI * 2 / 500) + id * 2.399963229728653);
  return { leftArm: stride * 0.35, rightArm: -stride * 0.35,
    leftLeg: -stride * 0.35, rightLeg: stride * 0.35,
    bob: Math.abs(stride) * 0.038 };
}

export function enemyRunFrame(id: number, nowMs: number): number {
  return Math.floor(nowMs / 125 + id * 1.52788745) & 3;
}

export class EnemyRenderer {
  private readonly helmetMaterial: THREE.MeshStandardMaterial;
  private readonly grayBodyMaterial: THREE.MeshStandardMaterial;
  private readonly helmetColors = ENEMY_PALETTE.map((entry) => new THREE.Color(entry.body));
  private readonly flashColor = new THREE.Color('#ffe36e');
  private readonly transform = new THREE.Object3D();
  private readonly previousEnemies = new Map<number, EnemyRenderState>();
  private readonly flashUntilMs = new Map<number, number>();
  private readonly deathVisuals: DeathVisual[] = [];
  private readonly deathBurst: DeathBurst;
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
    this.grayBodyMaterial = grayBodyModel.material;
    this.helmetMaterial = source.clone();
    this.helmetMaterial.color.set('white');
    this.bodyMeshes = runFrames.map((_, frame) => this.createBody(frame, 1));
    this.helmetMeshes = PALETTES.map((palette) => this.createTier(palette, 1));
    this.vestMeshes = PALETTES.map((palette) => this.createTier(palette, 1, true));
    this.scene.add(...this.bodyMeshes, ...this.helmetMeshes, ...this.vestMeshes);
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
    const bodyCounts = [0, 0, 0, 0];
    for (const enemy of enemies) {
      counts[paletteIndex(enemy.tier, PALETTES.length)]++;
      bodyCounts[enemyRunFrame(enemy.id, nowMs)]++;
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
      const pose = enemyWalkPose(enemy.id, nowMs);
      const transform = this.transform;
      transform.position.set(-enemy.x, pose.bob, enemy.z);
      transform.rotation.set(-0.11 + pose.leftLeg * 0.035, Math.PI,
        pose.leftArm * 0.09);
      transform.scale.setScalar(ENEMY_VISUAL_SCALE);
      transform.updateMatrix();
      const frame = enemyRunFrame(enemy.id, nowMs);
      this.bodyMeshes[frame].setMatrixAt(bodyIndices[frame]++, transform.matrix);
      const helmet = this.helmetMeshes[palette];
      helmet.setMatrixAt(index, transform.matrix);
      const vest = this.vestMeshes[palette];
      vest.setMatrixAt(index, transform.matrix);
      const flashing = (this.flashUntilMs.get(enemy.id) ?? 0) > nowMs;
      if (!flashing) this.flashUntilMs.delete(enemy.id);
      helmet.setColorAt(index, flashing ? this.flashColor : this.helmetColors[palette]);
      vest.setColorAt(index, flashing ? this.flashColor : this.helmetColors[palette]);
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
    for (const visual of this.deathVisuals) visual.group.visible = false;
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
    this.previousEnemies.clear();
    this.flashUntilMs.clear();
    this.deathBurst.dispose();
    this.helmetMaterial.dispose();
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
      visual = { group, bodyMaterial, gearMaterial, startedAtMs: nowMs };
      this.deathVisuals.push(visual);
    }
    if (!visual) visual = this.deathVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.startedAtMs = nowMs;
    visual.bodyMaterial.opacity = 1;
    visual.gearMaterial.opacity = 1;
    visual.gearMaterial.color.set('#fff1a0');
    visual.group.visible = true;
    visual.group.scale.setScalar(ENEMY_VISUAL_SCALE * 1.07);
    visual.group.position.set(-enemy.x, 0, enemy.z);
    visual.group.rotation.set(0, Math.PI, 0);
  }

  private updateDeaths(nowMs: number): void {
    for (const visual of this.deathVisuals) {
      if (!visual.group.visible) continue;
      const elapsed = nowMs - visual.startedAtMs;
      if (elapsed >= DEATH_MS) { visual.group.visible = false; continue; }
      const progress = Math.max(0, elapsed / DEATH_MS);
      visual.gearMaterial.color.set(elapsed < 35 ? '#fff1a0' : '#adb4b8');
      const opacity = Math.min(1, (1 - progress) / .78);
      visual.bodyMaterial.opacity = opacity;
      visual.gearMaterial.opacity = opacity;
      visual.group.scale.setScalar(ENEMY_VISUAL_SCALE * (1.07 - .10 * progress));
      visual.group.position.y = progress * .55;
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
