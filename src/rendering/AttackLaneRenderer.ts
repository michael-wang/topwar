import * as THREE from 'three';

// Disposable presentation only: all corridor positions come from simulation config.
export class AttackLaneRenderer {
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ color: '#b8ced2', transparent: true,
    opacity: .16, depthWrite: false, toneMapped: false });
  private mesh: THREE.InstancedMesh;
  private capacity = 1;
  private readonly transform = new THREE.Object3D();
  private readonly beachDetails = new THREE.Group();
  private readonly beamGeometry = new THREE.BoxGeometry(1.1, .10, .10);
  private readonly beamMaterial = new THREE.MeshStandardMaterial({ color: '#635b49', roughness: 1 });
  private readonly trackMaterial = new THREE.MeshBasicMaterial({ color: '#85724f', transparent: true,
    opacity: .10, depthWrite: false });
  private layoutKey = '';

  constructor(private readonly scene: THREE.Scene) {
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'attack-corridors';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
    this.beachDetails.name = 'beach-corridor-openings';
    this.scene.add(this.beachDetails);
  }

  update(positions: readonly number[] | undefined, playerZ: number, playerX: number, defenseMode = false): void {
    this.mesh.visible = !defenseMode;
    this.beachDetails.visible = defenseMode;
    this.beachDetails.position.z = playerZ;
    if (defenseMode && positions) {
      const key = positions.join(',');
      if (key !== this.layoutKey) {
        this.layoutKey = key;
        this.beachDetails.clear();
        const spacing = positions[1] - positions[0];
        const boundaries = [positions[0] - spacing / 2,
          ...positions.slice(0, -1).map((x, index) => (x + positions[index + 1]) / 2), positions.at(-1)! + spacing / 2];
        boundaries.forEach((x, index) => {
          for (const z of [7, 21, 37]) {
            for (const angle of [-.8, .8]) {
              const beam = new THREE.Mesh(this.beamGeometry, this.beamMaterial);
              beam.name = 'beach-obstacle';
              beam.position.set(-x, .28, z + (index % 2) * .8);
              beam.rotation.set(0, .3 * index, angle);
              this.beachDetails.add(beam);
            }
          }
        });
        positions.forEach((x, lane) => {
          for (let patch = 0; patch < 9; patch++) {
            const scuff = new THREE.Mesh(this.geometry, this.trackMaterial);
            scuff.name = 'sand-scuff';
            scuff.position.set(-x + Math.sin(patch * 2 + lane) * spacing * .12, .026, 3 + patch * 5);
            scuff.scale.set(spacing * (.32 + .1 * (patch % 3)), 1, 2.2 + patch % 2);
            scuff.rotation.y = Math.sin(patch + lane) * .15;
            this.beachDetails.add(scuff);
          }
        });
      }
    }
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
    this.mesh.visible = !defenseMode;
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
    this.scene.remove(this.beachDetails);
    this.beamGeometry.dispose();
    this.beamMaterial.dispose();
    this.trackMaterial.dispose();
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
