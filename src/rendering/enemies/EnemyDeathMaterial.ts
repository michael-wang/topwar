import * as THREE from 'three';
import { DEATH_DIRECTION_GLSL } from './DeathAssembly';
import { DEATH_PALE_COLOR } from '../../presentation/EnemyDeathPale';


// One pale albedo state confirms death; normal lighting and opacity remain intact.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial, breakup = false) {
  const tint = { breakup: { value: 0 }, variant: { value: 0 }, pale: { value: 0 } };
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.deathPale = tint.pale;
    shader.uniforms.paleDeadColor = { value: new THREE.Color(DEATH_PALE_COLOR) };
    shader.fragmentShader = `uniform float deathPale; uniform vec3 paleDeadColor;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, paleDeadColor, deathPale);');
    if (breakup) {
      shader.uniforms.deathBreakup = tint.breakup;
      shader.uniforms.deathVariant = tint.variant;
      shader.vertexShader = `uniform float deathBreakup; uniform float deathVariant; attribute vec3 deathPieceDirection;\n${DEATH_DIRECTION_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += pieceDirection(deathPieceDirection, deathVariant) * deathBreakup;');
    }

  };
  material.customProgramCacheKey = () => `pale-death-v2.3-${breakup}`;
  material.emissiveIntensity = 0;
  return tint;
}
