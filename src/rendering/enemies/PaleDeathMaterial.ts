import * as THREE from 'three';

export const PALE_DEATH_COLORS = ['#d8d9d1', '#e7e4d9', '#bfc5c1'] as const;

// Replace the lit albedo, not the lighting: a plaster toy, never a glowing wash.
// Materials/uniforms belong to reusable renderer slots; family geometry is borrowed.
export function preparePaleDeathMaterial(material: THREE.MeshStandardMaterial): { value: number } {
  const pale = { value: 0 }, tint = new THREE.Color(PALE_DEATH_COLORS[0]);
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.deathPale = pale;
    shader.uniforms.deathTint = { value: tint };
    shader.fragmentShader = `uniform float deathPale; uniform vec3 deathTint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, deathTint, deathPale);');
  };
  material.customProgramCacheKey = () => 'pale-lit-death-v1';
  material.emissiveIntensity = 0;
  return pale;
}
