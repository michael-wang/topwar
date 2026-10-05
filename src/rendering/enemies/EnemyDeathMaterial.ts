import * as THREE from 'three';
import { DEATH_DIRECTION_GLSL } from './DeathAssembly';

import { ENEMY_DEATH_GRAY } from '../../presentation/EnemyDeathTiming';

// Replace the lit albedo, not the lighting: a defeated stone-gray toy, never a glowing wash.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial, breakup = false) {
  const tint = { gray: { value: 0 }, breakup: { value: 0 }, variant: { value: 0 } };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    if (breakup) {
      shader.uniforms.deathBreakup = tint.breakup;
      shader.uniforms.deathVariant = tint.variant;
      shader.vertexShader = `uniform float deathBreakup; uniform float deathVariant; attribute vec3 deathPieceDirection;\n${DEATH_DIRECTION_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += pieceDirection(deathPieceDirection, deathVariant) * deathBreakup;');
    }
    shader.uniforms.deathGray = tint.gray;
    shader.uniforms.deathGrayTint = { value: new THREE.Color(ENEMY_DEATH_GRAY) };
    shader.fragmentShader = `uniform float deathGray; uniform vec3 deathGrayTint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, deathGrayTint, deathGray);');
  };
  material.customProgramCacheKey = () => `authored-pale-lit-death-v2-${breakup}`;
  material.emissiveIntensity = 0;
  return tint;
}
