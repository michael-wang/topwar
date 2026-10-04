import * as THREE from 'three';

import { ENEMY_DEATH_GRAY, ENEMY_DEATH_RED } from '../../presentation/EnemyDeathTiming';

// Replace the lit albedo, not the lighting: a defeated stone-gray toy, never a glowing wash.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial) {
  const tint = { gray: { value: 0 }, red: { value: 0 } };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.deathGray = tint.gray; shader.uniforms.deathRed = tint.red;
    shader.uniforms.deathGrayTint = { value: new THREE.Color(ENEMY_DEATH_GRAY) };
    shader.uniforms.deathRedTint = { value: new THREE.Color(ENEMY_DEATH_RED) };
    shader.fragmentShader = `uniform float deathGray; uniform float deathRed; uniform vec3 deathGrayTint; uniform vec3 deathRedTint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(mix(diffuseColor.rgb, deathGrayTint, deathGray), deathRedTint, deathRed);');
  };
  material.customProgramCacheKey = () => 'gray-red-lit-death-v2';
  material.emissiveIntensity = 0;
  return tint;
}
