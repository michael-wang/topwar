import { ART } from '../../art/ArtDirection';
import * as THREE from 'three';
import type { ProjectileRenderState } from '../RenderState';
import { defenseTracerGeometry, DefenseTracerTransform, prepareTracerContrast, type TracerStyle } from './DefenseTracer';

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
  private style: TracerStyle = ART.defenseTracer;
  setStyle(style: TracerStyle): void {
    if (this.style === style) return;
    this.style = style;
    this.tracerMaterial.color.set(style.core); this.glowMaterial.color.set(style.outline);
    prepareTracerContrast(this.tracerMaterial, true, style); prepareTracerContrast(this.glowMaterial, false, style);
    this.tracerMaterial.needsUpdate = this.glowMaterial.needsUpdate = true;
  }
  private readonly pulse = new ProjectilePulseTracker();
  private readonly transform = new THREE.Object3D();
  private readonly defenseTransform = new DefenseTracerTransform();
  private readonly activeIds = new Set<number>();
  private readonly defenseGeometry: THREE.BufferGeometry;
  private capacity = 8;
  private body: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private readonly tracerMaterial = new THREE.MeshBasicMaterial({ color: ART.defenseTracer.core, transparent: true,
    toneMapped: false });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ color: ART.defenseTracer.outline,
    transparent: true, opacity: 1, depthWrite: false,
    blending: THREE.NormalBlending, toneMapped: false });

  constructor(private readonly scene: THREE.Scene,
    private readonly rifleOrigin = { height: .64, offsetX: 0 }) {
    this.defenseGeometry = defenseTracerGeometry();
    prepareTracerContrast(this.tracerMaterial, true);
    prepareTracerContrast(this.glowMaterial);
    this.body = this.createBatch('rifle-tracers', this.tracerMaterial, this.capacity);
    this.glow = this.createBatch('tracer-glows', this.glowMaterial, this.capacity);
  }

  update(projectiles: readonly ProjectileRenderState[], nowMs = performance.now(),
    defenseCamera: THREE.PerspectiveCamera, cssHeight: number): void {
    this.ensureCapacity(projectiles.length);
    defenseCamera.updateMatrixWorld();
    this.glow.renderOrder = 1; this.body.renderOrder = 2;
    const activeIds = this.activeIds;
    activeIds.clear();
    for (let index = 0; index < projectiles.length; index++) {
      const projectile = projectiles[index];
      activeIds.add(projectile.id);
      const length = Math.min(1.35, 1 + 0.025 * (projectile.tier - 1));
      const pulse = this.pulse.scaleFor(projectile.id, nowMs);
      const transform = this.transform;
      transform.position.set(-projectile.x + this.rifleOrigin.offsetX, this.rifleOrigin.height, projectile.z);
      {
        const edge = this.defenseTransform.apply(transform, defenseCamera, cssHeight,
          projectile.slopeX ?? 0, length, pulse, projectile.hitRadiusBonus, this.style);
        const fullLength = transform.scale.z;
        transform.scale.z *= this.style.coreLengthRatio;
        transform.updateMatrix();
        this.body.setMatrixAt(index, transform.matrix);
        transform.scale.x += edge;
        transform.scale.z = fullLength + edge;
        transform.updateMatrix();
        this.glow.setMatrixAt(index, transform.matrix);
        continue;
      }
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
    this.pulse.reset();
    this.activeIds.clear();
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
    this.defenseGeometry.dispose();
  }

  private createBatch(name: string, material: THREE.Material, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.defenseGeometry, material, capacity);
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
