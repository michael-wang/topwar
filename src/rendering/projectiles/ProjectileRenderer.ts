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
  private readonly pulse = new ProjectilePulseTracker();
  private readonly members: THREE.Mesh[] = [];

  constructor(private readonly scene: THREE.Scene,
    private readonly bullet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {}

  update(projectiles: readonly ProjectileRenderState[], nowMs = performance.now()): void {
    while (this.members.length < projectiles.length) {
      const mesh = new THREE.Mesh(this.bullet.geometry, this.bullet.material);
      mesh.name = 'toy-bullet';
      this.scene.add(mesh);
      this.members.push(mesh);
    }
    const activeIds = new Set<number>();
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const projectile = projectiles[index];
      member.visible = projectile !== undefined;
      if (!projectile) continue;
      activeIds.add(projectile.id);
      const size = projectile.kind === 'rocket' ? 1.8 : Math.min(1.6, 1 + 0.12 * (projectile.tier - 1));
      member.position.set(-projectile.x, projectile.kind === 'rocket' ? 0.66 : 0.64, projectile.z);
      member.scale.setScalar(size * this.pulse.scaleFor(projectile.id, nowMs));
    }
    this.pulse.prune(activeIds);
  }

  reset(): void { this.pulse.reset(); }
  dispose(): void {
    this.pulse.reset();
    for (const member of this.members) this.scene.remove(member);
    this.members.length = 0;
  }
}
