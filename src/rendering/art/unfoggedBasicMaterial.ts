import * as THREE from 'three';

/** Keep the normal basic shader shared with battlefield FX, with zero fog weight.
 * Only uniforms differ: the aircraft's former fog:false program caused a costly
 * first-use compilation. Colors, tone mapping, alpha and depth behavior are intact.
 */
export function unfoggedBasicMaterial(parameters: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ ...parameters, fog: true });
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    // Three refreshes fog uniforms when switching materials. These two uniforms
    // intentionally ignore the scene's fog distances; no shader source is changed.
    shader.uniforms.fogNear = { get value() { return 1e20; }, set value(_value: number) {} };
    shader.uniforms.fogFar = { get value() { return 2e20; }, set value(_value: number) {} };
  };
  material.customProgramCacheKey = () => key;
  return material;
}
