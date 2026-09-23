import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export class EnemyRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: '#c93332' });
  private readonly headMaterial = new THREE.MeshStandardMaterial({ color: '#f15a4c' });
  private readonly transform = new THREE.Object3D();
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private capacity = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.body = this.createMesh(this.bodyGeometry, this.bodyMaterial);
    this.head = this.createMesh(this.headGeometry, this.headMaterial);
    this.scene.add(this.body, this.head);
  }

  update(enemies: readonly EnemyRenderState[]): void {
    if (enemies.length > this.capacity) this.grow(enemies.length);
    this.body.count = enemies.length;
    this.head.count = enemies.length;
    for (let index = 0; index < enemies.length; index++) {
      const enemy = enemies[index];
      // Match the squad's visual X flip for the camera that looks along +Z.
      this.transform.position.set(-enemy.x, 0.32, enemy.z);
      this.transform.updateMatrix();
      this.body.setMatrixAt(index, this.transform.matrix);
      this.transform.position.y = 0.75;
      this.transform.updateMatrix();
      this.head.setMatrixAt(index, this.transform.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.body, this.head);
    this.body.dispose();
    this.head.dispose();
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.bodyMaterial.dispose();
    this.headMaterial.dispose();
  }

  private createMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private grow(required: number): void {
    while (this.capacity < required) this.capacity *= 2;
    this.scene.remove(this.body, this.head);
    this.body.dispose();
    this.head.dispose();
    this.body = this.createMesh(this.bodyGeometry, this.bodyMaterial);
    this.head = this.createMesh(this.headGeometry, this.headMaterial);
    this.scene.add(this.body, this.head);
  }
}
