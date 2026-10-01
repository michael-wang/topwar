import * as THREE from 'three';

// Disposable presentation only: all corridor positions come from simulation config.
export class AttackLaneRenderer {
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ color: '#b8ced2', transparent: true,
    opacity: .16, depthWrite: false, toneMapped: false });
  private mesh: THREE.InstancedMesh;
  private capacity = 1;
  private readonly transform = new THREE.Object3D();

  constructor(private readonly scene: THREE.Scene) {
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'attack-corridors';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }

  update(positions: readonly number[] | undefined, playerZ: number, playerX: number): void {
    if (positions && positions.length > this.capacity) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
      this.capacity = positions.length;
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
      this.mesh.name = 'attack-corridors';
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
    }
    this.mesh.count = positions?.length ?? 0;
    if (!positions) return;
    const spacing = positions[1] - positions[0];
    positions.forEach((x, index) => {
      this.transform.position.set(-x, .035, playerZ + 24);
      this.transform.scale.set(spacing * .84, 1, 52);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(index, this.transform.matrix);
      this.mesh.setColorAt(index, new THREE.Color(Math.abs(playerX - x) < spacing / 2 ? '#d7ffff' : '#617e85'));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
