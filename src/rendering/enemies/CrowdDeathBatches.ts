import * as THREE from 'three';
import { assemblyBatchGeometry, DEATH_DIRECTION_GLSL } from './DeathAssembly';

interface DeathBatch {
  mesh: THREE.InstancedMesh;
  gray: THREE.InstancedBufferAttribute;
  breakup: THREE.InstancedBufferAttribute;
  variant: THREE.InstancedBufferAttribute;
  opacity: THREE.InstancedBufferAttribute;
  count: number;
}

// Frozen lethal slots own pose state, while shared per-geometry batches own the draws.
// Only cloned geometry carries instance attributes; family resources stay intact.
export class CrowdDeathBatches {
  private readonly batches = new Map<string, DeathBatch>();
  constructor(private readonly scene: THREE.Scene, private readonly capacity: number) {}
  begin(): void { for (const batch of this.batches.values()) batch.count = 0; }
  submit(group: THREE.Group, gray: number, breakupWorld: number, opacity: number, variant = 0): void {
    group.updateMatrixWorld(true);
    for (const source of group.children) {
      if (!(source instanceof THREE.Mesh) || !source.visible) continue;
      let batch = this.batches.get(source.geometry.uuid);
      if (!batch) {
        const geometry = assemblyBatchGeometry(source.geometry);
        const material = (source.material as THREE.MeshStandardMaterial).clone();
        const gray = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const breakup = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const variant = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const opacity = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        geometry.setAttribute('deathGray', gray); geometry.setAttribute('deathBreakup', breakup); geometry.setAttribute('deathOpacity', opacity); geometry.setAttribute('deathVariant', variant);
        material.opacity = 1; material.transparent = true;
        // Keep self-occlusion inside deep helmet shells during the intact fade.
        material.depthWrite = true;
        const prepareSource = (source.material as THREE.Material).onBeforeCompile.bind(source.material);
        material.onBeforeCompile = (shader, renderer) => {
          // Preserve the source's surface pipeline and neutral gray tint.
          prepareSource(shader, renderer);
          shader.vertexShader = `attribute float deathGray; attribute float deathBreakup; attribute float deathVariant; attribute vec3 deathPieceDirection; attribute float deathOpacity;
${DEATH_DIRECTION_GLSL}
varying float vDeathGray; varying float vDeathOpacity;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeathGray = deathGray; transformed += pieceDirection(deathPieceDirection, deathVariant) * deathBreakup; vDeathOpacity = deathOpacity;');
          shader.fragmentShader = `varying float vDeathGray; varying float vDeathOpacity;\n${shader.fragmentShader}`
            .replace('deathGrayTint, deathGray)', 'deathGrayTint, vDeathGray)')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDeathOpacity;');
        };
        material.customProgramCacheKey = () => 'instanced-authored-death-assembly-v2';
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = 'enemy-frozen-body-batch'; mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        gray.setUsage(THREE.DynamicDrawUsage); breakup.setUsage(THREE.DynamicDrawUsage); opacity.setUsage(THREE.DynamicDrawUsage);
        batch = { mesh, gray, breakup, variant, opacity, count: 0 }; this.batches.set(source.geometry.uuid, batch); this.scene.add(mesh);
      }
      const index = batch.count++;
      batch.mesh.setMatrixAt(index, source.matrixWorld);
      batch.gray.setX(index, gray);
      batch.variant.setX(index, variant);
      // Convert world-unit cap to local displacement; non-uniform role scale
      // cannot make a triangle exceed the authored separation limit.
      const m = source.matrixWorld.elements;
      const maxScale = Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
      batch.breakup.setX(index, breakupWorld / Math.max(.001,maxScale)); batch.opacity.setX(index, opacity);
    }
  }
  finish(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.gray.needsUpdate = batch.breakup.needsUpdate = batch.variant.needsUpdate = batch.opacity.needsUpdate = true;
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
