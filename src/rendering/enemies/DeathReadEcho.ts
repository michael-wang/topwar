import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CrowdVisualFamily } from '../CharacterVisualFamilies';
import { DEATH_PALE_COLOR } from '../../presentation/EnemyDeathPale';

export const DEATH_ECHO_MS = 100;
export const DEATH_ECHO_CAPACITY = 48;
// A dense-column fallback, not a replacement for the depth-tested corpse.
// One silhouette mesh uses captured run-frame position offsets, avoiding four
// submitted copies of the body. No per-death geometry or hierarchy.
export class DeathReadEcho {
  private readonly mesh: THREE.InstancedMesh;
  private readonly opacity = new THREE.InstancedBufferAttribute(new Float32Array(DEATH_ECHO_CAPACITY), 1);
  private readonly frame = new THREE.InstancedBufferAttribute(new Float32Array(DEATH_ECHO_CAPACITY), 1);
  private count = 0;
  constructor(private readonly scene: THREE.Scene, family: CrowdVisualFamily) {
    const parts = [{ model: family.runFrames[0], body: true },
      { model: family.helmet, body: false }, ...(family.vest.visible ? [{ model: family.vest, body: false }] : [])];
    const copies = parts.map(({ model, body }) => {
      const g = model.geometry.index ? model.geometry.toNonIndexed() : model.geometry.clone();
      for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
      const base = g.attributes.position;
      for (let frame = 1; frame < 4; frame++) {
        const delta = new Float32Array(base.count * 3);
        if (body) {
          const source = family.runFrames[frame].geometry;
          const pose = source.index ? source.toNonIndexed() : source;
          if (pose.attributes.position.count !== base.count) throw new Error('Grunt echo requires matching run-pose topology');
          for (let i = 0; i < delta.length; i++) delta[i] = pose.attributes.position.array[i] - base.array[i];
          if (pose !== source) pose.dispose();
        }
        g.setAttribute(`echoOffset${frame}`, new THREE.BufferAttribute(delta, 3));
      }
      return g;
    });
    const geometry = mergeGeometries(copies)!; copies.forEach(g => g.dispose());
    geometry.setAttribute('echoOpacity', this.opacity); geometry.setAttribute('echoFrame', this.frame);
    const material = new THREE.MeshBasicMaterial({ color: DEATH_PALE_COLOR, transparent: true,
      depthTest: false, depthWrite: false, toneMapped: true });
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute vec3 echoOffset1; attribute vec3 echoOffset2; attribute vec3 echoOffset3; attribute float echoFrame; attribute float echoOpacity; varying float vEchoOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += echoFrame<.5 ? vec3(0.) : echoFrame<1.5 ? echoOffset1 : echoFrame<2.5 ? echoOffset2 : echoOffset3; vEchoOpacity=echoOpacity;');
      shader.fragmentShader = `varying float vEchoOpacity;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vEchoOpacity;');
    };
    material.customProgramCacheKey = () => 'short-grunt-death-read-echo';
    this.mesh = new THREE.InstancedMesh(geometry, material, DEATH_ECHO_CAPACITY);
    this.mesh.name = 'enemy-death-read-echo'; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.opacity.setUsage(THREE.DynamicDrawUsage); this.frame.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; scene.add(this.mesh);
  }
  begin(): void { this.count = 0; }
  submit(matrix: THREE.Matrix4, frame: number, ageMs: number): void {
    if (ageMs < 0 || ageMs >= DEATH_ECHO_MS || this.count >= DEATH_ECHO_CAPACITY) return;
    const i = this.count++, t = Math.max(0, Math.min(1, (ageMs - 70) / 30));
    this.mesh.setMatrixAt(i, matrix); this.frame.setX(i, frame);
    this.opacity.setX(i, .30 * (1 - t * t * (3 - 2 * t)));
  }
  finish(): void {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0;
    this.mesh.instanceMatrix.needsUpdate = this.frame.needsUpdate = this.opacity.needsUpdate = true;
  }
  reset(): void { this.begin(); this.finish(); }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
