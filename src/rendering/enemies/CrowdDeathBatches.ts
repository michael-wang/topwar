import * as THREE from 'three';
import { assemblyBatchGeometry, DEATH_DIRECTION_GLSL, DEATH_FOOT_PLANT_GLSL } from './DeathAssembly';
import { DEATH_PALE_COLOR } from '../../presentation/EnemyDeathPale';

interface DeathBatch {
  mesh: THREE.InstancedMesh;
  breakup?: THREE.InstancedBufferAttribute;
  variant?: THREE.InstancedBufferAttribute;
  sink?: THREE.InstancedBufferAttribute;
  opacity: THREE.InstancedBufferAttribute;
  pale: THREE.InstancedBufferAttribute;
  count: number;
}

// Frozen lethal slots own pose state, while shared per-geometry batches own the draws.
// Only Heavy uses the assembly path; Grunt stays intact and Giant owns its hierarchy.
// Only cloned geometry carries instance attributes; family resources stay intact.
export class CrowdDeathBatches {
  private readonly batches = new Map<string, DeathBatch>();
  constructor(private readonly scene: THREE.Scene, private readonly capacity: number) {}
  begin(): void { for (const batch of this.batches.values()) batch.count = 0; }
  submit(group: THREE.Group, breakupWorld: number, opacity: number, variant = 0, paleAmount = 0, intact = false, sinkWorld = 0): void {
    group.updateMatrixWorld(true);
    for (const source of group.children) {
      if (!(source instanceof THREE.Mesh) || !source.visible) continue;
      const key = source.geometry.uuid + (intact ? ':intact' : ':assembly');
      let batch = this.batches.get(key);
      if (!batch) {
        const geometry = intact ? source.geometry.clone() : assemblyBatchGeometry(source.geometry);
        const material = (source.material as THREE.MeshStandardMaterial).clone();
        const breakup = intact ? undefined : new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const variant = intact ? undefined : new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const sink = intact ? undefined : new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const opacity = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        const pale = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1);
        geometry.setAttribute('deathPale', pale);
        geometry.setAttribute('deathOpacity', opacity);
        if (sink) geometry.setAttribute('deathSink', sink);
        if (breakup && variant) { geometry.setAttribute('deathBreakup', breakup); geometry.setAttribute('deathVariant', variant); }
        material.opacity = 1; material.transparent = true;
        // Keep self-occlusion inside deep helmet shells during the intact fade.
        material.depthWrite = true;
        const prepareSource = (source.material as THREE.Material).onBeforeCompile.bind(source.material);
        material.onBeforeCompile = (shader, renderer) => {
          // Preserve the source's surface pipeline and authored colors.
          prepareSource(shader, renderer);
          shader.uniforms.paleDeadColor = { value: new THREE.Color(DEATH_PALE_COLOR) };
          if (!intact) shader.uniforms.deathShellRole = { value: geometry.userData.deathShellRole ?? 0 };
          if (intact) {
            shader.vertexShader = `attribute float deathPale; attribute float deathOpacity; varying float vDeathPale; varying float vDeathOpacity;\n${shader.vertexShader}`
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeathOpacity = deathOpacity; vDeathPale = deathPale;');
          } else shader.vertexShader = `attribute float deathSink; uniform float deathShellRole; attribute float deathPieceId; attribute float deathPale; varying float vDeathPale; attribute float deathBreakup; attribute float deathVariant; attribute vec3 deathPieceDirection; attribute float deathOpacity;
${DEATH_DIRECTION_GLSL}
${DEATH_FOOT_PLANT_GLSL}
varying float vDeathOpacity;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += openedPieceDirection(deathPieceDirection, deathPieceId, deathShellRole, deathVariant) * deathBreakup; vDeathOpacity = deathOpacity; vDeathPale = deathPale;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nif (deathSink > 0. && isDeathFoot(deathPieceId, 1.)) { mvPosition += viewMatrix * vec4(0., deathSink, 0., 0.); gl_Position = projectionMatrix * mvPosition; }');
          shader.fragmentShader = `uniform vec3 paleDeadColor; varying float vDeathPale; varying float vDeathOpacity;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, paleDeadColor, vDeathPale); diffuseColor.a *= vDeathOpacity;');
        };
        material.customProgramCacheKey = () => intact ? 'instanced-pale-intact-grunt-v2.6' : 'instanced-pale-death-collapse-v2.7';
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = 'enemy-frozen-body-batch'; mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        breakup?.setUsage(THREE.DynamicDrawUsage); opacity.setUsage(THREE.DynamicDrawUsage);
        batch = { mesh, breakup, variant, sink, opacity, pale, count: 0 }; this.batches.set(key, batch); this.scene.add(mesh);
      }
      if (batch.count >= this.capacity) continue;
      const index = batch.count++;
      batch.mesh.setMatrixAt(index, source.matrixWorld);
      batch.variant?.setX(index, variant);
      batch.pale.setX(index, paleAmount);
      batch.sink?.setX(index, sinkWorld);
      // Convert world-unit cap to local displacement; non-uniform role scale
      // cannot make a triangle exceed the authored separation limit.
      if (batch.breakup) {
        const m = source.matrixWorld.elements;
        const maxScale = Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
        batch.breakup.setX(index, breakupWorld / Math.max(.001,maxScale));
      }
      batch.opacity.setX(index, opacity);
    }
  }
  finish(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0;
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.breakup) batch.breakup.needsUpdate = true;
      if (batch.variant) batch.variant.needsUpdate = true;
      if (batch.sink) batch.sink.needsUpdate = true;
      batch.opacity.needsUpdate = batch.pale.needsUpdate = true;
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
