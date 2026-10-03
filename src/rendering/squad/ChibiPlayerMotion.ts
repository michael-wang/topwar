import * as THREE from 'three';
import type { PlayerMotion } from './PlayerPresentation';

// One merged body draw: whole disconnected parts translate rigidly by an authored
// region attribute. No skeleton, legacy weights, anatomical pivots or UV selectors.
export class ChibiPlayerMotion implements PlayerMotion {
  readonly normal: THREE.MeshStandardMaterial;
  readonly level: THREE.MeshStandardMaterial;
  private readonly stride = { value: 0 };
  private readonly recoil = { value: 0 };
  private readonly ready = { value: 0 };

  constructor(normal: THREE.MeshStandardMaterial, level: THREE.MeshStandardMaterial) {
    this.normal = normal.clone(); this.level = level.clone();
    for (const material of [this.normal, this.level]) {
      material.customProgramCacheKey = () => 'topwar-floating-player-parts-v1';
      material.onBeforeCompile = shader => {
        shader.uniforms.playerStride = this.stride;
        shader.uniforms.playerRecoil = this.recoil;
        shader.uniforms.playerReady = this.ready;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          attribute float playerPart;
          uniform float playerStride;
          uniform float playerRecoil;
          uniform float playerReady;
        `).replace('#include <begin_vertex>', `#include <begin_vertex>
          // 0 = fixed head/torso/face; 1/2 = shoes; 3/4 = mittens.
          if (playerPart > .5 && playerPart < 2.5) {
            float step = playerStride * (playerPart < 1.5 ? 1. : -1.);
            transformed.z += step * .16;
            transformed.y += max(0., step) * .065;
          } else if (playerPart > 2.5) {
            float swing = playerStride * (playerPart < 3.5 ? -1. : 1.);
            transformed.z += swing * .09 - playerRecoil * .065 + playerReady * .045;
            transformed.y += abs(swing) * .015 - playerReady * .075;
            if (playerPart < 3.5) transformed.x += max(0., playerRecoil) * .035;
          }
        `);
      };
    }
  }

  update(stride: number, recoil: number, glow: number, ready: number): void {
    this.stride.value = stride; this.recoil.value = recoil; this.ready.value = ready;
    this.level.emissiveIntensity = glow;
  }

  dispose(): void { this.normal.dispose(); this.level.dispose(); }
}
