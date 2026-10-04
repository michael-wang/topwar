import * as THREE from 'three';

interface DeathBatch {
  mesh: THREE.InstancedMesh;
  gray: THREE.InstancedBufferAttribute;
  opacity: THREE.InstancedBufferAttribute;
  count: number;
}

// Frozen lethal slots own pose state, while shared per-geometry batches own the draws.
// Only cloned geometry carries instance attributes; family resources stay intact.
export class CrowdDeathBatches {
  private readonly batches = new Map<string, DeathBatch>();
  constructor(private readonly scene: THREE.Scene, private readonly capacity: number) {}
  begin(): void { for (const batch of this.batches.values()) batch.count = 0; }
  submit(group: THREE.Group, gray: number, opacity: number): void {
    group.updateMatrixWorld(true);
    for (const source of group.children) {
      if (!(source instanceof THREE.Mesh) || !source.visible) continue;
      let batch = this.batches.get(source.geometry.uuid);
      if (!batch) {
        const geometry = source.geometry.clone();
        const material = (source.material as THREE.MeshStandardMaterial).clone();
        const gray = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const opacity = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        geometry.setAttribute('deathGray', gray); geometry.setAttribute('deathOpacity', opacity);
        material.opacity = 1;
        const prepareSource = (source.material as THREE.Material).onBeforeCompile.bind(source.material);
        material.onBeforeCompile = (shader, renderer) => {
          // Preserve the source's surface pipeline and neutral gray tint.
          prepareSource(shader, renderer);
          shader.vertexShader = `attribute float deathGray; attribute float deathOpacity;
varying float vDeathGray; varying float vDeathOpacity;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeathGray = deathGray; vDeathOpacity = deathOpacity;');
          shader.fragmentShader = `varying float vDeathGray; varying float vDeathOpacity;\n${shader.fragmentShader}`
            .replace('mix(diffuseColor.rgb, deathTint, deathPale)', 'mix(diffuseColor.rgb, deathTint, vDeathGray)')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDeathOpacity;');
        };
        material.customProgramCacheKey = () => 'instanced-intact-enemy-death-v1';
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = 'enemy-frozen-body-batch'; mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        gray.setUsage(THREE.DynamicDrawUsage); opacity.setUsage(THREE.DynamicDrawUsage);
        batch = { mesh, gray, opacity, count: 0 }; this.batches.set(source.geometry.uuid, batch); this.scene.add(mesh);
      }
      const index = batch.count++;
      batch.mesh.setMatrixAt(index, source.matrixWorld);
      batch.gray.setX(index, gray); batch.opacity.setX(index, opacity);
    }
  }
  finish(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.gray.needsUpdate = batch.opacity.needsUpdate = true;
    }
  }
  reset(): void { this.begin(); this.finish(); }
  dispose(): void {
    for (const { mesh } of this.batches.values()) {
      this.scene.remove(mesh); mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    }
    this.batches.clear();
  }
}
