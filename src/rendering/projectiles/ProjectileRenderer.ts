import { ART } from '../../art/ArtDirection';
import { WEAPON_AFTERGLOW_MS } from '../../presentation/ProgressionLevelUp';
import * as THREE from 'three';
import type { ProjectileRenderState } from '../RenderState';

export function projectilePulseScale(ageMs: number): number {
  return 1 + 0.35 * Math.max(0, 1 - ageMs / 65);
}

export class ProjectilePulseTracker {
  private readonly births = new Map<number, number>();
  scaleFor(id: number, nowMs: number): number {
    if (!this.births.has(id)) this.births.set(id, nowMs);
    return projectilePulseScale(nowMs - this.births.get(id)!);
  }
  prune(activeIds: ReadonlySet<number>): void {
    for (const id of this.births.keys()) if (!activeIds.has(id)) this.births.delete(id);
  }
  reset(): void { this.births.clear(); }
  get size(): number { return this.births.size; }
}

export class ProjectileRenderer {
  getDebugStats(): { live: number; pool: number; pulseTrackers: number } {
    return { live: this.body.count, pool: this.capacity, pulseTrackers: this.pulse.size };
  }
  private readonly pulse = new ProjectilePulseTracker();
  private readonly transform = new THREE.Object3D();
  private capacity = 8;
  private afterglowUntilMs = -Infinity;
  private body: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private readonly tracerMaterial = new THREE.MeshBasicMaterial({ color: ART.projectile.core,
    toneMapped: false });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ color: ART.projectile.accent,
    transparent: true, opacity: ART.projectile.accentOpacity, depthWrite: false,
    blending: THREE.NormalBlending, toneMapped: false });

  constructor(private readonly scene: THREE.Scene,
    private readonly bullet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly rifleOrigin = { height: .64, offsetX: 0 }) {
    this.body = this.createBatch('rifle-tracers', this.tracerMaterial, this.capacity);
    this.glow = this.createBatch('tracer-glows', this.glowMaterial, this.capacity);
  }

  presentLevelUp(nowMs: number): void { this.afterglowUntilMs = nowMs + WEAPON_AFTERGLOW_MS; }

  update(projectiles: readonly ProjectileRenderState[], nowMs = performance.now()): void {
    this.ensureCapacity(projectiles.length);
    const afterglow = nowMs < this.afterglowUntilMs;
    this.glowMaterial.color.set(afterglow ? ART.coastalUi.aqua : ART.projectile.accent);
    this.tracerMaterial.color.set(afterglow ? ART.coastalUi.energy : ART.projectile.core);
    // A red edge must darken pale sand, rather than add more yellow light to it.
    this.glowMaterial.blending = afterglow ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.glowMaterial.opacity = afterglow ? .55 : ART.projectile.accentOpacity;
    const activeIds = new Set<number>();
    for (let index = 0; index < projectiles.length; index++) {
      const projectile = projectiles[index];
      activeIds.add(projectile.id);
      const length = Math.min(1.35, 1 + 0.025 * (projectile.tier - 1));
      const pulse = this.pulse.scaleFor(projectile.id, nowMs);
      const transform = this.transform;
      transform.rotation.y = -Math.atan(projectile.slopeX ?? 0);
      transform.position.set(-projectile.x + (projectile.kind === 'rifle' ? this.rifleOrigin.offsetX : 0),
        projectile.kind === 'rocket' ? .66 : this.rifleOrigin.height, projectile.z);
      if (projectile.kind === 'rocket') {
        transform.scale.setScalar(1.8 * pulse);
      } else {
        transform.scale.set(1 + 0.45 * projectile.hitRadiusBonus,
          1 + 0.45 * projectile.hitRadiusBonus, length * pulse);
      }
      if (afterglow && projectile.kind === 'rifle') { transform.scale.x *= 1.2; transform.scale.y *= 1.2; }
      transform.updateMatrix();
      this.body.setMatrixAt(index, transform.matrix);
      const glowWidth = projectile.kind === 'rocket' ? 2.4 : 2.4 + 1.7 * projectile.hitRadiusBonus;
      transform.scale.set(transform.scale.x * glowWidth, transform.scale.y * glowWidth,
        transform.scale.z * 1.12);
      transform.updateMatrix();
      this.glow.setMatrixAt(index, transform.matrix);
    }
    this.body.count = projectiles.length;
    this.glow.count = projectiles.length;
    this.body.visible = projectiles.length > 0;
    this.glow.visible = projectiles.length > 0;
    this.body.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    this.pulse.prune(activeIds);
  }

  reset(): void {
    this.afterglowUntilMs = -Infinity;
    this.pulse.reset();
    this.body.count = 0;
    this.glow.count = 0;
    this.body.visible = false;
    this.glow.visible = false;
  }
  dispose(): void {
    this.reset();
    this.scene.remove(this.body, this.glow);
    this.body.dispose();
    this.glow.dispose();
    this.tracerMaterial.dispose();
    this.glowMaterial.dispose();
  }

  private createBatch(name: string, material: THREE.Material, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.bullet.geometry, material, capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private ensureCapacity(required: number): void {
    if (required <= this.capacity) return;
    while (this.capacity < required) this.capacity *= 2;
    this.scene.remove(this.body, this.glow);
    this.body.dispose();
    this.glow.dispose();
    this.body = this.createBatch('rifle-tracers', this.tracerMaterial, this.capacity);
    this.glow = this.createBatch('tracer-glows', this.glowMaterial, this.capacity);
  }
}
