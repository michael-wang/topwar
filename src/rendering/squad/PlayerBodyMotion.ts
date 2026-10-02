import * as THREE from 'three';

// Original bone weights baked into a static mesh: four cheap rigid rotations in
// the vertex shader. No AnimationMixer, CPU vertex writes or new draw calls.
export class PlayerBodyMotion {
  readonly normal: THREE.MeshStandardMaterial;
  readonly level: THREE.MeshStandardMaterial;
  private readonly stride = { value: 0 };
  private readonly recoil = { value: 0 };
  private readonly ready = { value: 0 };
  constructor(normal: THREE.MeshStandardMaterial, level: THREE.MeshStandardMaterial) {
    this.normal = normal.clone(); this.level = level.clone();
    for (const material of [this.normal, this.level]) {
      material.customProgramCacheKey = () => 'player-limb-motion-v1';
      material.onBeforeCompile = shader => {
        shader.uniforms.playerStride = this.stride;
        shader.uniforms.playerRecoil = this.recoil;
        shader.uniforms.playerReady = this.ready;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          attribute vec4 _motion;
          uniform float playerStride;
          uniform float playerRecoil;
          uniform float playerReady;
          mat3 limbRotation(float a) {
            float c = cos(a), s = sin(a);
            return mat3(1.,0.,0.,0.,c,s,0.,-s,c);
          }
          vec3 limbPoint(vec3 p, vec3 pivot, float a) { return pivot + limbRotation(a) * (p-pivot); }
        `).replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          objectNormal += (limbRotation(playerStride*.55) * normal - normal) * _motion.x;
          objectNormal += (limbRotation(-playerStride*.55) * normal - normal) * _motion.y;
          objectNormal += (limbRotation(-playerStride*.20+playerRecoil*.12+playerReady*.35) * normal - normal) * _motion.z;
          objectNormal += (limbRotation(playerStride*.20+playerRecoil*.12+playerReady*.35) * normal - normal) * _motion.w;
        `).replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed += (limbPoint(position, vec3(.102779,.216759,.000080),playerStride*.55)-position)*_motion.x;
          transformed += (limbPoint(position, vec3(-.102779,.216759,.000080),-playerStride*.55)-position)*_motion.y;
          transformed += (limbPoint(position,vec3(.122857,.354467,.006450),-playerStride*.20+playerRecoil*.12+playerReady*.35)-position)*_motion.z;
          transformed += (limbPoint(position,vec3(-.122857,.354467,.006450),playerStride*.20+playerRecoil*.12+playerReady*.35)-position)*_motion.w;
          transformed.z -= playerRecoil*.025*(_motion.z+_motion.w);
        `);
      };
    }
  }
  update(stride: number, recoil: number, glow: number, ready = 0): void {
    this.stride.value = stride; this.recoil.value = recoil; this.ready.value = ready; this.level.emissiveIntensity = glow;
  }
  dispose(): void { this.normal.dispose(); this.level.dispose(); }
}
