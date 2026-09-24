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
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6);
  private readonly tipGeometry = new THREE.SphereGeometry(0.085, 6, 4);
  private readonly bodyMaterial = new THREE.MeshBasicMaterial({ color: '#ff9c16' });
  private readonly tipMaterial = new THREE.MeshBasicMaterial({ color: '#fff6cf' });
  private readonly heavyBodyGeometry = new THREE.CylinderGeometry(0.17, 0.17, 1.05, 8);
  private readonly heavyTipGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly heavyBodyMaterial = new THREE.MeshBasicMaterial({ color: '#ff711a' });
  private readonly heavyTipMaterial = new THREE.MeshBasicMaterial({ color: '#fff3bd' });
  private readonly tier3BodyGeometry = new THREE.CylinderGeometry(0.23, 0.23, 1.35, 8);
  private readonly tier3TipGeometry = new THREE.SphereGeometry(0.24, 8, 6);
  private readonly tier3BodyMaterial = new THREE.MeshBasicMaterial({ color: '#8ceaff' });
  private readonly tier3TipMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private readonly rocketBodyGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.85, 7);
  private readonly rocketTipGeometry = new THREE.ConeGeometry(0.16, 0.3, 7);
  private readonly rocketBodyMaterial = new THREE.MeshBasicMaterial({ color: '#b94b19' });
  private readonly rocketTipMaterial = new THREE.MeshBasicMaterial({ color: '#ffd250' });
  private readonly members: { group: THREE.Group; rifle: THREE.Mesh[];
    heavyRifle: THREE.Mesh[]; tier3Rifle: THREE.Mesh[]; rocket: THREE.Mesh[] }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(projectiles: readonly ProjectileRenderState[], nowMs = performance.now()): void {
    while (this.members.length < projectiles.length) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
      body.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(this.tipGeometry, this.tipMaterial);
      tip.position.z = 0.27;
      const heavyBody = new THREE.Mesh(this.heavyBodyGeometry, this.heavyBodyMaterial);
      heavyBody.rotation.x = Math.PI / 2;
      const heavyTip = new THREE.Mesh(this.heavyTipGeometry, this.heavyTipMaterial);
      heavyTip.position.z = 0.53;
      const tier3Body = new THREE.Mesh(this.tier3BodyGeometry, this.tier3BodyMaterial);
      tier3Body.rotation.x = Math.PI / 2;
      const tier3Tip = new THREE.Mesh(this.tier3TipGeometry, this.tier3TipMaterial);
      tier3Tip.position.z = 0.68;
      const rocketBody = new THREE.Mesh(this.rocketBodyGeometry, this.rocketBodyMaterial);
      rocketBody.rotation.x = Math.PI / 2;
      const rocketTip = new THREE.Mesh(this.rocketTipGeometry, this.rocketTipMaterial);
      rocketTip.rotation.x = Math.PI / 2;
      rocketTip.position.z = 0.55;
      group.add(body, tip, heavyBody, heavyTip, tier3Body, tier3Tip, rocketBody, rocketTip);
      this.scene.add(group);
      this.members.push({ group, rifle: [body, tip], heavyRifle: [heavyBody, heavyTip],
        tier3Rifle: [tier3Body, tier3Tip],
        rocket: [rocketBody, rocketTip] });
    }
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const projectile = projectiles[index];
      member.group.visible = projectile !== undefined;
      if (projectile) {
        const isRocket = projectile.kind === 'rocket';
        for (const mesh of member.rifle) mesh.visible = projectile.kind === 'rifle';
        for (const mesh of member.heavyRifle) mesh.visible = projectile.kind === 'heavyRifle';
        for (const mesh of member.tier3Rifle) mesh.visible = projectile.kind === 'tier3Rifle';
        for (const mesh of member.rocket) mesh.visible = isRocket;
        member.group.position.set(-projectile.x, isRocket ? 0.66
          : projectile.kind === 'tier3Rifle' ? 0.82
            : projectile.kind === 'heavyRifle' ? 0.72 : 0.58, projectile.z);
        member.group.scale.setScalar(this.pulse.scaleFor(projectile.id, nowMs));
      }
    }
    this.pulse.prune(new Set(projectiles.map((projectile) => projectile.id)));
  }

  reset(): void { this.pulse.reset(); }

  dispose(): void {
    this.pulse.reset();
    for (const member of this.members) this.scene.remove(member.group);
    this.members.length = 0;
    this.bodyGeometry.dispose();
    this.tipGeometry.dispose();
    this.heavyBodyGeometry.dispose();
    this.heavyTipGeometry.dispose();
    this.tier3BodyGeometry.dispose();
    this.tier3TipGeometry.dispose();
    this.rocketBodyGeometry.dispose();
    this.rocketTipGeometry.dispose();
    this.bodyMaterial.dispose();
    this.tipMaterial.dispose();
    this.heavyBodyMaterial.dispose();
    this.heavyTipMaterial.dispose();
    this.tier3BodyMaterial.dispose();
    this.tier3TipMaterial.dispose();
    this.rocketBodyMaterial.dispose();
    this.rocketTipMaterial.dispose();
  }
}
