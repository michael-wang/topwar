import * as THREE from 'three';
import { DEATH_DIRECTION_GLSL } from './DeathAssembly';


// Keep authored lit albedo throughout breakup; only separation and opacity change.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial, breakup = false) {
  const tint = { breakup: { value: 0 }, variant: { value: 0 } };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    if (breakup) {
      shader.uniforms.deathBreakup = tint.breakup;
      shader.uniforms.deathVariant = tint.variant;
      shader.vertexShader = `uniform float deathBreakup; uniform float deathVariant; attribute vec3 deathPieceDirection;\n${DEATH_DIRECTION_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += pieceDirection(deathPieceDirection, deathVariant) * deathBreakup;');
    }

  };
  material.customProgramCacheKey = () => `authored-color-death-v2.1-${breakup}`;
  material.emissiveIntensity = 0;
  return tint;
}
