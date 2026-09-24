import * as THREE from 'three';
import type { ProjectileRenderState } from '../RenderState';

export class ProjectileRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6);
  private readonly tipGeometry = new THREE.SphereGeometry(0.085, 6, 4);
  private readonly bodyMaterial = new THREE.MeshBasicMaterial({ color: '#ff9c16' });
  private readonly tipMaterial = new THREE.MeshBasicMaterial({ color: '#fff6cf' });
  private readonly heavyBodyGeometry = new THREE.CylinderGeometry(0.17, 0.17, 1.05, 8);
  private readonly heavyTipGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly heavyBodyMaterial = new THREE.MeshBasicMaterial({ color: '#ff711a' });
  private readonly heavyTipMaterial = new THREE.MeshBasicMaterial({ color: '#fff3bd' });
  private readonly rocketBodyGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.85, 7);
  private readonly rocketTipGeometry = new THREE.ConeGeometry(0.16, 0.3, 7);
  private readonly rocketBodyMaterial = new THREE.MeshBasicMaterial({ color: '#b94b19' });
  private readonly rocketTipMaterial = new THREE.MeshBasicMaterial({ color: '#ffd250' });
  private readonly members: { group: THREE.Group; rifle: THREE.Mesh[];
    heavyRifle: THREE.Mesh[]; rocket: THREE.Mesh[] }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(projectiles: readonly ProjectileRenderState[]): void {
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
      const rocketBody = new THREE.Mesh(this.rocketBodyGeometry, this.rocketBodyMaterial);
      rocketBody.rotation.x = Math.PI / 2;
      const rocketTip = new THREE.Mesh(this.rocketTipGeometry, this.rocketTipMaterial);
      rocketTip.rotation.x = Math.PI / 2;
      rocketTip.position.z = 0.55;
      group.add(body, tip, heavyBody, heavyTip, rocketBody, rocketTip);
      this.scene.add(group);
      this.members.push({ group, rifle: [body, tip], heavyRifle: [heavyBody, heavyTip],
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
        for (const mesh of member.rocket) mesh.visible = isRocket;
        member.group.position.set(-projectile.x, isRocket ? 0.66 : projectile.kind === 'heavyRifle' ? 0.72 : 0.58, projectile.z);
      }
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member.group);
    this.members.length = 0;
    this.bodyGeometry.dispose();
    this.tipGeometry.dispose();
    this.heavyBodyGeometry.dispose();
    this.heavyTipGeometry.dispose();
    this.rocketBodyGeometry.dispose();
    this.rocketTipGeometry.dispose();
    this.bodyMaterial.dispose();
    this.tipMaterial.dispose();
    this.heavyBodyMaterial.dispose();
    this.heavyTipMaterial.dispose();
    this.rocketBodyMaterial.dispose();
    this.rocketTipMaterial.dispose();
  }
}
