import * as THREE from 'three';
import { DEATH_DIRECTION_GLSL, DEATH_FOOT_PLANT_GLSL } from './DeathAssembly';
import { DEATH_PALE_COLOR } from '../../presentation/EnemyDeathPale';


// One pale albedo state confirms death; normal lighting and opacity remain intact.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function prepareEnemyDeathMaterial(material: THREE.MeshStandardMaterial, breakup = false) {
  const tint = { breakup: { value: 0 }, variant: { value: 0 }, pale: { value: 0 }, sink: { value: 0 } };
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
      shader.uniforms.deathSink = tint.sink;
      shader.vertexShader = `uniform float deathSink; uniform float deathBreakup; uniform float deathVariant; attribute float deathPieceId; attribute vec3 deathPieceDirection;\n${DEATH_DIRECTION_GLSL}\n${DEATH_FOOT_PLANT_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += openedPieceDirection(deathPieceDirection, deathPieceId, 2., deathVariant) * deathBreakup;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nif (deathSink > 0. && isDeathFoot(deathPieceId, 2.)) { mvPosition += viewMatrix * vec4(0., deathSink, 0., 0.); gl_Position = projectionMatrix * mvPosition; }');
    }

  };
  material.customProgramCacheKey = () => `pale-death-v2.7-${breakup}`;
  material.emissiveIntensity = 0;
  return tint;
}
