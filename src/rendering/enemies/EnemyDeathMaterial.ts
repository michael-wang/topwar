import * as THREE from 'three';

import { ENEMY_DEATH_GRAY } from '../../presentation/EnemyDeathTiming';

// Replace the lit albedo, not the lighting: a defeated stone-gray toy, never a glowing wash.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial): { value: number; tint: THREE.Color } {
  const pale = { value: 0, tint: new THREE.Color(ENEMY_DEATH_GRAY) };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.deathPale = pale;
    shader.uniforms.deathTint = { value: pale.tint };
    shader.fragmentShader = `uniform float deathPale; uniform vec3 deathTint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, deathTint, deathPale);');
  };
  material.customProgramCacheKey = () => 'gray-lit-death-v1';
  material.emissiveIntensity = 0;
  return pale;
}
