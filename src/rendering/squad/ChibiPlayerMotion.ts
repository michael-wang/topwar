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
  private readonly offhandDelta = { value: new THREE.Vector3() };
  private readonly weaponHandDelta = { value: new THREE.Vector3() };

  constructor(normal: THREE.MeshStandardMaterial, level: THREE.MeshStandardMaterial,
    private readonly offhandGrip: THREE.Vector3, private readonly weaponGrip: THREE.Vector3,
    private readonly offhandRest: THREE.Vector3, private readonly weaponHandRest: THREE.Vector3) {
    this.normal = normal.clone(); this.level = level.clone();
    for (const material of [this.normal, this.level]) {
      material.customProgramCacheKey = () => 'topwar-floating-player-parts-v2';
      material.onBeforeCompile = shader => {
        shader.uniforms.playerStride = this.stride;
        shader.uniforms.playerRecoil = this.recoil;
        shader.uniforms.playerReady = this.ready;
        shader.uniforms.playerOffhandDelta = this.offhandDelta;
        shader.uniforms.playerWeaponHandDelta = this.weaponHandDelta;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          attribute float playerPart;
          uniform float playerStride;
          uniform float playerRecoil;
          uniform float playerReady;
          uniform vec3 playerOffhandDelta;
          uniform vec3 playerWeaponHandDelta;
        `).replace('#include <begin_vertex>', `#include <begin_vertex>
          // 0 = fixed head/torso/face; 1/2 = shoes; 3/4 = mittens.
          if (playerPart > .5 && playerPart < 2.5) {
            float step = playerStride * (playerPart < 1.5 ? 1. : -1.);
            transformed.z += step * .22;
            transformed.y += max(0., step) * .075;
            transformed.x += (playerPart < 1.5 ? -1. : 1.) * abs(playerStride) * .035;
          } else if (playerPart > 2.5) {
            float swing = playerStride * (playerPart < 3.5 ? -1. : 1.);
            // Both grips follow weapon lowering/cant. The support hand absorbs
            // less recoil, and firing quiets its temporary lane counter-swing.
            transformed += playerPart < 3.5 ? playerOffhandDelta : playerWeaponHandDelta;
            float freeSwing = swing * (1. - min(1., abs(playerRecoil))) * (1. - .2 * playerReady);
            transformed.z += freeSwing * .10;
            transformed.y += abs(freeSwing) * .018;
          }
        `);
      };
    }
  }

  update(stride: number, recoil: number, glow: number, ready: number, weaponTransform?: THREE.Matrix4): void {
    this.stride.value = stride; this.recoil.value = recoil; this.ready.value = ready;
    this.level.emissiveIntensity = glow;
    if (weaponTransform) {
      this.offhandDelta.value.copy(this.offhandGrip).applyMatrix4(weaponTransform).sub(this.offhandRest);
      this.weaponHandDelta.value.copy(this.weaponGrip).applyMatrix4(weaponTransform).sub(this.weaponHandRest);
      // Preserve lowering/lane pose, attenuate only the support hand's shot response.
      this.offhandDelta.value.z += recoil * .04;
    }
  }

  dispose(): void { this.normal.dispose(); this.level.dispose(); }
}
