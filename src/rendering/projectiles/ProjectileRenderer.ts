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
    return { live: this.members.reduce((count, mesh) => count + Number(mesh.visible), 0),
      pool: this.members.length, pulseTrackers: this.pulse.size };
  }
  private readonly pulse = new ProjectilePulseTracker();
  private readonly members: THREE.Mesh[] = [];
  private readonly tracerMaterial = new THREE.MeshBasicMaterial({ color: '#fffbd1',
    toneMapped: false });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffc84a',
    transparent: true, opacity: 0.28, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false });

  constructor(private readonly scene: THREE.Scene,
    private readonly bullet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {}

  update(projectiles: readonly ProjectileRenderState[], nowMs = performance.now()): void {
    while (this.members.length < projectiles.length) {
      const mesh = new THREE.Mesh(this.bullet.geometry, this.tracerMaterial);
      mesh.name = 'rifle-tracer';
      const glow = new THREE.Mesh(this.bullet.geometry, this.glowMaterial);
      glow.name = 'tracer-glow';
      glow.scale.set(2.4, 2.4, 1.12);
      mesh.add(glow);
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
      const length = Math.min(1.35, 1 + 0.025 * (projectile.tier - 1));
      member.position.set(-projectile.x, projectile.kind === 'rocket' ? 0.66 : 0.64, projectile.z);
      const pulse = this.pulse.scaleFor(projectile.id, nowMs);
      const glow = member.children[0] as THREE.Mesh;
      if (projectile.kind === 'rocket') {
        member.scale.setScalar(1.8 * pulse);
        glow.scale.set(2.4, 2.4, 1.12);
      } else {
        member.scale.set(1 + 0.45 * projectile.hitRadiusBonus,
          1 + 0.45 * projectile.hitRadiusBonus, length * pulse);
        const glowWidth = 2.4 + 1.7 * projectile.hitRadiusBonus;
        glow.scale.set(glowWidth, glowWidth, 1.12);
      }
    }
    this.pulse.prune(activeIds);
  }

  reset(): void { this.pulse.reset(); }
  dispose(): void {
    this.pulse.reset();
    for (const member of this.members) this.scene.remove(member);
    this.members.length = 0;
    this.tracerMaterial.dispose();
    this.glowMaterial.dispose();
  }
}
