import * as THREE from 'three';

import { ENEMY_DEATH_GRAY } from '../../presentation/EnemyDeathTiming';

// Replace the lit albedo, not the lighting: a defeated stone-gray toy, never a glowing wash.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial, breakup = false) {
  const tint = { gray: { value: 0 }, breakup: { value: 0 } };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    if (breakup) {
      shader.uniforms.deathBreakup = tint.breakup;
      shader.vertexShader = `uniform float deathBreakup; attribute vec3 deathBreakupDirection;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += deathBreakupDirection * deathBreakup;');
    }
    shader.uniforms.deathGray = tint.gray;
    shader.uniforms.deathGrayTint = { value: new THREE.Color(ENEMY_DEATH_GRAY) };
    shader.fragmentShader = `uniform float deathGray; uniform vec3 deathGrayTint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, deathGrayTint, deathGray);');
  };
  material.customProgramCacheKey = () => `progressive-pale-lit-death-v3-${breakup}`;
  material.emissiveIntensity = 0;
  return tint;
}
