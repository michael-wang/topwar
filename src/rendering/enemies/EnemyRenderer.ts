import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export class EnemyRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly gruntBodyMaterial = new THREE.MeshStandardMaterial({ color: '#c93332' });
  private readonly gruntHeadMaterial = new THREE.MeshStandardMaterial({ color: '#f15a4c' });
  private readonly bruteBodyMaterial = new THREE.MeshStandardMaterial({ color: '#761a22' });
  private readonly bruteHeadMaterial = new THREE.MeshStandardMaterial({ color: '#ab3034' });
  private readonly transform = new THREE.Object3D();
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

  update(enemies: readonly EnemyRenderState[]): void {
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
    }
  }

  dispose(): void {
    this.scene.remove(this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead);
    for (const mesh of [this.gruntBody, this.gruntHead, this.bruteBody, this.bruteHead]) mesh.dispose();
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.gruntBodyMaterial.dispose();
    this.gruntHeadMaterial.dispose();
    this.bruteBodyMaterial.dispose();
    this.bruteHeadMaterial.dispose();
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
