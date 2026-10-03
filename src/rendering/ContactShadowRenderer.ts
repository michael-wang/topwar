import { ART } from '../art/ArtDirection';
import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { SquadRenderer } from './squad/SquadRenderer';
import { BOSS_DEATH_MS } from '../presentation/BossDeathTiming';
import type { CharacterVisualFamilies } from './CharacterVisualFamilies';

type ShadowKind = 'player' | 'enemy' | 'boss' | 'reward';
type ShadowBatch = { mesh: THREE.InstancedMesh; capacity: number };

// A single soft alpha stamp shared by four bounded instanced batches; no shadow maps or lights.
export class ContactShadowRenderer {
  getDebugStats(): Record<ShadowKind, { active: number; capacity: number }> {
    return {
      player: { active: this.batches.player.mesh.count, capacity: this.batches.player.capacity },
      enemy: { active: this.batches.enemy.mesh.count, capacity: this.batches.enemy.capacity },
      boss: { active: this.batches.boss.mesh.count, capacity: this.batches.boss.capacity },
      reward: { active: this.batches.reward.mesh.count, capacity: this.batches.reward.capacity },
    };
  }
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly texture = this.createTexture();
  private readonly material = new THREE.MeshBasicMaterial({
    color: ART.bar.shadow, map: this.texture, transparent: true, opacity: .28,
    depthWrite: false, toneMapped: false,
  });
  private readonly transform = new THREE.Object3D();
  private readonly batches: Record<ShadowKind, ShadowBatch>;
  private playerIndex = 0;
  private lastBoss: { x: number; z: number; visualScale: number } | null = null;
  private bossDeathStartedAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene,
    private readonly threats?: Pick<CharacterVisualFamilies, 'heavy' | 'giant'>) {
    this.geometry.rotateX(-Math.PI / 2);
    this.batches = {
      player: this.createBatch('player', 8),
      enemy: this.createBatch('enemy', 32),
      boss: this.createBatch('boss', 1),
      reward: this.createBatch('reward', 8),
    };
  }

  update(state: GameRenderState, squad: SquadRenderer, nowMs: number): void {
    this.ensureCapacity('player', state.squad.count);
    this.ensureCapacity('enemy', state.enemies.length);
    this.ensureCapacity('reward', state.streamRewards.length);
    this.playerIndex = 0;
    squad.forEachVisibleMemberPosition(position => this.placePlayer(position, squad.presentation.shadow));
    this.batches.player.mesh.count = this.playerIndex;
    this.batches.player.mesh.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < state.enemies.length; index++) {
      const enemy = state.enemies[index];
      const widthScale = (enemy.visualScaleX ?? enemy.visualScale ?? .82) / .82;
      const depthScale = (enemy.visualScaleZ ?? enemy.visualScale ?? .82) / .82;
      const footprint = enemy.archetype === 'heavy' ? this.threats?.heavy.presentation.shadow
        : enemy.archetype === 'giant' ? this.threats?.giant.presentation?.shadow : undefined;
      this.place('enemy', index, -enemy.x, enemy.z,
        footprint ? footprint.width * widthScale * .82 : .68 * widthScale,
        footprint ? footprint.depth * depthScale * .82 : .42 * depthScale);
    }
    this.batches.enemy.mesh.count = state.enemies.length;
    this.batches.enemy.mesh.instanceMatrix.needsUpdate = true;
    if (state.boss) {
      this.lastBoss ??= { x: 0, z: 0, visualScale: 1 };
      this.lastBoss.x = state.boss.x;
      this.lastBoss.z = state.boss.z;
      this.lastBoss.visualScale = state.boss.visualScale;
      this.bossDeathStartedAtMs = -Infinity;
    } else if (this.lastBoss && this.bossDeathStartedAtMs === -Infinity) {
      this.bossDeathStartedAtMs = nowMs;
    }
    const bossShadow = state.boss ?? (nowMs - this.bossDeathStartedAtMs < BOSS_DEATH_MS
      ? this.lastBoss : null);
    if (bossShadow) this.place('boss', 0, -bossShadow.x, bossShadow.z,
      .78 * bossShadow.visualScale, .46 * bossShadow.visualScale);
    this.batches.boss.mesh.count = bossShadow ? 1 : 0;
    this.batches.boss.mesh.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < state.streamRewards.length; index++) {
      const reward = state.streamRewards[index];
      const scale = reward.tier === 1 ? 1 : 1.16;
      this.place('reward', index, -reward.x, reward.z, .92 * scale, .54 * scale);
    }
    this.batches.reward.mesh.count = state.streamRewards.length;
    this.batches.reward.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    for (const batch of Object.values(this.batches)) batch.mesh.count = 0;
    this.lastBoss = null;
    this.bossDeathStartedAtMs = -Infinity;
  }

  dispose(): void {
    for (const batch of Object.values(this.batches)) {
      this.scene.remove(batch.mesh);
      batch.mesh.dispose();
    }
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private readonly placePlayer = (position: THREE.Vector3, footprint: { width: number; depth: number }): void => {
    this.place('player', this.playerIndex++, position.x, position.z, footprint.width, footprint.depth);
  };

  private place(kind: ShadowKind, index: number, x: number, z: number,
    width: number, depth: number): void {
    this.transform.position.set(x, .027, z);
    this.transform.scale.set(width, 1, depth);
    this.transform.updateMatrix();
    this.batches[kind].mesh.setMatrixAt(index, this.transform.matrix);
  }

  private createBatch(kind: ShadowKind, capacity: number): ShadowBatch {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.name = `contact-shadow-${kind}`;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, capacity };
  }

  private ensureCapacity(kind: ShadowKind, needed: number): void {
    const batch = this.batches[kind];
    if (needed <= batch.capacity) return;
    this.scene.remove(batch.mesh);
    batch.mesh.dispose();
    this.batches[kind] = this.createBatch(kind, Math.max(needed, batch.capacity * 2));
  }

  private createTexture(): THREE.DataTexture {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + .5 - size / 2) / (size / 2);
        const dy = (y + .5 - size / 2) / (size / 2);
        const falloff = Math.max(0, 1 - dx * dx - dy * dy);
        const index = (y * size + x) * 4;
        data[index] = data[index + 1] = data[index + 2] = 255;
        data[index + 3] = Math.round(255 * falloff * falloff);
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
